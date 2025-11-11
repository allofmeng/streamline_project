import { logger } from './logger.js';
import { sendProfile, getWorkflow } from './api.js';
import { updateProfileName } from './ui.js';

const FAV_COUNT = 3;
const PROFILES_PATH = 'src/profiles/';
const STORAGE_KEY = 'streamline-favorite-profiles';
const LONG_PRESS_DURATION = 700; // ms

let favoriteButtons = [];
let availableProfiles = {};
let favoriteAssignments = {};

// --- Helper Functions ---

async function loadAvailableProfiles() {
    const profileFiles = [
        '80s_Espresso.json',
        'D-Flow____default.json',
        'Rao_Allongé_DA_Earthworld_obourbon.json',
        'test.json'
    ];

    for (const fileName of profileFiles) {
        try {
            const response = await fetch(`${PROFILES_PATH}${fileName}`);
            if (!response.ok) throw new Error(`Failed to fetch ${fileName}`);
            const profileJson = await response.json();
            const profileContent = fileName === 'test.json' ? profileJson.profile : profileJson;
            availableProfiles[fileName] = profileContent;
        } catch (error) {
            logger.error(`Failed to load profile: ${fileName}`, error);
        }
    }
    logger.info('Loaded available profiles:', Object.keys(availableProfiles));
}

function loadAssignments() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            favoriteAssignments = JSON.parse(saved);
            logger.info('Loaded profile assignments from localStorage.');
        }
        else {
            const profileKeys = Object.keys(availableProfiles);
            for (let i = 0; i < FAV_COUNT; i++) {
                favoriteAssignments[i] = profileKeys[i] || null;
            }            saveAssignments();
            logger.info('Created default profile assignments.');
        }
    }
    catch (error) {
        logger.error('Failed to load profile assignments from localStorage:', error);
    }
}

function saveAssignments() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteAssignments));
    }
    catch (error) {
        logger.error('Failed to save profile assignments to localStorage:', error);
    }
}

function updateButtonUI() {
    for (let i = 0; i < FAV_COUNT; i++) {
        const button = favoriteButtons[i];
        const profileKey = favoriteAssignments[i];
        const profile = availableProfiles[profileKey];

        if (button && profile) {
            button.textContent = profile.title || 'Untitled';
        }
        else if (button) {
            button.textContent = '[Empty]';
        }
    }
}

async function verifyProfileChange(sentProfileTitle, retries = 5, delay = 300) {
    if (retries <= 0) {
        logger.error(`Profile verification failed after multiple retries. Sent '${sentProfileTitle}'.`);
        return false;
    }

    const currentWorkflow = await getWorkflow();
    const activeProfileTitle = currentWorkflow?.profile?.title;

    if (sentProfileTitle === activeProfileTitle) {
        logger.info('Verification successful. Active profile matches sent profile.');
        return true;
    } else {
        logger.warn(`Verification attempt failed. Retrying... (${retries - 1} left). Sent: '${sentProfileTitle}', Active: '${activeProfileTitle}'`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return verifyProfileChange(sentProfileTitle, retries - 1, delay);
    }
}

async function handleProfileClick(index) {
    const profileKey = favoriteAssignments[index];
    const profile = availableProfiles[profileKey];

    if (!profile) {
        logger.warn(`Button ${index} has no profile assigned.`);
        return;
    }

    logger.info(`Sending profile '${profile.title}' to REA...`);
    try {
        await sendProfile(profile);
        logger.info('Successfully sent profile. Verifying...');

        const isVerified = await verifyProfileChange(profile.title);

        if (isVerified) {
            updateProfileName(profile.title);
            favoriteButtons.forEach((btn, i) => {
                // Classes that define the active state
                const activeBgClass = 'bg-[var(--mimoja-blue-v2)]';
                const activeTextClass = 'text-white';
                // Class for inactive text color
                const inactiveTextClass = 'text-[var(--mimoja-blue)]';

                if (i === index) {
                    // This is the clicked (active) button
                    btn.classList.add(activeBgClass, activeTextClass);
                    btn.classList.remove(inactiveTextClass); // Ensure inactive text color is removed
                } else {
                    // This is an inactive button
                    btn.classList.remove(activeBgClass, activeTextClass);
                    btn.classList.add(inactiveTextClass); // Ensure inactive text color is applied
                }
            });
        }
    }
    catch (error) {
        logger.error('Failed to send or verify profile:', error);
    }
}

function assignProfile(buttonIndex, profileKey) {
    logger.info(`Assigning profile '${profileKey}' to button ${buttonIndex}`);
    favoriteAssignments[buttonIndex] = profileKey;
    saveAssignments();
    updateButtonUI();
    document.getElementById('profile_modal').close();
}

function openProfileSelectionModal(buttonIndex) {
    const modal = document.getElementById('profile_modal');
    const container = document.getElementById('profile-list-container');
    if (!modal || !container) return;

    container.innerHTML = ''; // Clear previous list

    for (const profileKey in availableProfiles) {
        const profile = availableProfiles[profileKey];
        const item = document.createElement('button');
        item.className = 'btn btn-ghost justify-start';
        item.textContent = profile.title;
        item.addEventListener('click', () => {
            assignProfile(buttonIndex, profileKey);
        });
        container.appendChild(item);
    }

    modal.showModal();
}

function handleLongPress(index) {
    const isAssigned = favoriteAssignments[index];

    if (isAssigned) {
        logger.info(`Clearing assignment for favorite button ${index}`);
        favoriteAssignments[index] = null;
        saveAssignments();
        updateButtonUI();
    }
    else {
        logger.info(`Opening profile selection for empty button ${index}`);
        openProfileSelectionModal(index);
    }
}

// --- Initialization ---

export async function init() {
    for (let i = 0; i < FAV_COUNT; i++) {
        const button = document.getElementById(`fav-profile-btn-${i}`);
        if (button) favoriteButtons.push(button);
    }

    await loadAvailableProfiles();
    loadAssignments();
    updateButtonUI();

    favoriteButtons.forEach((button, index) => {
        let pressTimer = null;

        const startPress = () => {
            // Make sure we clear any previous timer
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                handleLongPress(index);
                pressTimer = null;
            }, LONG_PRESS_DURATION);
        };

        const cancelPress = () => {
            clearTimeout(pressTimer);
        };

        button.addEventListener('click', () => handleProfileClick(index));
        button.addEventListener('mousedown', startPress);
        button.addEventListener('mouseup', cancelPress);
        button.addEventListener('mouseleave', cancelPress);
        button.addEventListener('touchstart', startPress, { passive: true });
        button.addEventListener('touchend', cancelPress);
    });

    logger.info('Profile Manager initialized.');
}


