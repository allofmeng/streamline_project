import { logger } from './logger.js';
import { sendProfile, getWorkflow } from './api.js';
import { updateProfileName } from './ui.js';
import { openDB, getShot, addShot } from './idb.js';

const FAV_COUNT = 5;
const PROFILES_PATH = 'src/profiles/';
const STORAGE_KEY = 'streamline-favorite-profiles';
const UPLOADED_PROFILES_KEY = 'streamline-uploaded-profiles';
const LONG_PRESS_DURATION = 700; // ms

let favoriteButtons = [];
let availableProfiles = {};
let favoriteAssignments = {};
let currentButtonIndex = null;

// --- Helper Functions ---

async function loadAvailableProfiles() {
    // 1. Load default profiles from the file system
    let profileFiles = [];
    try {
        const response = await fetch(`${PROFILES_PATH}profile-manifest.json`);
        if (!response.ok) {
            throw new Error(`Failed to fetch profile manifest. Status: ${response.status}`);
        }
        profileFiles = await response.json();
    } catch (error) {
        logger.error('Failed to load profiles from manifest.', error);
    }

    profileFiles = [...new Set(profileFiles)]; // Deduplicate

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

    // 2. Load user-uploaded profiles from IndexedDB and merge them
    try {
        const uploadedProfiles = await getShot(UPLOADED_PROFILES_KEY);
        if (uploadedProfiles && uploadedProfiles.value) {
            Object.assign(availableProfiles, uploadedProfiles.value);
            logger.info('Merged uploaded profiles from IndexedDB.', Object.keys(uploadedProfiles.value));
        }
    } catch (error) {
        logger.error('Failed to get uploaded profiles from IndexedDB:', error);
    }

    logger.info('All available profiles loaded.', Object.keys(availableProfiles));
}

async function loadAssignments() {
    try {
        // Try localStorage first for fast startup
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            favoriteAssignments = JSON.parse(saved);
            logger.info('Loaded profile assignments from localStorage.');
            await saveAssignments(); // Heal IndexedDB if it's out of sync
            return;
        }

        logger.warn('No assignments in localStorage, checking IndexedDB...');
        const idbAssignments = await getShot(STORAGE_KEY);

        if (idbAssignments && idbAssignments.value) {
            favoriteAssignments = idbAssignments.value;
            logger.info('Loaded profile assignments from IndexedDB.');
            await saveAssignments(); // Heal localStorage
            return;
        }

        logger.info('No saved assignments found. Creating defaults.');
        const profileKeys = Object.keys(availableProfiles);
        for (let i = 0; i < FAV_COUNT; i++) {
            favoriteAssignments[i] = profileKeys[i] || null;
        }
        await saveAssignments();
    }
    catch (error) {
        logger.error('Failed to load profile assignments:', error);
    }
}

async function saveAssignments() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteAssignments));
        await addShot({ id: STORAGE_KEY, value: favoriteAssignments });
        logger.info('Saved assignments to localStorage and IndexedDB.');
    } catch (error) {
        logger.error('Error during saveAssignments:', error);
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
            button.textContent = '';
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
        logger.info(`Successfully sent profile. Verifying...`);

        const isVerified = await verifyProfileChange(profile.title);

        if (isVerified) {
            updateProfileName(profile.title);
            favoriteButtons.forEach((btn, i) => {
                const activeBgClass = 'bg-[var(--mimoja-blue-v2)]';
                const activeTextClass = 'text-white';
                const inactiveTextClass = 'text-[var(--mimoja-blue)]';

                if (i === index) {
                    btn.classList.add(activeBgClass, activeTextClass);
                    btn.classList.remove(inactiveTextClass);
                } else {
                    btn.classList.remove(activeBgClass, activeTextClass);
                    btn.classList.add(inactiveTextClass);
                }
            });
        }
    }
    catch (error) {
        logger.error('Failed to send or verify profile:', error);
    }
}

async function assignProfile(buttonIndex, profileKey) {
    logger.info(`Assigning profile '${profileKey}' to button ${buttonIndex}`);
    favoriteAssignments[buttonIndex] = profileKey;
    await saveAssignments();
    updateButtonUI();
    document.getElementById('profile_modal').close();
}

function openProfileSelectionModal(buttonIndex) {
    currentButtonIndex = buttonIndex;
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

async function handleLongPress(index) {
    const isAssigned = favoriteAssignments[index];

    if (isAssigned) {
        logger.info(`Clearing assignment for favorite button ${index}`);
        favoriteAssignments[index] = null;
        await saveAssignments();
        updateButtonUI();
    }
    else {
        logger.info(`Opening profile selection for empty button ${index}`);
        openProfileSelectionModal(index);
    }
}

async function handleProfileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const fileContent = await file.text();
        const profile = JSON.parse(fileContent);
        const fileName = file.name;

        if (profile.title && profile.steps) {
            availableProfiles[fileName] = profile;
            logger.info(`Successfully loaded uploaded profile: ${profile.title}`);

            const existingUploaded = await getShot(UPLOADED_PROFILES_KEY);
            const allUploaded = (existingUploaded && existingUploaded.value) ? existingUploaded.value : {};
            allUploaded[fileName] = profile;
            await addShot({ id: UPLOADED_PROFILES_KEY, value: allUploaded });
            logger.info(`Saved new profile '${fileName}' to IndexedDB.`);

            if (currentButtonIndex !== null) {
                openProfileSelectionModal(currentButtonIndex);
            }
        } else {
            logger.error('Uploaded file is not a valid profile format.');
            alert('Error: Uploaded file is not a valid profile.');
        }
    } catch (error) {
        logger.error('Failed to parse or save uploaded profile:', error);
        alert('Error: Could not process the uploaded file.');
    }
}

// --- Initialization ---

export async function init() {
    logger.info('Profile Manager init started.');
    try {
        for (let i = 0; i < FAV_COUNT; i++) {
            const button = document.getElementById(`fav-profile-btn-${i}`);
            if (button) favoriteButtons.push(button);
        }

        await openDB();

        await loadAvailableProfiles();
        await loadAssignments();
        updateButtonUI();

        favoriteButtons.forEach((button, index) => {
            let pressTimer = null;

            const startPress = () => {
                clearTimeout(pressTimer);
                pressTimer = setTimeout(() => {
                    handleLongPress(index);
                    pressTimer = null; 
                }, LONG_PRESS_DURATION);
            };

            const cancelPress = () => {
                clearTimeout(pressTimer);
            };

            button.addEventListener('click', () => {
                if (pressTimer !== null) { // Prevents click firing after long press
                    handleProfileClick(index)
                }
            });
            button.addEventListener('mousedown', startPress);
            button.addEventListener('mouseup', cancelPress);
            button.addEventListener('mouseleave', cancelPress);
            button.addEventListener('touchstart', startPress, { passive: true });
            button.addEventListener('touchend', cancelPress);
        });

        const uploadButton = document.getElementById('upload-profile-btn');
        const fileInput = document.getElementById('profile-upload-input');
        if (uploadButton && fileInput) {
            uploadButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
            fileInput.addEventListener('change', handleProfileUpload);
        }

    } catch (error) {
        logger.error('CRITICAL: Error during Profile Manager initialization:', error);
    }

    logger.info('Profile Manager initialized.');
}