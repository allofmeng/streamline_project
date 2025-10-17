import { getProfile, sendProfile, updateWorkflow, setMachineState } from './api.js';
import { logger } from './logger.js';

function updateDrinkOutValue(newValue) {
    const doseInEl = document.getElementById('dose-in-value');
    const currentDoseIn = doseInEl ? parseFloat(doseInEl.textContent) : 0;

    const payload = {
        doseData: {
            doseIn: currentDoseIn,
            doseOut: parseFloat(newValue)
        }
    };

    updateWorkflow(payload).then(() => {
        logger.debug('Drink out value updated via workflow:', newValue);
    }).catch(error => {
        logger.error('Failed to update drink out value via workflow:', error);
    });
}

function updateDoseInValue(newValue) {
    const drinkOutEl = document.getElementById('drink-out-value');
    const currentDoseOut = drinkOutEl ? parseFloat(drinkOutEl.textContent) : 0;

    const payload = {
        doseData: {
            doseIn: parseFloat(newValue),
            doseOut: currentDoseOut
        }
    };

    updateWorkflow(payload).then(() => {
        logger.debug('Dose in value updated via workflow:', newValue);
    }).catch(error => {
        logger.error('Failed to update dose in value via workflow:', error);
    });
}

function updateTemperatureValue(newValue) {
    getProfile().then(profile => {
        if (profile && profile.steps) {
            profile.steps.forEach(step => {
                step.temperature = newValue.toString();
            });
            updateWorkflow({ profile: profile }).then(() => {
                logger.debug('Temperature updated via workflow:', newValue);
            }).catch(error => {
                logger.error('Failed to update temperature via workflow:', error);
            });
        }
    });
}

function updateGrindValue(newValue) {
    const workflowUpdate = {
        grinderData: {
            setting: newValue.toString()
        }
    };
    updateWorkflow(workflowUpdate).then(() => {
        logger.debug('Grind value updated successfully:', newValue);
    }).catch(error => {
        logger.error('Failed to update grind value:', error);
    });
}

export function updateDrinkRatio() {
    const doseInEl = document.getElementById('dose-in-value');
    const drinkOutEl = document.getElementById('drink-out-value');
    const ratioEl = document.getElementById('drink-ratio-value');

    if (doseInEl && drinkOutEl && ratioEl) {
        const doseIn = parseFloat(doseInEl.textContent);
        const drinkOut = parseFloat(drinkOutEl.textContent);

        if (!isNaN(doseIn) && !isNaN(drinkOut) && doseIn > 0) {
            const ratio = drinkOut / doseIn;
            ratioEl.textContent = `(1:${ratio.toFixed(1)})`;
        } else {
            ratioEl.textContent = '(1:--)';
        }
    }
}

function makeEditable(element, onCommit) {
    element.addEventListener('click', () => {
        if (element.parentNode.querySelector('input')) return;

        let isProcessed = false;
        const currentValue = parseFloat(element.textContent);
        const input = document.createElement('input');
        input.type = 'number';
        input.value = currentValue;
        input.className = 'text-3xl font-bold text-center w-24 bg-transparent';

        element.style.display = 'none';
        element.parentNode.insertBefore(input, element);
        input.focus();
        input.select();

        const processChange = (shouldCommit) => {
            if (isProcessed) return;
            isProcessed = true;

            if (shouldCommit) {
                const newValue = parseFloat(input.value);
                if (!isNaN(newValue) && newValue >= 0) {
                    onCommit(newValue);
                }
            }

            element.style.display = '';
            input.remove();
        };

        input.addEventListener('blur', () => processChange(true));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') processChange(true);
            if (e.key === 'Escape') processChange(false);
        });
    });
}

