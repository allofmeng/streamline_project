import * as chart from './chart.js';
import { logger } from './logger.js';

let shots = [];
let currentShotIndex = -1;

async function loadShotHistory() {
    try {
        const response = await fetch('./src/profiles/shots.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        shots = await response.json();
        // Sort shots by timestamp descending (newest first)
        shots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        logger.info('Shot history loaded:', shots.length, 'shots found');
    } catch (error) {
        logger.error('Could not load or parse shot history:', error);
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
