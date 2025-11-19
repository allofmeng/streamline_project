import { getProfile, sendProfile, updateWorkflow, setMachineState, setTargetHotWaterVolume, setTargetHotWaterTemp, setTargetHotWaterDuration, setDe1Settings, setTargetSteamFlow, setTargetSteamDuration } from './api.js';
import { logger } from './logger.js';
import * as chart from './chart.js';

let currentHotWaterVolume = 0;
let currentHotWaterTemp = 0;
let hotWaterMode = 'volume'; // 'volume' or 'temperature'
let hotWaterTempPresets = [75, 80, 85, 92];
let hotWaterVolPresets = [50, 100, 150, 200];

let currentSteamDuration = 0;
let currentSteamFlow = 1.5;
let steamMode = 'time'; // 'time' or 'flow'
let steamTimePresets = [15, 30, 45, 60];
let steamFlowPresets = [0.5, 1.0, 1.5, 2.0];

export function flashPlusMinusButton(button) {
    const offColor = getComputedStyle(document.documentElement).getPropertyValue('--plus-minus-flash-off-color');
    button.style.backgroundColor = 'var(--plus-minus-flash-on-color2)';
    setTimeout(() => {
        button.style.backgroundColor = 'var(--plus-minus-flash-on-color)';
    }, 40);
    setTimeout(() => {
        button.style.backgroundColor = 'var(--plus-minus-flash-on-color2)';
    }, 200);
    setTimeout(() => {
        button.style.backgroundColor = offColor;
    }, 280);
}

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
        doseInEl.textContent = `${doseIn}g`;
    }
    if (drinkOutEl) {
        drinkOutEl.textContent = `${drinkOut}g`;
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
        input.name = element.id; // Recommended for accessibility and autofill

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
        volEl.classList.remove('text-xs', 'text-gray-500');
        volEl.classList.add('text-lg', 'font-bold');
        tempEl.classList.remove('text-lg', 'font-bold');
        tempEl.classList.add('text-xs', 'text-gray-500');
        modeVolEl.className = 'text-[var(--mimoja-blue-v2)]';
        modeTempEl.className = 'text-[var(--low-contrast-white)]';
    } else { // temperature mode
        tempEl.classList.remove('text-xs', 'text-gray-500');
        tempEl.classList.add('text-lg', 'font-bold');
        volEl.classList.remove('text-lg', 'font-bold');
        volEl.classList.add('text-xs', 'text-gray-500');
        modeTempEl.className = 'text-[var(--mimoja-blue-v2)]';
        modeVolEl.className = 'text-[var(--low-contrast-white)]';
    }
}

function incrementHotWater() {
    if (hotWaterMode === 'volume') {
        if (currentHotWaterVolume < 255) {
            currentHotWaterVolume += 5;
            if (currentHotWaterVolume > 255) currentHotWaterVolume = 255; // cap at max
            setTargetHotWaterVolume(currentHotWaterVolume).catch(e => logger.error(e));
        }
    } else {
        if (currentHotWaterTemp < 100) {
            currentHotWaterTemp += 1;
            setTargetHotWaterTemp(currentHotWaterTemp).catch(e => logger.error(e));
        }
    }
    updateHotWaterDisplay({ targetHotWaterVolume: currentHotWaterVolume, targetHotWaterTemp: currentHotWaterTemp });
}

function decrementHotWater() {
    if (hotWaterMode === 'volume') {
        if (currentHotWaterVolume > 3) {
            currentHotWaterVolume -= 5;
            if (currentHotWaterVolume < 3) currentHotWaterVolume = 3; // cap at min
            setTargetHotWaterVolume(currentHotWaterVolume).catch(e => logger.error(e));
        }
    }
    else {
        if (currentHotWaterTemp > 0) {
            currentHotWaterTemp -= 1;
            setTargetHotWaterTemp(currentHotWaterTemp).catch(e => logger.error(e));
        }
    }
    updateHotWaterDisplay({ targetHotWaterVolume: currentHotWaterVolume, targetHotWaterTemp: currentHotWaterTemp });
}

function updateHotWaterPresetDisplay() {
    const presetContainer = document.getElementById('hotwater-presets');
    if (!presetContainer) return;

    const presets = hotWaterMode === 'temperature' ? hotWaterTempPresets : hotWaterVolPresets;
    const unit = hotWaterMode === 'temperature' ? '°c' : 'ml';

    Array.from(presetContainer.children).forEach((button, index) => {
        if (presets[index] !== undefined) {
            button.textContent = `${presets[index]}${unit}`;
        }
    });
}

