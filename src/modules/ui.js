import { getProfile, sendProfile, updateWorkflow, setMachineState, setTargetHotWaterVolume, setTargetHotWaterTemp } from './api.js';
import { logger } from './logger.js';

let currentHotWaterVolume = 0;
let currentHotWaterTemp = 0;
let hotWaterMode = 'volume'; // 'volume' or 'temperature'

function updateDoseValue(type, newValue) {
    const doseInEl = document.getElementById('dose-in-value');
    const drinkOutEl = document.getElementById('drink-out-value');
    const currentDoseIn = doseInEl ? parseFloat(doseInEl.textContent) : 0;
    const currentDoseOut = drinkOutEl ? parseFloat(drinkOutEl.textContent) : 0;

    const payload = {
        doseData: {
            doseIn: type === 'in' ? parseFloat(newValue) : currentDoseIn,
            doseOut: type === 'out' ? parseFloat(newValue) : currentDoseOut
        }
    };

    updateWorkflow(payload).then(() => {
        logger.debug(`Dose ${type} value updated via workflow:`, newValue);
    }).catch(error => {
        logger.error(`Failed to update dose ${type} value via workflow:`, error);
    });
}

function updateDoseAndDrinkOutValue(newDoseIn, newDrinkOut) {
    const payload = {
        doseData: {
            doseIn: newDoseIn,
            doseOut: newDrinkOut
        }
    };

    updateWorkflow(payload).then(() => {
        logger.debug(`Dose In and Drink Out values updated via workflow: ${newDoseIn}g : ${newDrinkOut}g`);
    }).catch(error => {
        logger.error(`Failed to update dose in and drink out values via workflow:`, error);
    });
}

