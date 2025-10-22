
export function initWaterTankSocket() {
    const REA_PORT = 8080;
const API_BASE_URL = `http://${window.location.hostname}:${REA_PORT}/api/v1`;
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const tankVolElement = document.getElementById('data-tank-vol');
    if (!tankVolElement) {
        console.error('Element with id "tank-vol" not found.');
        return;
    }

    const socket = new ReconnectingWebSocket(`${WS_PROTOCOL}//${window.location.hostname}:${REA_PORT}/ws/v1/de1/waterLevels`, [], {
        debug: true,
        reconnectInterval: 3000,
    });

    socket.onopen = function() {
        console.log('Water tank WebSocket connection established.');
    };

    socket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            if (data.currentPercentage !== undefined) {
                const percentage = data.currentPercentage;
                tankVolElement.style.setProperty('--value', percentage);
                tankVolElement.textContent = `${percentage}%`;
            }
        } catch (e) {
            console.error('Error parsing water level data:', e);
        }
    };

    socket.onclose = function(event) {
        console.log('Water tank WebSocket connection closed.', event.reason);
    };

    socket.onerror = function(err) {
        console.error('Water tank WebSocket error. See library logs for details.');
        // location.reload();
    };
}