function toggleHotWaterMode() {
    hotWaterMode = hotWaterMode === 'volume' ? 'temperature' : 'volume';
    logger.info(`Hot water mode switched to: ${hotWaterMode}`);
    updateHotWaterDisplay({ targetHotWaterVolume: currentHotWaterVolume, targetHotWaterTemp: currentHotWaterTemp });
    updateHotWaterPresetDisplay();
}

function setupValueAdjuster(minusBtnId, plusBtnId, valueElId, step, min, formatter, onUpdate) {
    const minusBtn = document.getElementById(minusBtnId);
    const plusBtn = document.getElementById(plusBtnId);
    const valueEl = document.getElementById(valueElId);

    if (!minusBtn || !plusBtn || !valueEl) return;

    minusBtn.addEventListener('click', (e) => {
        flashPlusMinusButton(e.currentTarget);
        let currentValue = parseFloat(valueEl.textContent);
        if (currentValue > min) {
            currentValue -= step;
            valueEl.textContent = formatter(currentValue);
            onUpdate(currentValue);
        }
    });

    plusBtn.addEventListener('click', (e) => {
        flashPlusMinusButton(e.currentTarget);
        let currentValue = parseFloat(valueEl.textContent);
        currentValue += step;
        valueEl.textContent = formatter(currentValue);
        onUpdate(currentValue);
    });
}

function setupPressAndHold(element, clickCallback, longPressCallback) {
    let timer;
    let longPressOccurred = false;

    element.addEventListener('mousedown', (e) => {
        e.preventDefault();
        longPressOccurred = false;
        timer = setTimeout(() => {
            longPressOccurred = true;
            longPressCallback();
        }, 1000); // 1 second for long press
    });

    element.addEventListener('mouseup', () => {
        clearTimeout(timer);
        if (!longPressOccurred) {
            clickCallback();
        }
    });

    element.addEventListener('mouseleave', () => {
        clearTimeout(timer);
    });
}

function flashElement(element) {
    if (element) {
        element.classList.add('flash');
        setTimeout(() => {
            element.classList.remove('flash');
        }, 300); // 300ms flash duration
    }
}

export function updateSteamDisplay(data) {
    const durationEl = document.getElementById('steam-duration-value');
    const flowEl = document.getElementById('steam-flow-value');
    const modeTimeEl = document.getElementById('steam-mode-time');
    const modeFlowEl = document.getElementById('steam-mode-flow');

    if (!durationEl || !flowEl || !modeTimeEl || !modeFlowEl) return;

    if (data.targetSteamDuration !== undefined) {
        currentSteamDuration = data.targetSteamDuration;
    }
    if (data.targetSteamFlow !== undefined) {
        currentSteamFlow = data.targetSteamFlow;
    }

    durationEl.textContent = `${currentSteamDuration}s`;
    flowEl.textContent = `${currentSteamFlow.toFixed(1)}ml/s`;

    if (steamMode === 'time') {
        durationEl.classList.remove('text-xs', 'text-gray-500');
        durationEl.classList.add('text-lg', 'font-bold');
        flowEl.classList.remove('text-lg', 'font-bold');
        flowEl.classList.add('text-xs', 'text-gray-500');
        modeTimeEl.className = 'text-[var(--mimoja-blue-v2)]';
        modeFlowEl.className = 'text-[var(--low-contrast-white)]';
    } else { // flow mode
        flowEl.classList.remove('text-xs', 'text-gray-500');
        flowEl.classList.add('text-lg', 'font-bold');
        durationEl.classList.remove('text-lg', 'font-bold');
        durationEl.classList.add('text-xs', 'text-gray-500');
        modeFlowEl.className = 'text-[var(--mimoja-blue-v2)]';
        modeTimeEl.className = 'text-[var(--low-contrast-white)]';
    }
}

function incrementSteam() {
    if (steamMode === 'time') {
        currentSteamDuration += 1;
        setTargetSteamDuration(currentSteamDuration).catch(e => logger.error(e));
    } else {
        if (currentSteamFlow < 2.5) {
            currentSteamFlow += 0.1;
            setTargetSteamFlow(currentSteamFlow).catch(e => logger.error(e));
        }
    }
    updateSteamDisplay({ targetSteamDuration: currentSteamDuration, targetSteamFlow: currentSteamFlow });
}

function decrementSteam() {
    if (steamMode === 'time') {
        if (currentSteamDuration > 0) {
            currentSteamDuration -= 1;
            setTargetSteamDuration(currentSteamDuration).catch(e => logger.error(e));
        }
    } else {
        if (currentSteamFlow > 0.4) {
            currentSteamFlow -= 0.1;
            setTargetSteamFlow(currentSteamFlow).catch(e => logger.error(e));
        }
    }
    updateSteamDisplay({ targetSteamDuration: currentSteamDuration, targetSteamFlow: currentSteamFlow });
}

