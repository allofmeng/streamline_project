import { connectWebSocket } from './api.js';
import { logger } from './logger.js';

const chartElement = document.getElementById('plotly-chart');
let currentSubstate = 'idle';
let annotationUpdateCounter = 0;
const ANNOTATION_UPDATE_THROTTLE = 10; // Update every 10 data points
let lastWeight = 0;
let lastTime = 0;
const SMOOTHING_FACTOR = 0.1;
let smoothedWeightChange = 0;

const chartData = {
    pressure: {
        x: [],
        y: [],
        name: 'Pressure',
        type: 'lines',
        mode: 'lines',
        line: { color: '#17c29a' },
        hoverinfo: 'name'
    },
    flow: {
        x: [],
        y: [],
        name: 'Flow',
        type: 'lines',
        mode: 'lines',
        line: { color: '#0358cf' },
        hoverinfo: 'name'
    },
    targetPressure: {
        x: [],
        y: [],
        name: 'Target Pressure',
        type: 'lines',
        mode: 'lines',
        line: { color: '#17c29a', dash: 'dot' },
        hoverinfo: 'name'
    },
    targetFlow: {
        x: [],
        y: [],
        name: 'Target Flow',
        type: 'lines',
        mode: 'lines',
        line: { color: '#0358cf', dash: 'dot' },
        hoverinfo: 'name'
    },
    groupTemperature: {
        x: [],
        y: [],
        name: '°C',
        type: 'lines',
        mode: 'lines',
        line: {color: '#ff97a1'},
        hoverinfo: 'name'
    },
    weight: {
        x: [],
        y: [],
        name: 'Weight',
        type: 'lines',
        mode: 'lines',
        line: { color: '#D8BDA8' }, // light mode
        hoverinfo: 'name'
    }
};

const lightLayout = {
    plot_bgcolor: 'white',
    paper_bgcolor: 'white',
    font: { color: 'black' },
    xaxis: { 
        gridcolor: '#E0E0E0',
        dtick: 1
    },
    yaxis: {
        gridcolor: '#E0E0E0',
        range: [0, 10],
        dtick: 1
    },
    autosize: true,
    margin: {
        autoexpand: true,
        l: 50,
        r: 50,
        t: 20,
        b: 40,
        pad: 0
    },
    showlegend: false,
};

const darkLayout = {
    plot_bgcolor: '#0d0e14',
    paper_bgcolor: '#0d0e14',
    font: { color: '#e8e8e8' },
    xaxis: { 
        gridcolor: '#212227',
        dtick: 1
    },
    yaxis: { 
        gridcolor: '#212227',
        range: [0, 10],
        dtick: 1
    },
    autosize: true,
    margin: {
        autoexpand: true,
        l: 50,
        r: 50,
        t: 20,
        b: 40,
        pad: 0
    },
    showlegend: false,
};

const labelColors = {
    light: {
        pressure: '#17c29a',
        flow: '#0358cf',
        groupTemperature: '#ff97a1',
        weight: '#C7A58D'
    },
    dark: {
        pressure: '#17c29a',
        flow: '#0358cf',
        groupTemperature: '#ff97a1',
        weight: '#695f57'
    }
};

function getAnnotations() {
    const theme = localStorage.getItem('theme') || 'light';
    const annotations = [];
    const labelCandidates = [];

    // 1. Collect potential labels
    for (const traceName in chartData) {
        if (traceName === 'targetPressure' || traceName === 'targetFlow') {
            continue;
        }
        const trace = chartData[traceName];
        if (trace.x.length > 0) {
            labelCandidates.push({
                name: trace.name,
                x: trace.x[trace.x.length - 1],
                y: trace.y[trace.y.length - 1],
                color: (labelColors[theme] && labelColors[theme][traceName]) ? labelColors[theme][traceName] : trace.line.color
            });
        }
    }

    // 2. Sort by y-value, ascending
    labelCandidates.sort((a, b) => a.y - b.y);

    let lastY = -Infinity;
    const minVerticalSeparation = 0.4; // Corresponds to y-axis units
    const minAxisBuffer = 0.2; // Minimum distance from x-axis

    // 3. Adjust positions to avoid overlap, moving from bottom up
    for (const candidate of labelCandidates) {
        let finalY = Math.max(candidate.y, minAxisBuffer);
        
        if (lastY !== -Infinity && finalY - lastY < minVerticalSeparation) {
            finalY = lastY + minVerticalSeparation;
        }
        
        annotations.push({
            x: candidate.x,
            y: finalY,
            xref: 'x',
            yref: 'y',
            text: candidate.name,
            showarrow: false,
            xanchor: 'left',
            yanchor: 'middle',
            xshift: 5,
            font: {
                color: candidate.color
            }
        });

        lastY = finalY;
    }

    return annotations;
}

