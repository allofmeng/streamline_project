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
    },
    weight: {
        x: [],
        y: [],
        name: 'Weight',
        type: 'scatter',
        line: { color: '#e9d3c3' }, // light mode
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

function getAnnotations() {
    const annotations = [];
    for (const traceName in chartData) {
        if (traceName === 'targetPressure' || traceName === 'targetFlow' ) {
            continue;
        }
        const trace = chartData[traceName];
        if (trace.x.length > 0) {
            annotations.push({
                x: trace.x[trace.x.length - 1],
                y: trace.y[trace.y.length - 1],
                xref: 'x',
                yref: 'y',
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

    if (filterToPouring) {
        if (data.state.substate !== 'pouring' && data.state.substate !== 'pouringDone') {
            return;
        }
    }

    const pressureY = data.pressure;
    const flowY = data.flow;
    const targetPressureY = data.targetPressure;
    const targetFlowY = data.targetFlow;
    const groupTemperatureY = (data.groupTemperature / 100) * 10;

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

    Plotly.extendTraces(chartElement, {
        x: [[time], [time], [time], [time], [time]],
        y: [[pressureY], [flowY], [targetPressureY], [targetFlowY], [groupTemperatureY]]
    }, [0, 1, 2, 3, 4]);

    Plotly.relayout(chartElement, { annotations: getAnnotations() });
}

export function updateWeight(shotStartTime, weight) {
    if (!shotStartTime) {
        return;
    }
    const time = (Date.now() - shotStartTime) / 1000;
    const weightY = weight / 10;

    chartData.weight.x.push(time);
    chartData.weight.y.push(weightY);
    
    Plotly.extendTraces(chartElement, {
        x: [[time]],
        y: [[weightY]]
    }, [5]);

    Plotly.relayout(chartElement, { annotations: getAnnotations() });
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
    Plotly.react(chartElement, Object.values(chartData), layout);
}

export function plotHistoricalShot(measurements) {
    if (!measurements || measurements.length === 0) {
        return;
    }

    clearChart();

    let shotStartTime = null;
    if (measurements[0].machine) {
        shotStartTime = new Date(measurements[0].machine.timestamp);
    }

    const tempChartData = {
        pressure: { x: [], y: [] },
        flow: { x: [], y: [] },
        targetPressure: { x: [], y: [] },
        targetFlow: { x: [], y: [] },
        groupTemperature: { x: [], y: [] },
        weight: { x: [], y: [] }
    };

    measurements.forEach(dataPoint => {
        const machineData = dataPoint.machine;
        const scaleData = dataPoint.scale;

        if(machineData && !shotStartTime) {
            shotStartTime = new Date(machineData.timestamp);
        }
        if(scaleData && scaleData.timestamp && (!shotStartTime || new Date(scaleData.timestamp) < shotStartTime)) {
            shotStartTime = new Date(scaleData.timestamp);
        }

        if (machineData) {
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
             const time = (new Date(scaleData.timestamp) - shotStartTime) / 1000;
             if (time >= 0) {
                tempChartData.weight.x.push(time);
                tempChartData.weight.y.push(scaleData.weight / 10);
             }
        }
    });

    Object.keys(tempChartData).forEach(key => {
        if(chartData[key]) {
            chartData[key].x = tempChartData[key].x;
            chartData[key].y = tempChartData[key].y;
        }
    }
);

const theme = localStorage.getItem('theme') || 'light';
const layout = theme === 'dark' ? darkLayout : lightLayout;
layout.annotations = getAnnotations();
Plotly.react(chartElement, Object.values(chartData), layout);
}

export function initChart() {
    const theme = localStorage.getItem('theme') || 'light';
    const layout = theme === 'dark' ? darkLayout : lightLayout;
    chartData.weight.line.color = theme === 'dark' ? '#695f57' : '#e9d3c3';
    layout.annotations = getAnnotations();
    Plotly.newPlot(chartElement, Object.values(chartData), layout);
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