function updateSteamPresetDisplay() {
    const timePresetContainer = document.getElementById('steam-presets');
    const flowPresetContainer = document.getElementById('steam-flow-presets');
    if (!timePresetContainer || !flowPresetContainer) return;

    if (steamMode === 'flow') {
        timePresetContainer.classList.add('hidden');
        flowPresetContainer.classList.remove('hidden');
        const presets = steamFlowPresets;
        Array.from(flowPresetContainer.children).forEach((button, index) => {
            if (presets[index] !== undefined) {
                button.textContent = `${presets[index].toFixed(1)}`;
            }
        });
    } else { // time mode
        timePresetContainer.classList.remove('hidden');
        flowPresetContainer.classList.add('hidden');
        const presets = steamTimePresets;
        const unit = 's';
        Array.from(timePresetContainer.children).forEach((button, index) => {
            if (presets[index] !== undefined) {
                button.textContent = `${presets[index]}${unit}`;
            }
        });
    }
}

function toggleSteamMode() {
    steamMode = steamMode === 'time' ? 'flow' : 'time';
    logger.info(`Steam mode switched to: ${steamMode}`);
    updateSteamDisplay({ targetSteamDuration: currentSteamDuration, targetSteamFlow: currentSteamFlow });
    updateSteamPresetDisplay();
}

export function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeToggle.checked = currentTheme === 'dark';

    themeToggle.addEventListener('change', function() {
        const theme = this.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        chart.setTheme(theme);
    });
}

