import * as ui from './ui.js';
import { logger ,setDebug} from './logger.js';

export const REA_PORT = 8080;
export const API_BASE_URL = `http://${window.location.hostname}:${REA_PORT}/api/v1`;
export const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

export const MachineState = {
    BOOTING: 'booting',
    BUSY: 'busy',
    IDLE: 'idle',
    SLEEPING: 'sleeping',
    HEATING: 'heating',
    PREHEATING: 'preheating',
    ESPRESSO: 'espresso',
    HOT_WATER: 'hotWater',
    FLUSH: 'flush',
    STEAM: 'steam',
    STEAM_RINSE: 'steamRinse',
    SKIP_STEP: 'skipStep',
    CLEANING: 'cleaning',
    DESCALING: 'descaling',
    CALIBRATION: 'calibration',
    SELF_TEST: 'selfTest',
    AIR_PURGE: 'airPurge',
    NEEDS_WATER: 'needsWater',
    ERROR: 'error',
    FW_UPGRADE: 'fwUpgrade',
    READY: 'ready', // Note: Not in the official API doc, but used in app.js for shot completion logic
};

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

export function updateShotSettingsCache(newSettings) {
    if (newSettings) {
        currentShotSettings = { ...currentShotSettings, ...newSettings };
        logger.debug('Shot settings cache updated:', currentShotSettings);
    }
}

export async function getDevices() {
    const response = await fetch(`${API_BASE_URL}/devices`);
    if (!response.ok) {
        throw new Error('Failed to get devices');
    }
    return response.json();
}

export async function scanForDevices() {
    const response = await fetch(`${API_BASE_URL}/devices/scan`);
    if (!response.ok) {
        throw new Error('Failed to scan for devices');
    }
    return response.json();
}

export async function reconnectDevice(deviceId) {
    try {
        logger.info(`Attempting to reconnect to device: ${deviceId}`);
        const response = await fetch(`${API_BASE_URL}/devices/connect?deviceId=${deviceId}`, {
            method: 'PUT',
        });
        if (!response.ok) {
            throw new Error(`Failed to send reconnect request for device ${deviceId}`);
        }
        logger.info(`Successfully sent reconnect request for device: ${deviceId}`);
    } catch (error) {
        logger.error(`Error during device reconnection attempt for ${deviceId}:`, error);
    }
}

let reloadcount = 0;

export async function reconnectScale() {
    try {
        logger.info('Attempting to reconnect scale by scanning...');
        const response = await fetch(`${API_BASE_URL}/devices/scan?connect=true&quick=true`);
        if (!response.ok) {
            reloadcount += 1;
            if (reloadcount >= 10) { location.reload(); }
            logger.info("reload",reloadcount);
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
        ui.updateMachineStatus("Connecting");
        logger.debug('DE1 WebSocket re-opened. Status set to Connected.'); // Added debug log
    };

    reconnectingWebSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Update local shot settings cache if snapshot includes shot settings
            onData(data);
            // setDebug(true);
            // logger.debug(data)
        } catch (error) {
            logger.error('Error parsing WebSocket message:', error);
        }
    };

    reconnectingWebSocket.onclose = () => {
        logger.info('WebSocket disconnected. Attempting to reconnect...');
        ui.updateMachineStatus("Disconnected");
        setTimeout(() => {
            logger.info('reloading now');
            // location.reload();
            
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
            //logger.debug(data);
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
        clearTimeout(scaleDataTimeout);
        scaleDataTimeout = setTimeout(handleScaleTimeout, SCALE_TIMEOUT_DURATION);
        if (onReconnect) {
            onReconnect();
        }
    };
}

export function connectShotSettingsWebSocket(onData) {
    const shotSettingsWebSocket = new ReconnectingWebSocket(`${WS_PROTOCOL}//${window.location.hostname}:${REA_PORT}/ws/v1/de1/shotSettings`, [], {
        debug: true,
        reconnectInterval: 3000,
    });

    shotSettingsWebSocket.onopen = () => {
        logger.info('Shot Settings WebSocket connected');
    };

    shotSettingsWebSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onData(data);
            logger.info('shotsettings data',data);
        } catch (error) {
            logger.error('Error parsing Shot Settings WebSocket message:', error);
        }
    };

    shotSettingsWebSocket.onclose = () => {
        logger.info('Shot Settings WebSocket disconnected. Attempting to reconnect...');
    };

    shotSettingsWebSocket.onerror = (error) => {
        logger.error('Shot Settings WebSocket error:', error);
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

function isValidProfile(profile) {
    const requiredKeys = [
        'title',
        'author',
        'notes',
        'beverage_type',
        'steps',
        'version',
        'target_volume',
        'target_weight',
        'target_volume_count_start',
        'tank_temperature'
    ];

    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
        const errorMessage = 'Profile validation failed: Profile is not a valid object.';
        logger.error(errorMessage);
        alert(errorMessage); // Pop-up message
        return false;
    }

    for (const key of requiredKeys) {
        if (!Object.prototype.hasOwnProperty.call(profile, key)) {
            const errorMessage = `Profile validation failed: Profile is missing required key: '${key}'.`;
            logger.error(errorMessage);
            alert(errorMessage); // Pop-up message
            return false;
        }
    }

    if (!Array.isArray(profile.steps)) {
        const errorMessage = `Profile validation failed: 'steps' property is not an array.`;
        logger.error(errorMessage);
        alert(errorMessage); // Pop-up message
        return false;
    }

    logger.info('Profile validation successful.');
    return true;
}

