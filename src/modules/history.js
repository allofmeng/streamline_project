import * as chart from './chart.js';
import { logger } from './logger.js';
import { openDB, getAllShots, addShot, getLatestShotTimestamp } from './idb.js';
import { API_BASE_URL } from './api.js';

let shots = [];
let currentShotIndex = -1;

async function loadShotHistory() {
    let fetchedNewShots = false;
    try {
        const latestTimestamp = await getLatestShotTimestamp();
        let url = `${API_BASE_URL}/shots`;
        if (latestTimestamp) {
            url += `?since=${latestTimestamp}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const newShots = await response.json();

        if (newShots.length > 0) {
            for (const shot of newShots) {
                await addShot(shot);
            }
            fetchedNewShots = true;
            logger.info(`${newShots.length} new shots fetched from API and added to IndexedDB.`);
        } else {
            logger.info('No new shots from API.');
        }
    } catch (error) {
        logger.warn('Could not fetch new shots from API, loading from cache:', error);
    }

    try {
        shots = await getAllShots();
        // Sort shots by timestamp descending (newest first)
        shots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        logger.info('Shot history loaded:', shots.length, 'shots found in IndexedDB');
    } catch (error) {
        logger.error('Error loading shots from IndexedDB:', error);
    }
}

function displayShot(index) {
    if (index < 0 || index >= shots.length) {
        logger.warn('Invalid shot index', index);
        return;
    }

    currentShotIndex = index;
    const shot = shots[currentShotIndex];

    // Update footer text
    const dateEl = document.getElementById('history-date');
    const profileNameEl = document.getElementById('history-profile-name');

    if (dateEl) {
        dateEl.textContent = new Date(shot.timestamp).toLocaleString();
    }
    if (profileNameEl && shot.workflow && shot.workflow.profile) {
        profileNameEl.textContent = shot.workflow.profile.title;
    }

    // Update chart
    if (shot.measurements) {
        chart.plotHistoricalShot(shot.measurements);
    }

    // Update button states
    const prevBtn = document.getElementById('history-prev-btn');
    const nextBtn = document.getElementById('history-next-btn');
    if (prevBtn) prevBtn.disabled = currentShotIndex >= shots.length - 1;
    if (nextBtn) nextBtn.disabled = currentShotIndex <= 0;
}

export async function initHistory() {
    try {
        await openDB();
    } catch (error) {
        logger.error('Failed to open IndexedDB:', error);
        // Optionally, display a message to the user that history won't be available offline
        return;
    }
    await loadShotHistory();

    const prevBtn = document.getElementById('history-prev-btn');
    const nextBtn = document.getElementById('history-next-btn');

    prevBtn.addEventListener('click', () => {
        if (currentShotIndex < shots.length - 1) {
            displayShot(currentShotIndex + 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentShotIndex > 0) {
            displayShot(currentShotIndex - 1);
        }
    });

    // Display the most recent shot on initial load
    if (shots.length > 0) {
        displayShot(0);
    }
}

export async function clearShotHistory() {
    try {
        await openDB(); // Ensure DB is open before clearing
        await clearShots();
        logger.info('Shot history cleared.');
        // Reload history after clearing
        await loadShotHistory();
        if (shots.length > 0) {
            displayShot(0);
        } else {
            // Clear chart and footer if no shots remain
            chart.clearChart();
            const dateEl = document.getElementById('history-date');
            const profileNameEl = document.getElementById('history-profile-name');
            if (dateEl) dateEl.textContent = '';
            if (profileNameEl) profileNameEl.textContent = '';
        }
    } catch (error) {
        logger.error('Error clearing shot history:', error);
    }
}