export function updateDrinkOutPresetsDisplay(doseIn, drinkOut) {
    const doseInEl = document.getElementById('dose-in-value');
    const drinkOutEl = document.getElementById('drink-out-value');
    const ratioEl = document.getElementById('drink-ratio-value');

    if (doseInEl) {
        doseInEl.textContent = `${doseIn}`;
    }
    if (drinkOutEl) {
        drinkOutEl.textContent = `${drinkOut}`;
    }

    if (doseInEl && drinkOutEl && ratioEl) {
        if (!isNaN(doseIn) && !isNaN(drinkOut) && doseIn > 0) {
            const ratio = drinkOut / doseIn;
            ratioEl.textContent = `(1:${ratio.toFixed(1)})`;
        } else {
            ratioEl.textContent = '(1:--)';
        }
    }
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

export function updateHotWaterDisplay(data) {
    const volEl = document.getElementById('hot-water-vol-value');
    const tempEl = document.getElementById('hot-water-temp-value');
    const modeTempEl = document.getElementById('hot-water-mode-temp');
    const modeVolEl = document.getElementById('hot-water-mode-vol');
    if (!volEl || !tempEl || !modeTempEl || !modeVolEl) return;
    if (data.targetHotWaterVolume !== undefined) {
        currentHotWaterVolume = data.targetHotWaterVolume;
    }
    if (data.targetHotWaterTemp !== undefined) {
        currentHotWaterTemp = data.targetHotWaterTemp;
    }

    volEl.textContent = `${currentHotWaterVolume}ml`;
    tempEl.textContent = `${currentHotWaterTemp}°C`;

    if (hotWaterMode === 'volume') {
        volEl.classList.remove('text-2xl', 'text-gray-500');
        volEl.classList.add('text-3xl', 'font-bold');
        tempEl.classList.remove('text-3xl', 'font-bold');
        tempEl.classList.add('text-2xl', 'text-gray-500');
        modeVolEl.className = 'text-[var(--mimoja-blue-v2)]';
        modeTempEl.className = 'text-[var(--low-contrast-white)]';
    } else { // temperature mode
        tempEl.classList.remove('text-2xl', 'text-gray-500');
        tempEl.classList.add('text-3xl', 'font-bold');
        volEl.classList.remove('text-3xl', 'font-bold');
        volEl.classList.add('text-2xl', 'text-gray-500');
        modeTempEl.className = 'text-[var(--mimoja-blue-v2)]';
        modeVolEl.className = 'text-[var(--low-contrast-white)]';
    }
}

function incrementHotWater() {
    if (hotWaterMode === 'volume') {
        currentHotWaterVolume += 5;
        setTargetHotWaterVolume(currentHotWaterVolume).catch(e => logger.error(e));
    } else {
        currentHotWaterTemp += 1;
        setTargetHotWaterTemp(currentHotWaterTemp).catch(e => logger.error(e));
    }
}

function decrementHotWater() {
    if (hotWaterMode === 'volume') {
        if (currentHotWaterVolume >= 5) {
            currentHotWaterVolume -= 5;
            setTargetHotWaterVolume(currentHotWaterVolume).catch(e => logger.error(e));
        }
    }
    else {
        if (currentHotWaterTemp > 0) {
            currentHotWaterTemp -= 1;
            setTargetHotWaterTemp(currentHotWaterTemp).catch(e => logger.error(e));
        }
    }
}

function toggleHotWaterMode() {
    hotWaterMode = hotWaterMode === 'volume' ? 'temperature' : 'volume';
    logger.info(`Hot water mode switched to: ${hotWaterMode}`);
    updateHotWaterDisplay({ targetHotWaterVolume: currentHotWaterVolume, targetHotWaterTemp: currentHotWaterTemp });
}

function setupValueAdjuster(minusBtnId, plusBtnId, valueElId, step, min, formatter, onUpdate) {
    const minusBtn = document.getElementById(minusBtnId);
    const plusBtn = document.getElementById(plusBtnId);
    const valueEl = document.getElementById(valueElId);

    if (!minusBtn || !plusBtn || !valueEl) return;

    minusBtn.addEventListener('click', () => {
        let currentValue = parseFloat(valueEl.textContent);
        if (currentValue > min) {
            currentValue -= step;
            valueEl.textContent = formatter(currentValue);
            onUpdate(currentValue);
        }
    });

    plusBtn.addEventListener('click', () => {
        let currentValue = parseFloat(valueEl.textContent);
        currentValue += step;
        valueEl.textContent = formatter(currentValue);
        onUpdate(currentValue);
    });
}

function onLongPress(element, callback) {
    let timer;

    element.addEventListener('mousedown', () => {
        timer = setTimeout(() => {
            callback();
        }, 1000); // 1 second
    });

    element.addEventListener('mouseup', () => {
        clearTimeout(timer);
    });

    element.addEventListener('mouseleave', () => {
        clearTimeout(timer);
    });
}

export function initUI() {
    const drinkOutValueEl = document.getElementById('drink-out-value');
    const tempValueEl = document.getElementById('temp-value');
    const doseInValueEl = document.getElementById('dose-in-value');
    const grindValueEl = document.getElementById('grind-value');
    const sleepButton = document.getElementById('sleep-button');
    const hotWaterMinusBtn = document.getElementById('hot-water-vol-minus');
    const hotWaterPlusBtn = document.getElementById('hot-water-vol-plus');
    const hotWaterModeToggle = document.getElementById('hot-water-mode-toggle');
    const hotWaterVolValueEl = document.getElementById('hot-water-vol-value');
    const hotWaterTempValueEl = document.getElementById('hot-water-temp-value');
    const tempPresets = document.getElementById('temp-presets');
    const drinkOutPresets = document.getElementById('drink-out-presets');

    if (tempPresets) {
        for (const button of tempPresets.children) {
            onLongPress(button, () => {
                const tempValue = document.getElementById('temp-value').textContent;
                button.textContent = tempValue;
            });

            button.addEventListener('click', (e) => {
                const newValue = parseFloat(e.target.textContent);
                updateTemperatureValue(newValue);
                updateTemperatureDisplay(newValue);

                // Update preset styles
                for (const btn of tempPresets.children) {
                    btn.classList.remove('text-black');
                    btn.classList.add('text-gray-400');
                }
                e.target.classList.remove('text-gray-400');
                e.target.classList.add('text-black');
            });
        }
    }

    if (drinkOutPresets) {
        for (const button of drinkOutPresets.children) {
            onLongPress(button, () => {
                const doseInValue = parseFloat(document.getElementById('dose-in-value').textContent);
                const drinkOutValue = parseFloat(document.getElementById('drink-out-value').textContent);
                button.textContent = `${doseInValue}:${drinkOutValue}`;
            });

            button.addEventListener('click', (e) => {
                const [doseInStr, drinkOutStr] = e.target.textContent.split(':');
                const newDoseIn = parseFloat(doseInStr);
                const newDrinkOut = parseFloat(drinkOutStr);

                if (!isNaN(newDoseIn) && !isNaN(newDrinkOut)) {
                    updateDoseAndDrinkOutValue(newDoseIn, newDrinkOut);
                    updateDrinkOutPresetsDisplay(newDoseIn, newDrinkOut);

                    // Update preset styles
                    for (const btn of drinkOutPresets.children) {
                        btn.classList.remove('text-black');
                        btn.classList.add('text-gray-400');
                    }
                    e.target.classList.remove('text-gray-400');
                    e.target.classList.add('text-black');
                }
            });
        }
    }

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
            updateDoseValue('in', newValue);
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
            updateDoseValue('out', newValue);
            updateDrinkRatio();
        });
    }

    if (grindValueEl) {
        makeEditable(grindValueEl, (newValue) => {
            grindValueEl.textContent = newValue.toFixed(1);
            updateGrindValue(newValue);
        });
    }

    if (hotWaterVolValueEl) {
        makeEditable(hotWaterVolValueEl, (newValue) => {
            currentHotWaterVolume = newValue;
            setTargetHotWaterVolume(currentHotWaterVolume).catch(e => logger.error(e));
        });
    }

    if (hotWaterTempValueEl) {
        makeEditable(hotWaterTempValueEl, (newValue) => {
            currentHotWaterTemp = newValue;
            setTargetHotWaterTemp(currentHotWaterTemp).catch(e => logger.error(e));
        });
    }

    setupValueAdjuster('drink-out-minus', 'drink-out-plus', 'drink-out-value', 1, 0, (val) => `${val}g`, (val) => { updateDoseValue('out', val); updateDrinkRatio(); });
    setupValueAdjuster('temp-minus', 'temp-plus', 'temp-value', 1, 0, (val) => `${val}°c`, updateTemperatureValue);
    setupValueAdjuster('dose-in-minus', 'dose-in-plus', 'dose-in-value', 1, 0, (val) => `${val}g`, (val) => { updateDoseValue('in', val); updateDrinkRatio(); });
    setupValueAdjuster('grind-minus', 'grind-plus', 'grind-value', 0.1, 0, (val) => val.toFixed(1), updateGrindValue);

    if (hotWaterMinusBtn) {
        hotWaterMinusBtn.addEventListener('click', decrementHotWater);
    }

    if (hotWaterPlusBtn) {
        hotWaterPlusBtn.addEventListener('click', incrementHotWater);
    }

    if (hotWaterModeToggle) {
        hotWaterModeToggle.addEventListener('click', toggleHotWaterMode);
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
        if (typeof weight === 'number' && !isNaN(weight)) {
            weightEl.textContent = ` ${weight.toFixed(1)}g`;
        }
    } else {
        weightEl.textContent = '--g'; // Display --g if weight is not a valid number
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
