// streamline_project/src/modules/ui.js
import { getProfile, sendProfile } from './api.js';

function updateDrinkOutValue(newValue) {
    getProfile().then(profile => {
        if (profile) {
            profile.target_weight = newValue.toString();
            sendProfile(profile).then(response => {
                if (response.ok) {
                    console.log('Profile updated ok ,New Value : ',newValue);
                    console.log("profile",profile);
                } else {
                    console.error('Failed to update profile');
                }
            });
        }
    });
}

export function initUI() {
    const drinkOutValueEl = document.getElementById('drink-out-value');
    const drinkOutMinusBtn = document.getElementById('drink-out-minus');
    const drinkOutPlusBtn = document.getElementById('drink-out-plus');

    if (drinkOutMinusBtn) {
        drinkOutMinusBtn.addEventListener('click', () => {
            let currentValue = parseFloat(drinkOutValueEl.textContent);
            if (currentValue > 0) {
                currentValue -= 1;
                drinkOutValueEl.textContent = `${currentValue}g`;
                console.log("currentvalue",currentValue);
                updateDrinkOutValue(currentValue);
            }
        });
    }

    if (drinkOutPlusBtn) {
        drinkOutPlusBtn.addEventListener('click', () => {
            let currentValue = parseFloat(drinkOutValueEl.textContent);
            currentValue += 1;
            drinkOutValueEl.textContent = `${currentValue}g`;
            console.log("currentvalue",currentValue);
            updateDrinkOutValue(currentValue);
        });
    }
}

export function updateMachineStatus(status) {
    const machineStatusEl = document.getElementById('machine-status');
    if (machineStatusEl) {
        machineStatusEl.textContent = status;
    }
}

export function updateTemperatures({ mix, group }) {
    const mixTempEl = document.getElementById('data-mix-temp');
    const groupTempEl = document.getElementById('data-group-temp');

    if (mixTempEl) {
        mixTempEl.textContent = `${mix.toFixed(1)}°c`;
    }
    if (groupTempEl) {
        groupTempEl.textContent = `${group.toFixed(1)}°c`;
    }
}

export function updateWeight(weight) {
    const weightEl = document.getElementById('data-weight');
    if (weightEl) {
        weightEl.textContent = `Weight ${weight.toFixed(1)}g`;
    }
}

export function updateProfileName(name) {
    const profileNameEl = document.getElementById('profile-name');
    if (profileNameEl) {
        profileNameEl.firstChild.textContent = name;
    }
}