import * as ui from './ui.js';
import { logger ,setDebug} from './logger.js';

const REA_PORT = 8080;
export const API_BASE_URL = `http://${window.location.hostname}:${REA_PORT}/api/v1`;
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

export let reconnectingWebSocket = null; // Exporting for app.js access
let scaleWebSocket = null;

// Local cache for current shot settings, initialized with default values and correct types
let currentShotSettings = {
    steamSetting: 0, // integer
    targetSteamTemp: 0, // integer
    targetSteamDuration: 0, // integer
    targetHotWaterTemp: 0, // integer
    targetHotWaterVolume: 0, // integer
    targetHotWaterDuration: 0, // integer
    targetShotVolume: 0, // integer
    groupTemp: 0.0, // number (float/double)
};

export async function reconnectScale() {
    try {
        logger.info('Attempting to reconnect scale by scanning...');
        const response = await fetch(`${API_BASE_URL}/devices/scan?connect=true&quick=true`);
        if (!response.ok) {
            throw new Error(`Failed to trigger scale scan/reconnect: ${response.statusText}`);
        }
        logger.info('Successfully triggered scale scan/reconnect.');
    } catch (error) {
        logger.error('Error during scale reconnection attempt:', error);
    }
}

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
            // Update local shot settings cache if snapshot includes shot settings
            onData(data);
            // setDebug(true);
            logger.debug(data)
        } catch (error) {
            logger.error('Error parsing WebSocket message:', error);
        }
    };

    reconnectingWebSocket.onclose = () => {
        logger.info('WebSocket disconnected. Attempting to reconnect...');
        ui.updateMachineStatus("Disconnected");
        setTimeout(() => {
            location.reload();
        }, 6000);
    };

    reconnectingWebSocket.onerror = (error) => {
        logger.error('WebSocket error:', error);
        ui.updateMachineStatus("Disconnected"); // Ensure this is present
    };

    reconnectingWebSocket.onreconnect = () => {
        logger.info('WebSocket reconnected');
        if (onReconnect) {
            onReconnect();
        }
    };
}

export function connectScaleWebSocket(onData, onReconnect, onDisconnect) {
    let scaleDataTimeout;
    const SCALE_TIMEOUT_DURATION = 5000; // 5 seconds

    const handleScaleTimeout = () => {
        logger.warn(`No scale data received for ${SCALE_TIMEOUT_DURATION / 1000} seconds. Assuming disconnection.`);
        if (onDisconnect) {
            onDisconnect();
        }
    };

    scaleWebSocket = new ReconnectingWebSocket(`${WS_PROTOCOL}//${window.location.hostname}:${REA_PORT}/ws/v1/scale/snapshot`, [], {
        debug: true,
        reconnectInterval: 3000,
    });

    scaleWebSocket.onopen = () => {
        logger.info('Scale WebSocket connected');
        clearTimeout(scaleDataTimeout);
        scaleDataTimeout = setTimeout(handleScaleTimeout, SCALE_TIMEOUT_DURATION);
    };

    scaleWebSocket.onmessage = (event) => {
        clearTimeout(scaleDataTimeout);
        scaleDataTimeout = setTimeout(handleScaleTimeout, SCALE_TIMEOUT_DURATION);

        try {
            const data = JSON.parse(event.data);
            onData(data);
            logger.debug(data);
        } catch (error) {
            logger.error('Error parsing scale WebSocket message:', error);
        }
    };

    scaleWebSocket.onclose = () => {
        logger.info('Scale WebSocket disconnected.');
        clearTimeout(scaleDataTimeout);
        if (onDisconnect) {
            onDisconnect();
        }
    };

    scaleWebSocket.onerror = (error) => {
        logger.error('Scale WebSocket error:', error);
        clearTimeout(scaleDataTimeout);
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

export async function setTargetHotWaterVolume(volume) {
    // Update the local cache for targetHotWaterVolume
    currentShotSettings.targetHotWaterVolume = parseFloat(volume);

    // Construct payload ensuring correct types based on schema
    const payload = {
        steamSetting: Math.round(currentShotSettings.steamSetting),
        targetSteamTemp: Math.round(currentShotSettings.targetSteamTemp),
        targetSteamDuration: Math.round(currentShotSettings.targetSteamDuration),
        targetHotWaterTemp: Math.round(currentShotSettings.targetHotWaterTemp),
        targetHotWaterVolume: Math.round(currentShotSettings.targetHotWaterVolume),
        targetHotWaterDuration: Math.round(currentShotSettings.targetHotWaterDuration),
        targetShotVolume: Math.round(currentShotSettings.targetShotVolume),
        groupTemp: parseFloat(currentShotSettings.groupTemp.toFixed(1)),
    };

    const response = await fetch(`${API_BASE_URL}/de1/shotSettings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    logger.info("setTargetHotWaterVolume = " , volume , response) 
    if (!response.ok) {
        throw new Error(`Failed to set target hot water volume to ${volume}`);
    }
    return;
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