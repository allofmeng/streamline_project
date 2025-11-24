import { connectWebSocket } from './api.js';

const chartElement = document.getElementById('plotly-chart');

const chartData = {
    pressure: {
        x: [],
        y: [],
        name: 'Pressure',
        type: 'scatter',
        line: { color: '#17c29a' },
        hoverinfo: 'name'
    },
    flow: {
        x: [],
        y: [],
        name: 'Flow',
        type: 'scatter',
        line: { color: '#0358cf' },
        hoverinfo: 'name'
    },
    targetPressure: {
        x: [],
        y: [],
        name: 'Target Pressure',
        type: 'scatter',
        line: { color: '#17c29a', dash: 'dot' },
        hoverinfo: 'name'
    },
    targetFlow: {
        x: [],
        y: [],
        name: 'Target Flow',
        type: 'scatter',
        line: { color: '#0358cf', dash: 'dot' },
        hoverinfo: 'name'
    },
    groupTemperature: {
        x: [],
        y: [],
        name: 'Group Temp',
        type: 'scatter',
        line: {color: '#ff97a1'},
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
        r: 20,
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
        r: 20,
        t: 20,
        b: 40,
        pad: 0
    },
    showlegend: false,
};

function getAnnotations() {
    const annotations = [];
    for (const traceName in chartData) {
        if (traceName === 'targetPressure' || traceName === 'targetFlow') {
            continue;
        }
        const trace = chartData[traceName];
        if (trace.x.length > 0) {
            annotations.push({
                x: trace.x[trace.x.length - 1],
                y: trace.y[trace.y.length - 1],
                xref: 'x',
                yref: trace.yaxis || 'y',
                text: trace.name,
                showarrow: false,
                xanchor: 'left',
                yanchor: 'top',
                xshift: 5,
                yshift: 5,
                font: {
                    color: trace.line.color
                }
            });
        }
    }
    return annotations;
}

export function updateChart(shotStartTime, data, filterToPouring) {
    const time = (new Date(data.timestamp) - shotStartTime) / 1000;
    console.log("updatechart functio called");

    if (filterToPouring) {
        if (data.state.substate !== 'pouring' && data.state.substate !== 'pouringDone') {
            return;
        }
    }

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

    const theme = localStorage.getItem('theme') || 'light';
    const layout = JSON.parse(JSON.stringify(theme === 'dark' ? darkLayout : lightLayout));

    const currentXRange = chartElement.layout.xaxis.range;
    if (time > currentXRange[1]) {
        layout.xaxis.range = [currentXRange[0], time + 2];
    } else {
        layout.xaxis.range = currentXRange;
    }
    layout.yaxis.range = chartElement.layout.yaxis.range;

    layout.annotations = getAnnotations();
    Plotly.update(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
}

export function clearChart() {
    for (const trace in chartData) {
        chartData[trace].x = [];
        chartData[trace].y = [];
    }
    const theme = localStorage.getItem('theme') || 'light';
    const layout = theme === 'dark' ? darkLayout : lightLayout;
    layout.annotations = [];
    layout.xaxis.range = [0, 10];
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

    const theme = localStorage.getItem('theme') || 'light';
    const layout = theme === 'dark' ? darkLayout : lightLayout;
    layout.annotations = getAnnotations();
    Plotly.react(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
}

export function initChart() {
    const theme = localStorage.getItem('theme') || 'light';
    const layout = theme === 'dark' ? darkLayout : lightLayout;
    layout.annotations = [];
    Plotly.newPlot(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
    window.addEventListener('resize', () => {
        Plotly.Plots.resize(chartElement);
    });
}

export function setTheme(theme) {
    const layoutUpdate = theme === 'dark' ? darkLayout : lightLayout;
    layoutUpdate.annotations = getAnnotations();
    const data = [
        chartData.pressure,
        chartData.flow,
        chartData.targetPressure,
        chartData.targetFlow,
        chartData.groupTemperature
    ];
    Plotly.react(chartElement, data, layoutUpdate);
}
