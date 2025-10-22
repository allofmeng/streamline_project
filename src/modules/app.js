import { connectWebSocket, getWorkflow, connectScaleWebSocket, ensureGatewayModeTracking, reconnectingWebSocket } from './api.js';
import * as chart from './chart.js';
import * as ui from './ui.js';
import * as history from './history.js';
import { initWaterTankSocket } from './waterTank.js';
import { logger, setDebug } from './logger.js';

let shotStartTime = null;
let dataTimeout;
let scaleDataTimeout;
let isDe1Connected = false; // New variable to track DE1 connection status
let isScaleConnected = false; // New variable to track Scale connection status

// Sets a timer. If no data is received within 5 seconds, it assumes a stale connection.
function resetDataTimeout() {
    clearTimeout(dataTimeout);
    dataTimeout = setTimeout(() => {
        logger.warn('No WebSocket data received for 5 seconds. Assuming REA or WebSocket disconnection.');
        ui.updateMachineStatus("Disconnected"); // Set status to disconnected
        isDe1Connected = false; // DE1 is considered disconnected if no data from REA
        // Do not clear chart or reset shotStartTime as per user request

        // Explicitly close the WebSocket to force reconnection attempt
        if (reconnectingWebSocket) {
            reconnectingWebSocket.close();
        }
    }, 5000); // 5-second timeout
}

// Sets a timer for scale data. If no data is received, it assumes a stale connection.
function resetScaleDataTimeout() {
    clearTimeout(scaleDataTimeout);
    scaleDataTimeout = setTimeout(() => {
        logger.warn('No scale data received for 5 seconds. Assuming scale disconnection.');
        isScaleConnected = false; // Scale is considered disconnected if no data
        ui.updateWeight('--g'); // Reset weight display to '--g'
        // If a scale status element exists, update it here
    }, 5000); // 5-second timeout
}

function handleData(data) {
    logger.debug("handleData received new snapshot.");
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
        logger.warn('DE1 machine disconnected.');
        isDe1Connected = false;
        // ui.updateMachineStatus("Disconnected"); // Removed: Let the main logic handle it
    }

    // New condition: If REA is running but not connected to the machine
    // Infer this if state is 'error'
    if (state === 'error') {
        statusString = "Disconnected";
    } else if (state === 'heating') {
        const currentGroupTemp = data.groupTemperature;
        const targetGroupTemp = data.targetGroupTemperature;
        statusString = `Heating... (Group: ${currentGroupTemp.toFixed(0)}°c / ${targetGroupTemp.toFixed(0)}°c)`;
    }

    // Update UI elements
    ui.updateMachineStatus(statusString);
    ui.updateSleepButton(state);
    ui.updateTemperatures({ mix: data.mixTemperature, group: data.groupTemperature, steam: data.steamTemperature });

    // Update Chart
    if (['espresso', 'flush', 'steam', 'hotWater'].includes(state)) {
        if (!shotStartTime) {
            shotStartTime = new Date(data.timestamp);
            chart.clearChart(); // Do not clear chart as per user request
        }
        chart.updateChart(shotStartTime, data); // Pass full data object
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

const throttledUpdateWeight = ui.updateWeight; // 100ms throttle interval

function handleScaleData(data) {
    // logger.debug("handleScaleData received new snapshot.", data);
    resetScaleDataTimeout();

    const currentWeight = data.weight;
    logger.debug(`Scale: currentWeight: ${currentWeight}, isScaleConnected: ${isScaleConnected}`);

    // Detect scale reconnection
    if (currentWeight !== null && currentWeight !== undefined && !isScaleConnected) {
        logger.info('Scale reconnected.');
        isScaleConnected = true;
    } else if ((currentWeight === null || currentWeight === undefined) && isScaleConnected) {
        logger.warn('Scale disconnected.');
        isScaleConnected = false;
        ui.updateWeight('--g'); // Explicitly reset weight display on disconnection
    }

    if (currentWeight !== null && currentWeight !== undefined) {
        throttledUpdateWeight(currentWeight);
    } else {
        // If weight is null/undefined, ensure UI reflects --g
        ui.updateWeight('--g');
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

document.addEventListener('DOMContentLoaded', () => {
    // setDebug(true); // Uncomment to enable debug logs
    chart.initChart();
    ui.initUI(); // Initialize UI event listeners
    history.initHistory(); // Initialize history module
    loadInitialData();
    connectWebSocket(handleData, () => {
        logger.info('WebSocket reconnected. Resetting DE1 connection status.');
        isDe1Connected = false; // Reset DE1 connection status so handleData can detect reconnection
    });
    connectScaleWebSocket(handleScaleData, () => {
        logger.info('Scale WebSocket reconnected. Resetting scale connection status.');
        isScaleConnected = false; // Reset scale connection status so handleScaleData can detect reconnection
    });
    initWaterTankSocket();
    ensureGatewayModeTracking();
    resetDataTimeout(); // Start the timeout timer initially.
    resetScaleDataTimeout(); // Start the scale timeout timer initially.
});