export async function sendProfile(profileJson) {
    if (!isValidProfile(profileJson)) {
        throw new Error('Profile validation failed. Not sending to REA.');
    }
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

async function sendShotSettings() {
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

    if (!response.ok) {
        // The body might contain a useful error message
        const errorBody = await response.text();
        throw new Error(`Failed to set shot settings. Status: ${response.status}, Body: ${errorBody}`);
    }
    return;
}

export async function setTargetHotWaterVolume(volume) {
    currentShotSettings.targetHotWaterVolume = parseFloat(volume);
    return sendShotSettings();
}

export async function setTargetHotWaterTemp(temp) {
    currentShotSettings.targetHotWaterTemp = parseFloat(temp);
    return sendShotSettings();
}

export async function setTargetHotWaterDuration(duration) {
    currentShotSettings.targetHotWaterDuration = parseFloat(duration);
    return sendShotSettings();
}

export async function setTargetSteamTemp(temp) {
    currentShotSettings.targetSteamTemp = parseFloat(temp);
    return sendShotSettings();
}

export async function setTargetSteamDuration(duration) {
    currentShotSettings.targetSteamDuration = parseFloat(duration);
    return sendShotSettings();
}


export async function setTargetSteamFlow(flow) {
    const settings = { steamFlow: parseFloat(flow) };
    return setDe1Settings(settings);
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


export async function getDe1Settings() {
    try {
        const response = await fetch(`${API_BASE_URL}/de1/settings`);
        if (!response.ok) {
            throw new Error(`Failed to get DE1 settings: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        logger.error("Error in getDe1Settings:", error);
        return null;
    }
}

export async function setDe1Settings(settings) {
    try {
        const response = await fetch(`${API_BASE_URL}/de1/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to set DE1 settings. Status: ${response.status}, Body: ${errorBody}`);
        }
        logger.info('DE1 settings updated successfully:', settings);
    } catch (error) {
        logger.error('Error setting DE1 settings:', error);
        throw error; // Re-throw to allow calling code to handle
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

export async function getValueFromStore(namespace, key) {
    try {
        const response = await fetch(`${API_BASE_URL}/store/${namespace}/${key}`);
        if (response.status === 404) {
            return null; // Key not found, which is a valid case
        }
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        logger.info('getValueFromStore ok');
        return response.json();
    } catch (error) {
        logger.error(`Failed to get value for key '${key}':`, error);
        throw error;
    }
}

export async function setValueInStore(namespace, key, value) {
    try {
        const response = await fetch(`${API_BASE_URL}/store/${namespace}/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value),
        });
        if (response.status !== 204) {
            throw new Error(`API Error: ${response.status}`);
        }
        logger.info('setValueInStore ok');
        return true;
    } catch (error) {
        logger.error(`Failed to set value for key '${key}':`, error);
        throw error;
    }
}
