import { connectWebSocket, getWorkflow, connectScaleWebSocket, ensureGatewayModeTracking } from './api.js';
import * as chart from './chart.js';
import * as ui from './ui.js';
import * as history from './history.js';
import { initWaterTankSocket } from './waterTank.js';
import { logger, setDebug } from './logger.js';

let shotStartTime = null;
let dataTimeout;

// Sets a timer. If no data is received within 5 seconds, it assumes a stale connection.
function resetDataTimeout() {
    clearTimeout(dataTimeout);
    dataTimeout = setTimeout(() => {
        logger.warn('No WebSocket data received for 5 seconds. Assuming disconnection, reloading now.');
        ui.updateMachineStatus("Disconnected");
        location.reload();
    }, 5000); // 5-second timeout
}

function handleData(data) {
    logger.debug("handleData received new snapshot.");
    resetDataTimeout(); // Reset the timer every time data is received.

    const state = data.state.state;

    let statusString = state;

    if (state === 'heating') {
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
            chart.clearChart();
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

const throttledUpdateWeight = throttle(ui.updateWeight, 100); // 100ms throttle interval

function handleScaleData(data) {
    throttledUpdateWeight(data.weight);
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
        logger.info('WebSocket reconnected. Reloading page...');
        location.reload();
    });
    connectScaleWebSocket(handleScaleData);
    initWaterTankSocket();
    ensureGatewayModeTracking();
    resetDataTimeout(); // Start the timeout timer initially.
});
