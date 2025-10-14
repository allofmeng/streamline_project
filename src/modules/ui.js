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
    console.log(`DEBUG: Updating machine status to: ${status}`);
    const machineStatusEl = document.getElementById('machine-status');
    if (machineStatusEl) {
        machineStatusEl.textContent = status;
        if (status === "Disconnected") {
            machineStatusEl.classList.remove('text-[var(--green)]');
            machineStatusEl.classList.add('text-red-500');
        } else {
            machineStatusEl.classList.remove('text-red-500');
            machineStatusEl.classList.add('text-[var(--green)]');
        }
    }
}

export function updateTemperatures({ mix, group, steam }) {
    const mixTempEl = document.getElementById('data-mix-temp');
    const groupTempEl = document.getElementById('data-group-temp');
    const steamTempEl = document.getElementById('data-steam-temp');

    if (mixTempEl) {
        mixTempEl.textContent = `${mix.toFixed(1)}°c`;
    }
    if (groupTempEl) {
        groupTempEl.textContent = `${group.toFixed(1)}°c`;
    }
    if (steamTempEl) {
        steamTempEl.textContent = `${steam.toFixed(0)}°c`;
    }
}

export function updateWeight(weight) {
    const weightEl = document.getElementById('data-weight');
    if (weightEl) {
        weightEl.textContent = `Weight ${weight.toFixed(1)}g`;
    }
}

export function updateProfileName(name) {
    console.log(`DEBUG: Updating profile name to: ${name}`);
    const profileNameEl = document.getElementById('profile-name');
    if (profileNameEl) {
        profileNameEl.firstChild.textContent = name;
    }
}

export function updateDrinkOut(doseOut) {
    console.log(`DEBUG: Updating drink out to: ${doseOut}g`);
    const drinkOutValueEl = document.getElementById('drink-out-value');
    if (drinkOutValueEl) {
        drinkOutValueEl.textContent = `${doseOut}g`;
    }
}