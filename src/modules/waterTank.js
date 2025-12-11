import { REA_PORT, WS_PROTOCOL, API_BASE_URL } from './api.js';
import { logger } from './logger.js';
// Note: This assumes ReconnectingWebSocket is globally available as it is in other files.

export async function setWaterLevelWarning(percentage) {
    try {
        const response = await fetch(`${API_BASE_URL}/de1/waterLevels`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ warningThresholdPercentage: percentage }),
        });

        if (response.status !== 202) {
            const errorBody = await response.text();
            throw new Error(`Failed to set water level warning. Status: ${response.status}, Body: ${errorBody}`);
        }
        logger.info(`Water level warning successfully set to ${percentage}%`);
        return true;
    } catch (error) {
        logger.error('Error setting water level warning:', error);
        throw error; // Re-throw to allow calling code to handle it
    }
}

export function initWaterTankSocket() {
    const tankVolElement = document.getElementById('data-tank-vol');
    if (!tankVolElement) {
        logger.error('Element with id "data-tank-vol" not found.');
        return;
    }

    const socket = new ReconnectingWebSocket(`${WS_PROTOCOL}//${window.location.hostname}:${REA_PORT}/ws/v1/de1/waterLevels`, [], {
        debug: true,
        reconnectInterval: 3000,
    });

    socket.onopen = function() {
        logger.info('Water tank WebSocket connection established.');
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
            logger.error('Error parsing water level data:', e);
        }
    };

    socket.onclose = function(event) {
        logger.info('Water tank WebSocket connection closed.', event.reason);
    };

    socket.onerror = function(err) {
        logger.error('Water tank WebSocket error. See library logs for details.');
    };
}