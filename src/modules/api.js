import * as ui from './ui.js';
import { logger ,setDebug} from './logger.js';

const REA_PORT = 8080;
const API_BASE_URL = `http://${window.location.hostname}:${REA_PORT}/api/v1`;
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

export let reconnectingWebSocket = null; // Exporting for app.js access
let scaleWebSocket = null;

export function connectWebSocket(onData, onReconnect) {
    reconnectingWebSocket = new ReconnectingWebSocket(`${WS_PROTOCOL}//${window.location.hostname}:${REA_PORT}/ws/v1/de1/snapshot`, [], {
        debug: true,
        reconnectInterval: 3000,
    }); // Enable debug logging

    reconnectingWebSocket.onopen = () => {
        logger.info('WebSocket connected');
        ui.updateMachineStatus("Connected");
        logger.debug('DE1 WebSocket re-opened. Status set to Connected.'); // Added debug log
    };

    reconnectingWebSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onData(data);
            setDebug(true);
            logger.debug(data)
        } catch (error) {
            logger.error('Error parsing WebSocket message:', error);
        }
    };

    reconnectingWebSocket.onclose = () => {
        logger.info('WebSocket disconnected. Attempting to reconnect...');
        ui.updateMachineStatus("Disconnected");
    };

    reconnectingWebSocket.onerror = (error) => {
        logger.error('WebSocket error:', error);
        ui.updateMachineStatus("Disconnected"); // Ensure this is present
    };

    // Custom logic for reconnection
    reconnectingWebSocket.onreconnect = () => {
        logger.info('WebSocket reconnected');
        if (onReconnect) {
            onReconnect();
        }
    };
}

export function connectScaleWebSocket(onData, onReconnect) {
    scaleWebSocket = new ReconnectingWebSocket(`${WS_PROTOCOL}//${window.location.hostname}:${REA_PORT}/ws/v1/scale/snapshot`, [], {
        debug: true,
        reconnectInterval: 3000,
    });

    scaleWebSocket.onopen = () => {
        logger.info('Scale WebSocket connected');
    };

    scaleWebSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // logger.debug(data);
            onData(data);
        } catch (error) {
            logger.error('Error parsing scale WebSocket message:', error);
        }
    };

    scaleWebSocket.onclose = () => {
        logger.info('Scale WebSocket disconnected. Attempting to reconnect...');
    };

    scaleWebSocket.onerror = (error) => {
        logger.error('Scale WebSocket error:', error);
    };

    scaleWebSocket.onreconnect = () => {
        logger.info('Scale WebSocket reconnected');
        if (onReconnect) {
            onReconnect();
        }
    };
}


export async function getProfile() {
    const response = await fetch(`${API_BASE_URL}/workflow`);
    if (!response.ok) {
        throw new Error('Failed to get profile');
    }
    const data = await response.json();
    return data.profile || null;
}

export async function sendProfile(profileJson) {
    // This function is now a simple wrapper around updateWorkflow
    return updateWorkflow({ profile: profileJson });
}

export async function getWorkflow() {
    const response = await fetch(`${API_BASE_URL}/workflow`);
    if (!response.ok) {
        throw new Error('Failed to get workflow');
    }
    return response.json();
}

export async function updateWorkflow(data) {
    const response = await fetch(`${API_BASE_URL}/workflow`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update workflow');
    }
    return response.json();
}

export async function setMachineState(newState) {
    const response = await fetch(`${API_BASE_URL}/de1/state/${newState}`, {
        method: 'PUT',
    });
    if (!response.ok) {
        throw new Error(`Failed to set machine state to ${newState}`);
    }
    return response;
}


export async function getReaSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/settings`);
        if (!response.ok) {
            throw new Error(`Failed to get Rea settings: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        logger.error("Error in getReaSettings:", error);
        return null; // Return null or a default settings object
    }
}

export async function ensureGatewayModeTracking() {
    const settings = await getReaSettings();
    if (settings && settings.gatewayMode !== 'tracking') {
        logger.info("Gateway mode is not 'tracking', attempting to set it.");
        try {
            const response = await fetch(`${API_BASE_URL}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ gatewayMode: 'tracking' }),
            });
            if (!response.ok) {
                throw new Error(`Failed to set gateway mode: ${response.statusText}`);
            }
            logger.info("Successfully set gateway mode to 'tracking'.");
        } catch (error) {
            logger.error("Error in ensureGatewayModeTracking POST:", error);
        }
    }
}