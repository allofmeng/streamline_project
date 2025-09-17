// src/modules/ui.js
const profileNameElement = document.getElementById('profile-name');
const machineStateElement = document.getElementById('machine-status');
const mixTempElement = document.getElementById('data-mix-temp');
const groupTempElement = document.getElementById('data-group-temp');

export function updateProfileName(name) {
    if (profileNameElement) {
        // The h1 contains text and an SVG, so we target the first text node.
        profileNameElement.childNodes[0].nodeValue = name ? `${name} ` : 'No Profile Loaded ';
    }
}

export function updateMachineStatus(status) {
    if (machineStateElement) {
        machineStateElement.textContent = status;
    }
}

export function updateTemperatures({ mix, group }) {
    if (mixTempElement) mixTempElement.textContent = `${mix.toFixed(1)}°c`;
    if (groupTempElement) groupTempElement.textContent = `${group.toFixed(1)}°c`;
}