export function updateChart(shotStartTime, data, weight, filterToPouring) {
    if (data && data.state && data.state.substate) { // Add safety check
        currentSubstate = data.state.substate;
    }
    const time = (new Date(data.timestamp) - shotStartTime) / 1000;
    filterToPouring=true;
    if (filterToPouring) {
        if (!(data.state.substate === 'preinfusion' || data.state.substate === 'pouring')) {
            return;
        }
    }
    //&& data.state.substate !== 'pouringDone'
    const pressureY = data.pressure;
    const flowY = data.flow;
    const targetPressureY = data.targetPressure;
    const targetFlowY = data.targetFlow;
    const groupTemperatureY = (data.groupTemperature / 100) * 10;
    
    let weightY = 0;
    if (lastTime > 0 && time > lastTime) {
        const timeDiff = time - lastTime;
        const rawWeightChange = (weight - lastWeight) / timeDiff;
        smoothedWeightChange = (SMOOTHING_FACTOR * rawWeightChange) + (1 - SMOOTHING_FACTOR) * smoothedWeightChange;
        weightY = smoothedWeightChange;
    }
    lastWeight = weight;
    lastTime = time;

    chartData.pressure.x.push(time);
    chartData.pressure.y.push(pressureY);
    chartData.flow.x.push(time);
    chartData.flow.y.push(flowY);
    chartData.targetPressure.x.push(time);
    chartData.targetPressure.y.push(targetPressureY);
    chartData.targetFlow.x.push(time);
    chartData.targetFlow.y.push(targetFlowY);
    chartData.groupTemperature.x.push(time);
    chartData.groupTemperature.y.push(groupTemperatureY);
    chartData.weight.x.push(time);
    chartData.weight.y.push(weightY);

    Plotly.extendTraces(chartElement, {
        x: [[time], [time], [time], [time], [time], [time]],
        y: [[pressureY], [flowY], [targetPressureY], [targetFlowY], [groupTemperatureY], [weightY]]
    }, [0, 1, 2, 3, 4, 5]);
}

export function clearChart() {
    for (const trace in chartData) {
        chartData[trace].x = [];
        chartData[trace].y = [];
    }
    lastWeight = 0;
    lastTime = 0;
    smoothedWeightChange = 0;
    const theme = localStorage.getItem('theme') || 'light';
    const layout = theme === 'dark' ? darkLayout : lightLayout;
    layout.annotations = [];
    layout.xaxis.range = [0, 10];
    Plotly.react(chartElement, Object.values(chartData), layout);
}