export function initUI() {
    initThemeToggle();
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
    const flushPresets = document.getElementById('flush-presets');
    const flushValueEl = document.getElementById('flush-value');
    const hotwaterPresets = document.getElementById('hotwater-presets');
    const steamMinusBtn = document.getElementById('steam-minus');
    const steamPlusBtn = document.getElementById('steam-plus');
    const steamModeToggle = document.getElementById('steam-mode-toggle');
    const steamPresets = document.getElementById('steam-presets');
    const steamFlowPresetsEl = document.getElementById('steam-flow-presets');

    if (tempPresets) {
        for (const button of tempPresets.children) {
            const clickCallback = () => {
                const newValue = parseFloat(button.textContent);
                if (isNaN(newValue)) return;

                updateTemperatureValue(newValue);
                updateTemperatureDisplay(newValue);

                // Update preset styles
                for (const btn of tempPresets.children) {
                    btn.classList.remove('text-black');
                    btn.classList.add('text-gray-400');
                }
                button.classList.remove('text-gray-400');
                button.classList.add('text-black');
                
                flashElement(document.getElementById('temp-value'));
            };

            const longPressCallback = () => {
                const tempValueEl = document.getElementById('temp-value');
                button.textContent = tempValueEl.textContent;
                flashElement(button);
                flashElement(tempValueEl);
            };

            setupPressAndHold(button, clickCallback, longPressCallback);
        }
    }

    if (drinkOutPresets) {
        for (const button of drinkOutPresets.children) {
            const clickCallback = () => {
                const [doseInStr, drinkOutStr] = button.textContent.split(':');
                const newDoseIn = parseFloat(doseInStr);
                const newDrinkOut = parseFloat(drinkOutStr);

                if (!isNaN(newDoseIn) && !isNaN(newDrinkOut)) {
                    updateDoseAndDrinkOutValue(newDoseIn, newDrinkOut);
                    updateDrinkOutPresetsDisplay(newDoseIn, newDrinkOut);
                    flashElement(document.getElementById('dose-in-value'));
                    flashElement(document.getElementById('drink-out-value'));

                    // Update preset styles
                    for (const btn of drinkOutPresets.children) {
                        btn.classList.remove('text-black');
                        btn.classList.add('text-gray-400');
                    }
                    button.classList.remove('text-gray-400');
                    button.classList.add('text-black');
                }
            };

            const longPressCallback = () => {
                const doseInValue = parseFloat(document.getElementById('dose-in-value').textContent);
                const drinkOutValue = parseFloat(document.getElementById('drink-out-value').textContent);
                button.textContent = `${doseInValue}:${drinkOutValue}`;

                flashElement(button);
                flashElement(document.getElementById('dose-in-value'));
                flashElement(document.getElementById('drink-out-value'));
            };

            setupPressAndHold(button, clickCallback, longPressCallback);
        }
    }

    if (flushPresets) {
        for (const button of flushPresets.children) {
            const clickCallback = () => {
                const newValue = parseFloat(button.textContent);
                if (isNaN(newValue)) return;

                setDe1Settings({ flushTimeout: newValue }).catch(e => logger.error(e));
                updateFlushDisplay(newValue);

                // Update preset styles
                for (const btn of flushPresets.children) {
                    btn.classList.remove('text-black');
                    btn.classList.add('text-gray-400');
                }
                button.classList.remove('text-gray-400');
                button.classList.add('text-black');
                flashElement(document.getElementById('flush-value'));

            };

            const longPressCallback = () => {
                const flushValueEl = document.getElementById('flush-value');
                button.textContent = flushValueEl.textContent;
                flashElement(button);
                flashElement(flushValueEl);
            };

            setupPressAndHold(button, clickCallback, longPressCallback);
        }
    }

    if (hotwaterPresets) {
        // Initial display update
        updateHotWaterPresetDisplay();

        Array.from(hotwaterPresets.children).forEach((button, index) => {
            const clickCallback = () => {
                const isTempMode = hotWaterMode === 'temperature';
                const presets = isTempMode ? hotWaterTempPresets : hotWaterVolPresets;
                const newValue = presets[index];

                if (newValue === undefined) return;

                if (isTempMode) {
                    setTargetHotWaterTemp(newValue).catch(e => logger.error(e));
                    updateHotWaterDisplay({ targetHotWaterTemp: newValue });
                   
                    flashElement(document.getElementById('hot-water-temp-value'));

                } else {
                    setTargetHotWaterVolume(newValue).catch(e => logger.error(e));
                    updateHotWaterDisplay({ targetHotWaterVolume: newValue });
                    flashElement(document.getElementById("hot-water-vol-value"));
                }

                // Update preset styles
                for (const btn of hotwaterPresets.children) {
                    btn.classList.remove('text-black');
                    btn.classList.add('text-gray-400');
                }
                button.classList.remove('text-gray-400');
                button.classList.add('text-black');
                
            };

            const longPressCallback = () => {
                const isTempMode = hotWaterMode === 'temperature';
                const valueEl = document.getElementById(isTempMode ? 'hot-water-temp-value' : 'hot-water-vol-value');
                const currentValue = parseFloat(valueEl.textContent);

                if (!isNaN(currentValue)) {
                    if (isTempMode) {
                        hotWaterTempPresets[index] = currentValue;
                    } else {
                        hotWaterVolPresets[index] = currentValue;
                    }
                    updateHotWaterPresetDisplay(); // Refresh button text
                    flashElement(button);
                    flashElement(valueEl);
                }
            };

            setupPressAndHold(button, clickCallback, longPressCallback);
        });
    }

    if (steamPresets) {
        updateSteamPresetDisplay();

        Array.from(steamPresets.children).forEach((button, index) => {
            const clickCallback = () => {
                const newValue = steamTimePresets[index];
                if (newValue === undefined) return;

                setTargetSteamDuration(newValue).catch(e => logger.error(e));
                updateSteamDisplay({ targetSteamDuration: newValue });

                for (const btn of steamPresets.children) {
                    btn.classList.remove('text-black');
                    btn.classList.add('text-gray-400');
                }
                button.classList.remove('text-gray-400');
                button.classList.add('text-black');
                flashElement(document.getElementById('steam-duration-value'));

            };

            const longPressCallback = () => {
                const valueEl = document.getElementById('steam-duration-value');
                const currentValue = parseFloat(valueEl.textContent);
                if (!isNaN(currentValue)) {
                    steamTimePresets[index] = currentValue;
                    updateSteamPresetDisplay();
                    flashElement(button);
                    flashElement(valueEl);
                }
            };

            setupPressAndHold(button, clickCallback, longPressCallback);
        });
    }

    if (steamFlowPresetsEl) {
        updateSteamPresetDisplay();

        Array.from(steamFlowPresetsEl.children).forEach((button, index) => {
            const clickCallback = () => {
                const newValue = steamFlowPresets[index];
                if (newValue === undefined) return;

                setTargetSteamFlow(newValue).catch(e => logger.error(e));
                updateSteamDisplay({ targetSteamFlow: newValue });

                for (const btn of steamFlowPresetsEl.children) {
                    btn.classList.remove('text-black');
                    btn.classList.add('text-gray-400');
                }
                button.classList.remove('text-gray-400');
                button.classList.add('text-black');
                flashElement(document.getElementById('steam-flow-value'));

            };

            const longPressCallback = () => {
                const valueEl = document.getElementById('steam-flow-value');
                const currentValue = parseFloat(valueEl.textContent);
                if (!isNaN(currentValue)) {
                    steamFlowPresets[index] = currentValue;
                    updateSteamPresetDisplay();
                    flashElement(button);
                    flashElement(valueEl);
                }
            };

            setupPressAndHold(button, clickCallback, longPressCallback);
        });
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
            let value = newValue;
            if (value > 255) {
                alert('Hot water volume is limited to 255 ml.');
                value = 255;
            }
            if (value < 3) {
                alert('Hot water volume must be at least 3 ml.');
                value = 3;
            }
            currentHotWaterVolume = value;
            setTargetHotWaterVolume(currentHotWaterVolume).catch(e => logger.error(e));
            updateHotWaterDisplay({ targetHotWaterVolume: currentHotWaterVolume });
        });
    }

    if (hotWaterTempValueEl) {
        makeEditable(hotWaterTempValueEl, (newValue) => {
            let value = newValue;
            if (value > 100) {
                alert('Hot water temperature is limited to 100°C.');
                value = 100;
            }
            if (value < 0) {
                alert('Hot water temperature must be at least 0°C.');
                value = 0;
            }
            currentHotWaterTemp = value;
            setTargetHotWaterTemp(currentHotWaterTemp).catch(e => logger.error(e));
            updateHotWaterDisplay({ targetHotWaterTemp: currentHotWaterTemp });
        });
    }

    if (flushValueEl) {
        makeEditable(flushValueEl, (newValue) => {
            flushValueEl.textContent = `${newValue}s`;
            setDe1Settings({ flushTimeout: newValue }).catch(e => logger.error(e));
            updateFlushDisplay(newValue);
        });
    }

    const steamDurationValueEl = document.getElementById('steam-duration-value');
    if (steamDurationValueEl) {
        makeEditable(steamDurationValueEl, (newValue) => {
            currentSteamDuration = newValue;
            setTargetSteamDuration(currentSteamDuration).catch(e => logger.error(e));
        });
    }

    const steamFlowValueEl = document.getElementById('steam-flow-value');
    if (steamFlowValueEl) {
        makeEditable(steamFlowValueEl, (newValue) => {
            let value = newValue;
            if (value > 2.5) {
                alert('Steam flow is limited to 2.5 ml/s.');
                value = 2.5;
            }
            if (value < 0.4) {
                alert('Steam flow must be at least 0.4 ml/s.');
                value = 0.4;
            }
            currentSteamFlow = value;
            setTargetSteamFlow(currentSteamFlow).catch(e => logger.error(e));
            updateSteamDisplay({ targetSteamFlow: currentSteamFlow });
        });
    }

    setupValueAdjuster('drink-out-minus', 'drink-out-plus', 'drink-out-value', 1, 0, (val) => `${val}g`, (val) => { updateDoseValue('out', val); updateDrinkRatio(); });
    setupValueAdjuster('temp-minus', 'temp-plus', 'temp-value', 1, 0, (val) => `${val}°c`, updateTemperatureValue);
    setupValueAdjuster('dose-in-minus', 'dose-in-plus', 'dose-in-value', 1, 0, (val) => `${val}g`, (val) => { updateDoseValue('in', val); updateDrinkRatio(); });
    setupValueAdjuster('grind-minus', 'grind-plus', 'grind-value', 0.1, 0, (val) => val.toFixed(1), updateGrindValue);
    setupValueAdjuster('flush-minus', 'flush-plus', 'flush-value', 1, 0, (val) => `${val}s`, (val) => { setDe1Settings({ flushTimeout: val }).catch(e => logger.error(e)); updateFlushDisplay(val); });

    if (hotWaterMinusBtn) {
        hotWaterMinusBtn.addEventListener('click', decrementHotWater);
    }

    if (hotWaterPlusBtn) {
        hotWaterPlusBtn.addEventListener('click', incrementHotWater);
    }

    if (hotWaterModeToggle) {
        hotWaterModeToggle.addEventListener('click', toggleHotWaterMode);
    }

    if (steamMinusBtn) {
        steamMinusBtn.addEventListener('click', decrementSteam);
    }

    if (steamPlusBtn) {
        steamPlusBtn.addEventListener('click', incrementSteam);
    }

    if (steamModeToggle) {
        steamModeToggle.addEventListener('click', toggleSteamMode);
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
         if (status === '"Error"') {
            machineStatusEl.classList.remove('text-[var(--green)]');
            machineStatusEl.classList.add('text-red-500');
        }
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

export function updateFlushDisplay(duration) {
    const flushValueEl = document.getElementById('flush-value');
    if (flushValueEl) {
        flushValueEl.textContent = `${parseFloat(duration).toFixed(0)}s`;
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