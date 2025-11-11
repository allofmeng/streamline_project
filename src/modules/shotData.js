import { logger } from './logger.js';

// Holds the raw data for the current shot
let currentShot = {};

// DOM element references
const elements = {
    pi: {
        time: document.getElementById('shot-data-pi-time'),
        weight: document.getElementById('shot-data-pi-weight'),
        volume: document.getElementById('shot-data-pi-volume'),
        temp: document.getElementById('shot-data-pi-temp'),
        flow: document.getElementById('shot-data-pi-flow'),
        pressure: document.getElementById('shot-data-pi-pressure'),
    },
    ex: {
        time: document.getElementById('shot-data-ex-time'),
        weight: document.getElementById('shot-data-ex-weight'),
        volume: document.getElementById('shot-data-ex-volume'),
        temp: document.getElementById('shot-data-ex-temp'),
        flow: document.getElementById('shot-data-ex-flow'),
        pressure: document.getElementById('shot-data-ex-pressure'),
    },
    total: {
        time: document.getElementById('shot-data-total-time'),
        weight: document.getElementById('shot-data-total-weight'),
        volume: document.getElementById('shot-data-total-volume'),
    }
};

// --- UTILITY FUNCTIONS ---
function updateText(element, value) {
    if (element) element.textContent = value;
}

function formatRange(values, precision) {
    if (!values || values.length === 0) return '-';
    const min = Math.min(...values).toFixed(precision);
    const max = Math.max(...values).toFixed(precision);
    if (min === max) return min;
    return `${min}-${max}`;
}

