const chartElement = document.getElementById('plotly-chart');
const machineState = document.getElementById('machine-status');
const mixTemp = document.getElementById('data-mix-temp');
const groupTemp = document.getElementById('data-group-temp');

let shotStartTime = null;

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

function updateChart(timestamp, pressure, flow, targetPressure, targetFlow, groupTemperature) {
    const time = (new Date(timestamp) - shotStartTime) / 1000;

    chartData.pressure.x.push(time);
    chartData.pressure.y.push(pressure);
    chartData.flow.x.push(time);
    chartData.flow.y.push(flow);
    chartData.targetPressure.x.push(time);
    chartData.targetPressure.y.push(targetPressure);
    chartData.targetFlow.x.push(time);
    chartData.targetFlow.y.push(targetFlow);
    chartData.groupTemperature.x.push(time);
    chartData.groupTemperature.y.push(groupTemperature / 10);

    Plotly.update(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
}

function clearChart() {
            chartData.pressure.x = [];
            chartData.pressure.y = [];
            chartData.flow.x = [];
            chartData.flow.y = [];
            chartData.targetPressure.x = [];
            chartData.targetPressure.y = [];
            chartData.targetFlow.x = [];
            chartData.targetFlow.y = [];
            chartData.groupTemperature.x = [];
            chartData.groupTemperature.y = [];
            removeProfileOverlay();
            Plotly.update(chart, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
        }
function addProfileOverlay() {
            if (profileOverlayExists || !currentProfile || !currentProfile.steps) return;

            const profileTrace = {
                x: [],
                y: [],
                name: 'Profile',
                type: 'scatter',
                mode: 'lines',
                line: {
                    dash: 'dot'
                }
            };

            let currentTime = 0;
            currentProfile.steps.forEach(step => {
                profileTrace.x.push(currentTime);
                profileTrace.y.push(step.value);
                currentTime += step.duration;
                profileTrace.x.push(currentTime);
                profileTrace.y.push(step.value);
            });

            Plotly.addTraces(chart, profileTrace);
            profileOverlayExists = true;
        }

        function removeProfileOverlay() {
            if (!profileOverlayExists) return;
            let traceIndex = -1;
            for(let i=0; i < chart.data.length; i++) {
                if(chart.data[i].name === 'Profile') {
                    traceIndex = i;
                    break;
                }
            }
            if (traceIndex > -1) {
                Plotly.deleteTraces(chart, traceIndex);
            }
            profileOverlayExists = false;
        }
function connectWebSocket() {
    const socket = new WebSocket('ws://localhost:8080/ws/v1/de1/snapshot');

    socket.onopen = () => {
        console.log('WebSocket Connected');
    };

    socket.onclose = () => {
        console.log('WebSocket Disconnected');
    };

    socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const state = data.state.state;

        if (machineState) machineState.textContent = state;
        if (mixTemp) mixTemp.textContent = `${data.mixTemperature.toFixed(1)}°c`;
        if (groupTemp) groupTemp.textContent = `${data.groupTemperature.toFixed(1)}°c`;

        if (['espresso', 'flush', 'steam', 'hotWater'].includes(state)) {
            if (!shotStartTime) {
                shotStartTime = new Date(data.timestamp);
                clearChart();
            }
            updateChart(data.timestamp, data.pressure, data.flow, data.targetPressure, data.targetFlow, data.groupTemperature);
            if (state === 'espresso' && currentProfile) {
                    addProfileOverlay();
                }
        } else {
            shotStartTime = null;
        }
    };
}

export function initChart() {
    Plotly.newPlot(chartElement, [chartData.pressure, chartData.flow, chartData.targetPressure, chartData.targetFlow, chartData.groupTemperature], layout);
    connectWebSocket();
}
