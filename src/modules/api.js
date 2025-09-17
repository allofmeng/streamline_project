// streamline_project/src/modules/api.js

/**
 * Connects to the machine's WebSocket and calls the callback with new data.
 * @param {function(object): void} onDataReceived - The callback function to execute on new data.
 */
export function connectWebSocket(onDataReceived) {
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
        const payload = { profile: profileJson };
        const response = await fetch('http://localhost:8080/api/v1/workflow', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        return response;
    } catch (error) {
        console.error('Error sending profile:', error);
        throw error;
    }
}