export function plotHistoricalShot(measurements) {
    if (!measurements || measurements.length === 0) {
        return;
    }

    clearChart();

    let shotStartTime = null;

    // First, find the timestamp of the first data point that marks the start of the shot (preinfusion or pouring).
    // This will establish t=0 for the x-axis.
    for (const dataPoint of measurements) {
        const machineData = dataPoint.machine;
        if (machineData && machineData.state && (machineData.state.substate === 'preinfusion' || machineData.state.substate === 'pouring' )) {
            shotStartTime = new Date(machineData.timestamp);
            break; // Exit after finding the first relevant data point
        }
    }

    // If no data point marks the beginning of a shot, we can't plot it correctly from t=0.
    // As a fallback, try to find the earliest timestamp available in the data.
    if (!shotStartTime) {
        console.warn("plotHistoricalShot: Could not find a starting data point (preinfusion/pouring) to begin the chart at t=0.");
        const firstPoint = measurements.find(p => (p.machine && p.machine.timestamp) || (p.scale && p.scale.timestamp));
        if (firstPoint) {
            const machineTs = firstPoint.machine && new Date(firstPoint.machine.timestamp);
            const scaleTs = firstPoint.scale && new Date(firstPoint.scale.timestamp);
            shotStartTime = (machineTs && scaleTs) ? (machineTs < scaleTs ? machineTs : scaleTs) : (machineTs || scaleTs);
        } else {
            console.error("plotHistoricalShot: No timestamps found in any measurements.");
            return; // No data to plot.
        }
    }
    
    // Find the shot end time
    let shotEndTime = null;
    for (let i = measurements.length - 1; i >= 0; i--) {
        const machineData = measurements[i].machine;
        if (machineData && machineData.state && (machineData.state.substate === 'preinfusion' || machineData.state.substate === 'pouring' || machineData.state.substate === 'pouringDone')) {
            shotEndTime = new Date(machineData.timestamp);
            break;
        }
    }

    const tempChartData = {
        pressure: { x: [], y: [] },
        flow: { x: [], y: [] },
        targetPressure: { x: [], y: [] },
        targetFlow: { x: [], y: [] },
        groupTemperature: { x: [], y: [] },
        weight: { x: [], y: [] }
    };

    let lastScaleWeight = 0;
    let lastScaleTime = 0;
    let localSmoothedWeightChange = 0;

    measurements.forEach(dataPoint => {
        const machineData = dataPoint.machine;
        const scaleData = dataPoint.scale;

        if (machineData && machineData.state && (machineData.state.substate === 'preinfusion' || machineData.state.substate === 'pouring' || machineData.state.substate === 'pouringDone')) {
            const time = (new Date(machineData.timestamp) - shotStartTime) / 1000;
            if (time >= 0) {
                tempChartData.pressure.x.push(time);
                tempChartData.pressure.y.push(machineData.pressure);
                tempChartData.flow.x.push(time);
                tempChartData.flow.y.push(machineData.flow);
                tempChartData.targetPressure.x.push(time);
                tempChartData.targetPressure.y.push(machineData.targetPressure);
                tempChartData.targetFlow.x.push(time);
                tempChartData.targetFlow.y.push(machineData.targetFlow);
                tempChartData.groupTemperature.x.push(time);
                tempChartData.groupTemperature.y.push((machineData.groupTemperature / 100) * 10);
            }
        }

        if (scaleData && scaleData.weight) {
            const scaleTimestamp = new Date(scaleData.timestamp);
            if (shotEndTime && scaleTimestamp > shotEndTime) {
                return; // Stop processing scale data after the shot has ended
            }
            const time = (scaleTimestamp - shotStartTime) / 1000;
            if (time >= 0) {
                let weightChange = 0;
                if (lastScaleTime > 0 && time > lastScaleTime) {
                    const timeDiff = time - lastScaleTime;
                    const rawWeightChange = (scaleData.weight - lastScaleWeight) / timeDiff;
                    localSmoothedWeightChange = (SMOOTHING_FACTOR * rawWeightChange) + (1 - SMOOTHING_FACTOR) * localSmoothedWeightChange;
                    weightChange = localSmoothedWeightChange;
                }
                tempChartData.weight.x.push(time);
                tempChartData.weight.y.push(weightChange);
                lastScaleWeight = scaleData.weight;
                lastScaleTime = time;
            }
        }
    });

    Object.keys(tempChartData).forEach(key => {
        if(chartData[key]) {
            chartData[key].x = tempChartData[key].x;
            chartData[key].y = tempChartData[key].y;
        }
    });

    const theme = localStorage.getItem('theme') || 'light';
    const layout = theme === 'dark' ? darkLayout : lightLayout;
    layout.annotations = getAnnotations();
    Plotly.react(chartElement, Object.values(chartData), layout, {displayModeBar: false});
}

export function initChart() {
    const theme = localStorage.getItem('theme') || 'light';
    const layout = theme === 'dark' ? darkLayout : lightLayout;
    chartData.weight.line.color = theme === 'dark' ? '#695f57' : '#e9d3c3';
    layout.annotations = getAnnotations();
    Plotly.newPlot(chartElement, Object.values(chartData), layout, {displayModeBar: false});
    window.addEventListener('resize', () => {
        Plotly.Plots.resize(chartElement);
    });
}

export function setTheme(theme) {
    const layoutUpdate = theme === 'dark' ? darkLayout : lightLayout;
    chartData.weight.line.color = theme === 'dark' ? '#695f57' : '#e9d3c3';
    layoutUpdate.annotations = getAnnotations();
    const data = Object.values(chartData);
    Plotly.react(chartElement, data, layoutUpdate);
}
