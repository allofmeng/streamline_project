import { connectWebSocket, getProfile, connectScaleWebSocket } from './api.js';
import * as chart from './chart.js';
import * as ui from './ui.js';

let shotStartTime = null;

function handleData(data) {
    const state = data.state.state;

    // Update UI elements
    ui.updateMachineStatus(state);
    ui.updateTemperatures({ mix: data.mixTemperature, group: data.groupTemperature });

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

function handleScaleData(data) {
    ui.updateWeight(data.weight);
}

async function loadInitialData() {
    try {
        const profile = await getProfile();
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
    connectWebSocket(handleData);
    connectScaleWebSocket(handleScaleData);
});
