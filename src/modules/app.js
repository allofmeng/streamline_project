import { connectWebSocket, getWorkflow, connectScaleWebSocket, ensureGatewayModeTracking, reconnectingWebSocket,reconnectScale, getDevices, reconnectDevice, scanForDevices,connectShotSettingsWebSocket, setDe1Settings, updateShotSettingsCache, getDe1Settings } from './api.js';
import * as chart from './chart.js';
import * as ui from './ui.js';
import * as history from './history.js';
import * as shotData from './shotData.js';
import * as profileManager from './profileManager.js';
import { initWaterTankSocket } from './waterTank.js';
import { logger, setDebug } from './logger.js';

let shotStartTime = null;
let dataTimeout;
let de1DeviceId = null;
let isDe1Connected = false; // New variable to track DE1 connection status
let isScaleConnected = false; // New variable to track Scale connection status
let previousMachineState = null; // Track previous machine state
let scaleReconnectPoller = null;
let latestScaleWeight = 0;

// To filter the chart to only show data from the 'pouring' state,
// set this variable to true in your browser's developer console.
let filterGraphToPouringState = true;

// Sets a timer. If no data is received within 5 seconds, it assumes a stale connection.
function resetDataTimeout() {
    clearTimeout(dataTimeout);
    dataTimeout = setTimeout(() => {
        logger.warn('No WebSocket data received for 5 seconds. Assuming REA or WebSocket disconnection.');
        ui.updateMachineStatus("Disconnected");
        isDe1Connected = false;

        if (de1DeviceId) {
            logger.info('Attempting to reconnect DE1 machine...');
            reconnectDevice(de1DeviceId);
        }

        if (reconnectingWebSocket) {
            reconnectingWebSocket.close();
        }
    }, 5000); // 5-second timeout
}

function stopScaleReconnectPolling() {
    if (scaleReconnectPoller) {
        logger.info('Stopping scale reconnect polling.');
        clearInterval(scaleReconnectPoller);
        scaleReconnectPoller = null;
    }
}

function startScaleReconnectPolling() {
    stopScaleReconnectPolling(); 
    logger.info('Starting scale reconnect polling every 5 seconds...');
    scaleReconnectPoller = setInterval(() => {
        if (isScaleConnected) {
            stopScaleReconnectPolling();
            return;
        }
        logger.info('Polling: attempting to reconnect scale...');
        reconnectScale();
    }, 5000);
}

function handleData(data) {
    //logger.debug("handleData received new snapshot.");
    resetDataTimeout(); // Reset the timer every time data is received.

    const state = data.state.state;
    let statusString = state;

    // Detect DE1 reconnection
    if (state !== 'error' && !isDe1Connected) {
        logger.info('DE1 machine reconnected. Loading initial data.');
        isDe1Connected = true;
        loadInitialData(); // Refresh all configuration data
        // Do not clear chart or reset shotStartTime as per user request
    } else if (state === 'error' && isDe1Connected) {
        logger.warn('DE1 machine connected with error status.');
        // isDe1Connected = false;
        // ui.updateMachineStatus("Disconnected"); // Removed: Let the main logic handle it
    }

    // Check for shot completion (transition from 'espresso' to 'ready' or 'idle')
    if (previousMachineState === 'espresso' && (state === 'ready' || state === 'idle')) {

        logger.info('Shot finished. Refreshing history.',previousMachineState);
        setTimeout(() => {
            history.initHistory();
        }, 5000);
    }
    previousMachineState = state; // Update previous state
    //logger.info("previousMachineState",previousMachineState)
    // New condition: If REA is running but not connected to the machine
    // Infer this if state is 'error'
    if (state === 'error') {
        statusString = "Error";
    } else if (state === 'heating') {
        const currentGroupTemp = data.groupTemperature;
        const targetGroupTemp = data.targetGroupTemperature;
        statusString = `Heating... (Group: ${currentGroupTemp.toFixed(0)}°c / ${targetGroupTemp.toFixed(0)}°c)`;
    }

    // Update UI elements
    ui.updateMachineStatus(statusString);
    ui.updateSleepButton(state);
    ui.updateTemperatures({ mix: data.mixTemperature, group: data.groupTemperature, steam: data.steamTemperature });

    // Update Chart and Shot Data Table
    if (['espresso', 'flush', 'steam', 'hotWater'].includes(state)) {
        if (!shotStartTime) {
            shotStartTime = new Date(data.timestamp);
            chart.clearChart();
            shotData.clearShotData();
            const historyLabelEl = document.getElementById('shot-history-label');
            if (historyLabelEl) {
                historyLabelEl.textContent = 'CURRENT';
            }
        }
        chart.updateChart(shotStartTime, data);
        shotData.updateShotData(data, latestScaleWeight);
    } else {
        shotStartTime = null;
    }
}

