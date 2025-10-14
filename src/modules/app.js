import { connectWebSocket, getProfile, connectScaleWebSocket, ensureGatewayModeTracking } from './api.js';
import * as chart from './chart.js';
import * as ui from './ui.js';
import { initWaterTankSocket } from './waterTank.js';

let shotStartTime = null;
let dataTimeout;

// Sets a timer. If no data is received within 5 seconds, it assumes a stale connection.
function resetDataTimeout() {
    clearTimeout(dataTimeout);
    dataTimeout = setTimeout(() => {
        console.log('No WebSocket data received for 5 seconds. Assuming disconnection,,reload now.');
        ui.updateMachineStatus("Disconnected");
        location.reload();
    }, 5000); // 5-second timeout
}

function handleData(data) {
    console.log("DEBUG: handleData received new snapshot.");
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
    console.log("DEBUG: loadInitialData triggered.");
    try {
        const profile = await getProfile();
        console.log("DEBUG: Profile data received:", profile);
        if (profile) {
            ui.updateProfileName(profile.title);
            ui.updateDrinkOut(profile.target_weight);
            // Future: Pass profile to chart module if needed for overlays
            // chart.setProfile(profile);
        }
    } catch (error) {
        console.error("Failed to load initial data:", error);
        ui.updateProfileName("Error loading profile");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    chart.initChart();
    ui.initUI(); // Initialize UI event listeners
    loadInitialData();
    connectWebSocket(handleData, () => {
        console.log('WebSocket reconnected. Reloading page...');
        location.reload();
    });
    connectScaleWebSocket(handleScaleData);
    initWaterTankSocket();
    ensureGatewayModeTracking();
    resetDataTimeout(); // Start the timeout timer initially.
});