function formatRangeWithPeak(values, precision) {
    if (!values || values.length < 3) {
        return formatRange(values, precision);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const maxIndex = values.indexOf(max);
    const endValue = values[values.length - 1];

    // Check if the peak (max value) is not at the beginning or the end of the phase
    if (maxIndex > 0 && maxIndex < values.length - 1) {
        return `${min.toFixed(precision)}-${max.toFixed(precision)}-${endValue.toFixed(precision)}`;
    } else {
        return `${min.toFixed(precision)}-${max.toFixed(precision)}`;
    }
}

function getPhaseData(dataArray, startIndex, endIndex) {
    return dataArray.slice(startIndex, endIndex + 1);
}

// --- CORE LOGIC ---

export function clearShotData() {
    logger.info('Clearing shot data table.');
    currentShot = {
        timestamps: [],
        pressures: [],
        flows: [],
        weights: [],
        temperatures: [],
        substates: [],
        volumes: [],
        preinfusionEndIndex: -1,
    };

    for (const phase of Object.values(elements)) {
        for (const element of Object.values(phase)) {
            updateText(element, '-');
        }
    }
}

function calculateAndRender(shotData) {
    if (!shotData || !shotData.timestamps || shotData.timestamps.length === 0) {
        logger.warn('calculateAndRender called with invalid or empty shotData. Aborting render.');
        return;
    }

    // --- Calculations ---
    const lastIndex = shotData.timestamps.length - 1;
    const piEndIndex = shotData.preinfusionEndIndex !== -1 ? shotData.preinfusionEndIndex : lastIndex;
    const exStartIndex = shotData.preinfusionEndIndex !== -1 ? shotData.preinfusionEndIndex + 1 : -1;

    const totalTime = (shotData.timestamps[lastIndex] - shotData.timestamps[0]) / 1000;
    const piTime = (shotData.timestamps[piEndIndex] - shotData.timestamps[0]) / 1000;
    const exTime = exStartIndex !== -1 ? (shotData.timestamps[lastIndex] - shotData.timestamps[exStartIndex]) / 1000 : 0;

    const piPressures = getPhaseData(shotData.pressures, 0, piEndIndex);
    const piFlows = getPhaseData(shotData.flows, 0, piEndIndex);
    const piTemps = getPhaseData(shotData.temperatures, 0, piEndIndex);

    const exPressures = exStartIndex !== -1 ? getPhaseData(shotData.pressures, exStartIndex, lastIndex) : [];
    const exFlows = exStartIndex !== -1 ? getPhaseData(shotData.flows, exStartIndex, lastIndex) : [];
    const exTemps = exStartIndex !== -1 ? getPhaseData(shotData.temperatures, exStartIndex, lastIndex) : [];

    const totalWeight = shotData.weights[lastIndex];
    const totalVolume = shotData.volumes[lastIndex] || 0;
    const piWeight = shotData.weights[piEndIndex];
    const piVolume = shotData.volumes[piEndIndex] || 0;
    const exWeight = (totalWeight !== null && piWeight !== null) ? totalWeight - piWeight : null;
    const exVolume = totalVolume - piVolume;

    // --- Rendering ---
    updateText(elements.pi.time, `${piTime.toFixed(1)}s`);
    updateText(elements.pi.weight, piWeight !== null ? `${piWeight.toFixed(1)}g` : 'N/A');
    updateText(elements.pi.volume, `${piVolume.toFixed(0)}`);
    updateText(elements.pi.temp, `${formatRange(piTemps, 0)}°c`);
    updateText(elements.pi.flow, `${formatRange(piFlows, 1)} `);
    updateText(elements.pi.pressure, `${formatRange(piPressures, 1)} bar`);

    if (exTime > 0) {
        updateText(elements.ex.time, `${exTime.toFixed(1)}s`);
        updateText(elements.ex.weight, exWeight !== null ? `${exWeight.toFixed(1)}g` : 'N/A');
        updateText(elements.ex.volume, `${exVolume.toFixed(0)}ml`);
        updateText(elements.ex.temp, `${formatRange(exTemps, 0)}°c`);
        updateText(elements.ex.flow, `${formatRangeWithPeak(exFlows, 1)} `);
        updateText(elements.ex.pressure, `${formatRangeWithPeak(exPressures, 1)} bar`);
    }

    updateText(elements.total.time, `${totalTime.toFixed(1)}s`);
    updateText(elements.total.weight, totalWeight !== null ? `${totalWeight.toFixed(1)}g` : 'N/A');
    updateText(elements.total.volume, `${totalVolume.toFixed(0)}ml`);
}

export function renderPastShot(shotRecord) {
    if (!shotRecord || !shotRecord.measurements) {
        logger.error('Invalid shot record provided to renderPastShot.');
        return;
    }
    clearShotData();
    logger.info('Rendering past shot:', shotRecord.id);

    const pastShotData = {
        timestamps: [],
        pressures: [],
        flows: [],
        weights: [],
        temperatures: [],
        substates: [],
        volumes: [],
        preinfusionEndIndex: -1,
    };

    let accumulatedVolume = 0;
    for (let i = 0; i < shotRecord.measurements.length; i++) {
        const m = shotRecord.measurements[i];
        if (!m.machine) continue; // Only require machine data to proceed

        const timestamp = new Date(m.machine.timestamp).getTime();
        pastShotData.timestamps.push(timestamp);
        pastShotData.pressures.push(m.machine.pressure);
        pastShotData.flows.push(m.machine.flow);
        pastShotData.weights.push(m.scale?.weight ?? null); // Safely access weight, default to null
        pastShotData.temperatures.push(m.machine.mixTemperature);
        pastShotData.substates.push(m.machine.state.substate);

        if (i > 0) {
            const timeDelta = (timestamp - pastShotData.timestamps[i - 1]) / 1000;
            const lastFlow = pastShotData.flows[i - 1];
            accumulatedVolume += lastFlow * timeDelta;
        }
        pastShotData.volumes.push(accumulatedVolume);

        if (m.machine.state.substate === 'pouring' && pastShotData.preinfusionEndIndex === -1) {
            pastShotData.preinfusionEndIndex = i;
        }
    }

    if (pastShotData.timestamps.length === 0 && shotRecord.measurements.length > 0) {
        logger.warn(`Shot record ${shotRecord.id} contains measurements, but none had valid machine data to process.`);
    }

    calculateAndRender(pastShotData);
}

export function updateShotData(de1Data, scaleWeight) {
    if (!currentShot.timestamps) return; // Don't run if not initialized

    const now = new Date(de1Data.timestamp).getTime();
    currentShot.timestamps.push(now);
    currentShot.pressures.push(de1Data.pressure);
    currentShot.flows.push(de1Data.flow);
    currentShot.weights.push(scaleWeight ?? null); // Use null if scaleWeight is undefined
    currentShot.temperatures.push(de1Data.mixTemperature);
    currentShot.substates.push(de1Data.state.substate);

    if (currentShot.timestamps.length > 1) {
        const timeDelta = (now - currentShot.timestamps[currentShot.timestamps.length - 2]) / 1000;
        const lastFlow = currentShot.flows[currentShot.flows.length - 2];
        const volumeDelta = lastFlow * timeDelta;
        const previousVolume = currentShot.volumes[currentShot.volumes.length - 1] || 0;
        currentShot.volumes.push(previousVolume + volumeDelta);
    } else {
        currentShot.volumes.push(0);
    }

    if (de1Data.state.substate === 'pouring' && currentShot.preinfusionEndIndex === -1) {
        currentShot.preinfusionEndIndex = currentShot.timestamps.length - 1;
    }

    calculateAndRender(currentShot);
}
