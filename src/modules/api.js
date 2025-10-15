// streamline_project/src/modules/api.js
import * as ui from './ui.js';
import { logger, setDebug } from './logger.js';
/**
 * Connects to the machine's WebSocket and calls the callback with new data.
 * @param {function(object): void} onDataReceived - The callback function to execute on new data.
 * @param {function(): void} onReconnect - The callback function to execute on reconnection.
 */
export function connectWebSocket(onDataReceived, onReconnect, onClose) {
    const socket = new ReconnectingWebSocket('ws://localhost:8080/ws/v1/de1/snapshot', [], {
        debug: true,
        reconnectInterval: 3000,
    });

    socket.onopen = (event) => {
        logger.info('WebSocket Connected');
        ui.updateMachineStatus("Connected"); // Update status to Connected on open
        if (event.isReconnect) {
            console.log('WebSocket reconnected, refreshing data...');
            if (onReconnect) {
                onReconnect();
            }
        }
    };

    socket.onclose = () => {
        console.log('WebSocket Disconnected');
        ui.updateMachineStatus("Disconnected");
        if (onClose) {
            onClose();
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
        ui.updateMachineStatus("Disconnected");
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onDataReceived(data);
    };
}

/**
 * Connects to the scale's WebSocket and calls the callback with new data.
 * @param {function(object): void} onDataReceived - The callback function to execute on new data.
 */
export function connectScaleWebSocket(onDataReceived) {
    const socket = new ReconnectingWebSocket('ws://localhost:8080/ws/v1/scale/snapshot', [], {
        debug: true,
        reconnectInterval: 3000,
    });

    socket.onopen = () => {
        console.log('Scale WebSocket Connected');
    };

    socket.onclose = () => {
        console.log('Scale WebSocket Disconnected');
    };

    socket.onerror = (error) => {
        console.error('Scale WebSocket Error:', error);
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onDataReceived(data);
    };
}

/**
 * Fetches the current profile from the reaprime API.
 * @returns {Promise<object>}
 */
export async function getProfile() {
    try {
        const response = await fetch('http://localhost:8080/api/v1/workflow');
        const data = await response.json();
        console.log("get profile",data);
        return data.profile || null;
    } catch (error) {
        console.error('Error fetching profile:', error);
        throw error;
    }
}

/**
 * Sends a new profile to the reaprime API.
 * @param {object} profileJson - The profile object to send.
 * @returns {Promise<Response>}
 */
export async function sendProfile(profileJson) {
    try {
        const payload = {profile: profileJson
             ,doseData: {
                 doseIn: 18,  doseOut: profileJson.target_weight}};
                 
        const response = await fetch('http://localhost:8080/api/v1/workflow', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        console.log("send profile response",response);
        return response;
    } catch (error) {
        console.error('Error sending profile:', error);
        throw error;
    }
}


export async function ensureGatewayModeTracking() {
    const settingsUrl = 'http://localhost:8080/api/v1/settings';

    try {
        // 1. Get current settings
        const response = await fetch(settingsUrl);
        if (!response.ok) {
            throw new Error(`Failed to get settings: ${response.statusText}`);
        }
        const settings = await response.json();
        console.log('Current Rea settings:', settings);

        // 2. Check if gatewayMode is 'tracking'
        if (settings.gatewayMode !== 'tracking') {
            console.log("Gateway mode is not 'tracking'. Setting it now...");

            // 3. If not, set it
            const postResponse = await fetch(settingsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gatewayMode: 'tracking' }),
            });

            if (!postResponse.ok) {
                throw new Error(`Failed to set gateway mode: ${postResponse.statusText}`);
            }

            const newSettings = await postResponse.json();
            console.log('Successfully set gateway mode to tracking:', newSettings);
        } else {
            console.log('Gateway mode is already set to tracking.');
        }
    } catch (error) {
        console.error('Error ensuring gateway mode:', error);
    }
}