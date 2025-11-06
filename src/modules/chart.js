import { connectWebSocket } from './api.js';

const chartElement = document.getElementById('plotly-chart');

const chartData = {
    pressure: {
        x: [],
        y: [],
        name: 'Pressure',
        type: 'scatter',
        line: { color: '#17C29A' }
    },
    flow: {
        x: [],
        y: [],
        name: 'Flow',
        type: 'scatter',
        line: { color: '#385A92' }
    },
    targetPressure: {
        x: [],
        y: [],
        name: 'Target Pressure',
        type: 'scatter',
        line: { color: '#17C29A', dash: 'dot' }
    },
    targetFlow: {
        x: [],
        y: [],
        name: 'Target Flow',
        type: 'scatter',
        line: { color: '#385A92', dash: 'dot' }
    },
    groupTemperature: {
        x: [],
        y: [],
        name: 'Group Temp',
        type: 'scatter',
        line: {color: 'red'}
    }
};

const layout = {
    title: 'Pressure, Flow and Temperature',
    xaxis: {title: 'Time (s)', dtick: 1,showgrid: true},
    yaxis: {title: 'Pressure (bar) / Flow (ml/s) / Temp (°C/10)',showgrid: true},
    autosize: true,
    margin: {
        
        pad: 4
    }
};

export function updateChart(shotStartTime, data) {
    const time = (new Date(data.timestamp) - shotStartTime) / 1000;
    console.log("updatechart functio called");
    chartData.pressure.x.push(time);
    chartData.pressure.y.push(data.pressure);
    chartData.flow.x.push(time);
    chartData.flow.y.push(data.flow);
    chartData.targetPressure.x.push(time);
    chartData.targetPressure.y.push(data.targetPressure);
    chartData.targetFlow.x.push(time);
    chartData.targetFlow.y.push(data.targetFlow);
    chartData.groupTemperature.x.push(time);
    chartData.groupTemperature.y.push(data.groupTemperature / 10);

    Plotly.update(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
}

export function clearChart() {
    for (const trace in chartData) {
        chartData[trace].x = [];
        chartData[trace].y = [];
    }
    // removeProfileOverlay(); // This should be handled in app.js
    Plotly.react(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
}

export function plotHistoricalShot(measurements) {
    if (!measurements || measurements.length === 0) {
        return;
    }

    clearChart();

    const shotStartTime = new Date(measurements[0].machine.timestamp);

    const tempChartData = {
        pressure: { x: [], y: [] },
        flow: { x: [], y: [] },
        targetPressure: { x: [], y: [] },
        targetFlow: { x: [], y: [] },
        groupTemperature: { x: [], y: [] },
    };

    measurements.forEach(dataPoint => {
        const machineData = dataPoint.machine;
        if (machineData) {
            const time = (new Date(machineData.timestamp) - shotStartTime) / 1000;
            tempChartData.pressure.x.push(time);
            tempChartData.pressure.y.push(machineData.pressure);
            tempChartData.flow.x.push(time);
            tempChartData.flow.y.push(machineData.flow);
            tempChartData.targetPressure.x.push(time);
            tempChartData.targetPressure.y.push(machineData.targetPressure);
            tempChartData.targetFlow.x.push(time);
            tempChartData.targetFlow.y.push(machineData.targetFlow);
            tempChartData.groupTemperature.x.push(time);
            tempChartData.groupTemperature.y.push(machineData.groupTemperature / 10);
        }
    });

    chartData.pressure.x = tempChartData.pressure.x;
    chartData.pressure.y = tempChartData.pressure.y;
    chartData.flow.x = tempChartData.flow.x;
    chartData.flow.y = tempChartData.flow.y;
    chartData.targetPressure.x = tempChartData.targetPressure.x;
    chartData.targetPressure.y = tempChartData.targetPressure.y;
    chartData.targetFlow.x = tempChartData.targetFlow.x;
    chartData.targetFlow.y = tempChartData.targetFlow.y;
    chartData.groupTemperature.x = tempChartData.groupTemperature.x;
    chartData.groupTemperature.y = tempChartData.groupTemperature.y;

    Plotly.react(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
}

export function initChart() {
    Plotly.newPlot(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
    window.addEventListener('resize', () => {
        Plotly.Plots.resize(chartElement);
    });
}
