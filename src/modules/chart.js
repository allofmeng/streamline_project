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

const lightLayout = {
    plot_bgcolor: 'white',
    paper_bgcolor: 'white',
    font: { color: 'black' },
    xaxis: { 
        gridcolor: '#e0e0e0',
        title: { text: 'Time (s)' }
    },
    yaxis: { 
        gridcolor: '#e0e0e0',
        title: { text: 'Pressure (bar)' }
    },
    yaxis2: {
        title: 'Flow (ml/s)',
        overlaying: 'y',
        side: 'right'
    },
    autosize: true,
    margin: {
        autoexpand: true,
        l: 50,
        r: 25,
        t: 20,
        b: 40,
        pad: 0
    },
    showlegend: true,
    legend: {
        x: 0.01,
        xanchor: 'left',
        y: 0.9,
        yanchor: 'top',
        bgcolor: 'transparent'
    }
};

const darkLayout = {
    plot_bgcolor: '#101217',
    paper_bgcolor: '#101217',
    font: { color: '#e8e8e8' },
    xaxis: { 
        gridcolor: '#444',
        title: { text: 'Time (s)' }
    },
    yaxis: { 
        gridcolor: '#444',
        title: { text: 'Pressure (bar)' }
    },
    yaxis2: {
        title: 'Flow (ml/s)',
        overlaying: 'y',
        side: 'right',
        font: { color: '#e8e8e8' },
        gridcolor: '#444'
    },
    autosize: true,
    margin: {
        autoexpand: true,
        l: 50,
        r: 25,
        t: 20,
        b: 40,
        pad: 0
    },
    showlegend: true,
    legend: {
        x: 0.01,
        xanchor: 'left',
        y: 0.9,
        yanchor: 'top',
        bgcolor: 'transparent'
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

    const theme = localStorage.getItem('theme') || 'light';
    const layout = theme === 'dark' ? darkLayout : lightLayout;
    Plotly.update(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
}

export function clearChart() {
    for (const trace in chartData) {
        chartData[trace].x = [];
        chartData[trace].y = [];
    }
    const theme = localStorage.getItem('theme') || 'light';
    const layout = theme === 'dark' ? darkLayout : lightLayout;
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
    Plotly.react(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
}

export function initChart() {
    const theme = localStorage.getItem('theme') || 'light';
    const layout = theme === 'dark' ? darkLayout : lightLayout;
    Plotly.newPlot(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
    window.addEventListener('resize', () => {
        Plotly.Plots.resize(chartElement);
    });
}

export function setTheme(theme) {
    const layoutUpdate = theme === 'dark' ? darkLayout : lightLayout;
    const data = [
        chartData.pressure,
        chartData.flow,
        chartData.targetPressure,
        chartData.targetFlow,
        chartData.groupTemperature
    ];
    Plotly.react(chartElement, data, layoutUpdate);
}