// Throttle function to limit the rate of execution
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

const throttledUpdateWeight = throttle(ui.updateWeight, 100); // 100ms throttle interval

function handleScaleData(data) {
    const currentWeight = data.weight;
    latestScaleWeight = currentWeight;

    // Receiving any message means the websocket and BLE link are up.
    // We can stop polling for a reconnect.
    // The timeout in api.js will trigger a disconnect if data stops flowing.
    stopScaleReconnectPolling();

    if (currentWeight !== null && currentWeight !== undefined) {
        // We have a weight, so we are fully connected.
        if (!isScaleConnected) {
            logger.info('Scale reconnected.');
            isScaleConnected = true;
        }
        // Update the UI with the new weight.
        throttledUpdateWeight(currentWeight);
        if (shotStartTime) {
            chart.updateWeight(shotStartTime, currentWeight);
        }
    } else {
        // We received a message without a weight.
        // If we were already connected, we just keep the last weight on screen.
        // If we were not connected, we show '--g'.
        if (!isScaleConnected) {
            ui.updateWeight('--g');
        }
        logger.warn('Scale message received without weight data.');
    }
}

async function handleShotSettingsData(data) {
    updateShotSettingsCache(data);
    ui.updateHotWaterDisplay(data);

    try {
        const de1Settings = await getDe1Settings();
        const combinedData = { ...data, targetSteamFlow: de1Settings.steamFlow };
        ui.updateSteamDisplay(combinedData);
    } catch (error) {
        logger.error('Failed to get DE1 settings for steam display:', error);
        ui.updateSteamDisplay(data); // Fallback to original data
    }

    if (data.flushTimeout !== undefined) {
        ui.updateFlushDisplay(data.flushTimeout);
    }
}

async function loadInitialData() {
    logger.debug("loadInitialData triggered.");
    try {
        const workflow = await getWorkflow();
        logger.debug("Workflow data received:", workflow);

        const profile = workflow?.profile;
        const doseData = workflow?.doseData;
        const grinderData = workflow?.grinderData;

        if (profile) {
            ui.updateProfileName(profile.title || "Untitled Profile");
            if (profile.steps && profile.steps.length > 0) {
                ui.updateTemperatureDisplay(profile.steps[0].temperature || 0);
            }
        }

        if (doseData) {
            ui.updateDoseInDisplay(doseData.doseIn);
            ui.updateDrinkOut(doseData.doseOut || 0);
        }

        if (grinderData) {
            ui.updateGrindDisplay(grinderData);
        }

        ui.updateDrinkRatio();

    } catch (error) {
        logger.error("Failed to load initial data:", error);
        ui.updateProfileName("Error loading profile");
    }
}

async function initializeDe1Connection() {
    try {
        logger.info('Attempting to find devices with fast method...');
        let devices = await getDevices();
        let de1Machine = devices.find(d => d.type === 'machine');

        // If not found, try the slower, more reliable scan
        if (!de1Machine) {
            logger.warn('DE1 not found with fast method. Trying fallback scan...');
            devices = await scanForDevices();
            de1Machine = devices.find(d => d.type === 'machine');
        }

        if (de1Machine) {
            de1DeviceId = de1Machine.id;
            logger.info(`DE1 machine ID found and stored: ${de1DeviceId}`);
            if (de1Machine.state !== 'connected') {
                logger.warn('DE1 machine is found but not connected. Awaiting automatic reconnection or data timeout.');
            } else {
                logger.info('DE1 machine is already connected.');
            }
        } else {
            logger.error('DE1 machine not found even after fallback scan.');
        }
    } catch (error) {
        logger.error('Failed to initialize DE1 device ID:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setDebug(true); // Uncomment to enable debug logs
    chart.initChart();
    ui.initUI(); // Initialize UI event listeners
    history.initHistory(); // Initialize history module
    profileManager.init(); // Initialize the profile manager
    loadInitialData();
    initializeDe1Connection();
    connectWebSocket(handleData, () => {
        logger.info('WebSocket reconnected. Resetting DE1 connection status.');
        isDe1Connected = false; // Reset DE1 connection status so handleData can detect reconnection
    });
    connectScaleWebSocket(
        handleScaleData, 
        () => { // onReconnect
            logger.info('Scale WebSocket reconnected. Resetting scale connection status.');
            isScaleConnected = false; 
        },
        () => { // onDisconnect
            logger.warn('Scale has disconnected.');
            isScaleConnected = false;
            ui.updateWeight('--g');

            startScaleReconnectPolling();
        }
    );
    initWaterTankSocket();
    ensureGatewayModeTracking();
    resetDataTimeout(); // Start the timeout timer initially.
    connectShotSettingsWebSocket(handleShotSettingsData);
});
