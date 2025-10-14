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
    xaxis: {title: 'Time (s)', dtick: 1},
    yaxis: {title: 'Pressure (bar) / Flow (ml/s) / Temp (°C/10)'}
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

    Plotly.react(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
}

export function clearChart() {
    for (const trace in chartData) {
        chartData[trace].x = [];
        chartData[trace].y = [];
    }
    // removeProfileOverlay(); // This should be handled in app.js
    Plotly.update(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
}

export function initChart() {
    Plotly.newPlot(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
}