export function initUI() {
    const drinkOutValueEl = document.getElementById('drink-out-value');
    const drinkOutMinusBtn = document.getElementById('drink-out-minus');
    const drinkOutPlusBtn = document.getElementById('drink-out-plus');
    const tempValueEl = document.getElementById('temp-value');
    const tempMinusBtn = document.getElementById('temp-minus');
    const tempPlusBtn = document.getElementById('temp-plus');
    const doseInValueEl = document.getElementById('dose-in-value');
    const doseInMinusBtn = document.getElementById('dose-in-minus');
    const doseInPlusBtn = document.getElementById('dose-in-plus');
    const grindValueEl = document.getElementById('grind-value');
    const grindMinusBtn = document.getElementById('grind-minus');
    const grindPlusBtn = document.getElementById('grind-plus');
    const sleepButton = document.getElementById('sleep-button');

    if (sleepButton) {
        sleepButton.addEventListener('click', () => {
            const currentState = sleepButton.textContent.trim();
            if (currentState === 'Sleep') {
                setMachineState('sleeping').then(() => {
                    logger.info('Machine state set to sleeping.');
                }).catch(error => {
                    logger.error('Failed to set machine state to sleeping:', error);
                });
            } else {
                setMachineState('idle').then(() => {
                    logger.info('Machine state set to idle.');
                }).catch(error => {
                    logger.error('Failed to set machine state to idle:', error);
                });
            }
        });
    }

    if (doseInValueEl) {
        makeEditable(doseInValueEl, (newValue) => {
            doseInValueEl.textContent = `${newValue}g`;
            updateDoseInValue(newValue);
            updateDrinkRatio();
        });
    }

    if (tempValueEl) {
        makeEditable(tempValueEl, (newValue) => {
            tempValueEl.textContent = `${newValue}°c`;
            updateTemperatureValue(newValue);
        });
    }

    if (drinkOutValueEl) {
        makeEditable(drinkOutValueEl, (newValue) => {
            drinkOutValueEl.textContent = `${newValue}g`;
            updateDrinkOutValue(newValue);
            updateDrinkRatio();
        });
    }

    if (grindValueEl) {
        makeEditable(grindValueEl, (newValue) => {
            grindValueEl.textContent = newValue.toFixed(1);
            updateGrindValue(newValue);
        });
    }

    if (drinkOutMinusBtn) {
        drinkOutMinusBtn.addEventListener('click', () => {
            let currentValue = parseFloat(drinkOutValueEl.textContent);
            if (currentValue > 0) {
                currentValue -= 1;
                drinkOutValueEl.textContent = `${currentValue}g`;
                logger.debug("currentvalue", currentValue);
                updateDrinkOutValue(currentValue);
                updateDrinkRatio();
            }
        });
    }

    if (drinkOutPlusBtn) {
        drinkOutPlusBtn.addEventListener('click', () => {
            let currentValue = parseFloat(drinkOutValueEl.textContent);
            currentValue += 1;
            drinkOutValueEl.textContent = `${currentValue}g`;
            logger.debug("currentvalue", currentValue);
                updateDrinkOutValue(currentValue);
            updateDrinkRatio();
        });
    }

    if (tempMinusBtn) {
        tempMinusBtn.addEventListener('click', () => {
            let currentValue = parseFloat(tempValueEl.textContent);
            if (currentValue > 0) {
                currentValue -= 1;
                tempValueEl.textContent = `${currentValue}°c`;
                updateTemperatureValue(currentValue);
            }
        });
    }

    if (tempPlusBtn) {
        tempPlusBtn.addEventListener('click', () => {
            let currentValue = parseFloat(tempValueEl.textContent);
            currentValue += 1;
            tempValueEl.textContent = `${currentValue}°c`;
            updateTemperatureValue(currentValue);
        });
    }

    if (doseInMinusBtn) {
        doseInMinusBtn.addEventListener('click', () => {
            let currentValue = parseFloat(doseInValueEl.textContent);
            if (currentValue > 0) {
                currentValue -= 1;
                doseInValueEl.textContent = `${currentValue}g`;
                updateDoseInValue(currentValue);
                updateDrinkRatio();
            }
        });
    }

    if (doseInPlusBtn) {
        doseInPlusBtn.addEventListener('click', () => {
            let currentValue = parseFloat(doseInValueEl.textContent);
            currentValue += 1;
            doseInValueEl.textContent = `${currentValue}g`;
            updateDoseInValue(currentValue);
            updateDrinkRatio();
        });
    }

    if (grindMinusBtn) {
        grindMinusBtn.addEventListener('click', () => {
            let currentValue = parseFloat(grindValueEl.textContent);
            if (currentValue > 0) {
                currentValue = Math.round((currentValue - 0.1) * 10) / 10;
                grindValueEl.textContent = currentValue.toFixed(1);
                updateGrindValue(currentValue);
            }
        });
    }

    if (grindPlusBtn) {
        grindPlusBtn.addEventListener('click', () => {
            let currentValue = parseFloat(grindValueEl.textContent);
            currentValue = Math.round((currentValue + 0.1) * 10) / 10;
            grindValueEl.textContent = currentValue.toFixed(1);
            updateGrindValue(currentValue);
        });
    }

    updateDrinkRatio(); // Initial calculation
}

export function updateSleepButton(state) {
    const sleepButton = document.getElementById('sleep-button');
    if (sleepButton) {
        if (state === 'sleeping') {
            sleepButton.textContent = 'Wake Up';
        } else {
            sleepButton.textContent = 'Sleep';
        }
    }
}

export function updateMachineStatus(status) {
    logger.debug(`Updating machine status to: ${status}`);
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
    logger.debug(`Updating profile name to: ${name}`);
    const profileNameEl = document.getElementById('profile-name');
    if (profileNameEl) {
        profileNameEl.firstChild.textContent = name;
    }
}

export function updateDrinkOut(doseOut) {
    logger.debug(`Updating drink out to: ${doseOut}g`);
    const drinkOutValueEl = document.getElementById('drink-out-value');
    if (drinkOutValueEl) {
        drinkOutValueEl.textContent = `${doseOut}g`;
    }
}

export function updateTemperatureDisplay(temperature) {
    const tempValueEl = document.getElementById('temp-value');
    if (tempValueEl) {
        tempValueEl.textContent = `${parseFloat(temperature).toFixed(0)}°c`;
    }
}

export function updateGrindDisplay(grinderData) {
    const grindValueEl = document.getElementById('grind-value');
    if (grindValueEl && grinderData && grinderData.setting) {
        grindValueEl.textContent = parseFloat(grinderData.setting).toFixed(1);
    }
}

export function updateDoseInDisplay(doseInValue) {
    const doseInValueEl = document.getElementById('dose-in-value');
    if (doseInValueEl && doseInValue) {
        doseInValueEl.textContent = `${doseInValue}g`;
    }
}
