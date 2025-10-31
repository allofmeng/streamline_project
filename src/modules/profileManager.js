import { logger } from './logger.js';
import { sendProfile } from './api.js';
import * as ui from './ui.js';
const FAV_COUNT = 3;
const PROFILES_PATH = 'src/profiles/';
const STORAGE_KEY = 'streamline-favorite-profiles';
const LONG_PRESS_DURATION = 700; // ms

let favoriteButtons = [];
let availableProfiles = {};
let favoriteAssignments = {};
let pressTimer = null;

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
        } else {
            const profileKeys = Object.keys(availableProfiles);
            for (let i = 0; i < FAV_COUNT; i++) {
                favoriteAssignments[i] = profileKeys[i] || null;
            }
            saveAssignments();
            logger.info('Created default profile assignments.');
        }
    } catch (error) {
        logger.error('Failed to load profile assignments from localStorage:', error);
    }
}

function saveAssignments() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteAssignments));
    } catch (error) {
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
            button.disabled = false;
        } else if (button) {
            button.textContent = '[Empty]';
            button.disabled = true;
        }
    }
}

async function handleProfileClick(index) {
    const profileKey = favoriteAssignments[index];
    const profile = availableProfiles[profileKey];

    if (!profile) {
        logger.error(`No profile assigned to button ${index}`);
        return;
    }

    logger.info(`Sending profile '${profile.title}' to REA...`);
    try {
        await sendProfile(profile);
        logger.info('Successfully sent profile.');
        ui.updateProfileName(profile.title || "Untitled Profile"); 
        favoriteButtons.forEach((btn, i) => {
            const baseClasses = ['btn', 'rounded-2xl', 'h-28', 'w-72', 'text-2xl'];
            const activeClasses = ['btn-primary', 'bg-[var(--mimoja-blue-v2)]', 'text-white'];
            const inactiveClasses = ['btn-outline', 'border-[var(--mimoja-blue)]', 'text-[var(--mimoja-blue)]'];

            btn.className = ''; // Reset classes

            if (i === index) {
                btn.classList.add(...baseClasses, ...activeClasses);
            } else {
                btn.classList.add(...baseClasses, ...inactiveClasses);
            }
        });
    } catch (error) {
        logger.error('Failed to send profile:', error);
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

function handlePressStart(index) {
    pressTimer = setTimeout(() => {
        openProfileSelectionModal(index);
    }, LONG_PRESS_DURATION);
}

function handlePressEnd() {
    clearTimeout(pressTimer);
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
        button.addEventListener('click', () => handleProfileClick(index));
        
        // Long press listeners
        button.addEventListener('mousedown', () => handlePressStart(index));
        button.addEventListener('mouseup', handlePressEnd);
        button.addEventListener('mouseleave', handlePressEnd);
        button.addEventListener('touchstart', () => handlePressStart(index), { passive: true });
        button.addEventListener('touchend', handlePressEnd);
    });

    logger.info('Profile Manager initialized.');
}

