import { logger } from './logger.js';
import { sendProfile, getWorkflow, getValueFromStore, setValueInStore } from './api.js';
import { updateProfileName } from './ui.js';
import { openDB, getSetting, setSetting } from './idb.js';

const FAV_COUNT = 5;
const PROFILES_PATH = 'src/profiles/';
const LONG_PRESS_DURATION = 700; // ms

const SETTINGS_NAMESPACE = 'streamline-app';
const FAVORITES_KEY = 'favorite-profiles';
const UPLOADED_PROFILES_KEY = 'uploaded-profiles';


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

    // 2. Load user-uploaded profiles using the new fallback logic
    let uploadedProfiles = {};
    try {
        const reaUploaded = await getValueFromStore(SETTINGS_NAMESPACE, UPLOADED_PROFILES_KEY);
        if (reaUploaded) {
            logger.info('Loaded uploaded profiles from REA store.');
            uploadedProfiles = reaUploaded;
            await setSetting(UPLOADED_PROFILES_KEY, uploadedProfiles); // Update backup
        } else {
            logger.warn('No uploaded profiles in REA store, checking IndexedDB backup...');
            const idbUploaded = await getSetting(UPLOADED_PROFILES_KEY);
            if (idbUploaded) {
                logger.info('Loaded uploaded profiles from IndexedDB backup.');
                uploadedProfiles = idbUploaded;
                await setValueInStore(SETTINGS_NAMESPACE, UPLOADED_PROFILES_KEY, uploadedProfiles); // Sync back to REA
            }
        }
    } catch (error) {
        logger.error('Failed to load uploaded profiles from REA store. Falling back to IndexedDB.', error);
        try {
            const idbUploaded = await getSetting(UPLOADED_PROFILES_KEY);
            if (idbUploaded) {
                uploadedProfiles = idbUploaded;
            }
        } catch (idbError) {
             logger.error('Failed to load uploaded profiles from IndexedDB backup as well.', idbError);
        }
    }
    
    if (Object.keys(uploadedProfiles).length > 0) {
        Object.assign(availableProfiles, uploadedProfiles);
        logger.info('Merged uploaded profiles.', Object.keys(uploadedProfiles));
    }

    logger.info('All available profiles loaded.', Object.keys(availableProfiles));
}

async function loadAssignments() {
    logger.info('Loading assignments...');
    try {
        // 1. Try to fetch from the primary source (REA store)
        const reaAssignments = await getValueFromStore(SETTINGS_NAMESPACE, FAVORITES_KEY);
        
        if (reaAssignments) {
            logger.info('Loaded assignments from REA store.');
            favoriteAssignments = reaAssignments;
            // Asynchronously update the local backup to keep it fresh
            await setSetting(FAVORITES_KEY, reaAssignments);
            return;
        }

        // 2. If REA has no data, try the local backup (IndexedDB)
        logger.warn('No assignments in REA store, checking IndexedDB backup...');
        const idbAssignments = await getSetting(FAVORITES_KEY);

        if (idbAssignments) {
            logger.info('Loaded assignments from IndexedDB backup.');
            favoriteAssignments = idbAssignments;
            // Data was found locally but not on the server, so let's sync it back up.
            await saveAssignments();
            return;
        }

        // 3. If neither source has data, create and save defaults.
        logger.info('No assignments found anywhere. Creating defaults.');
        const profileKeys = Object.keys(availableProfiles);
        for (let i = 0; i < FAV_COUNT; i++) {
            favoriteAssignments[i] = profileKeys[i] || null;
        }
        await saveAssignments(); // Saves to both REA and IndexedDB

    } catch (error) {
        // This catch block handles network failures when trying to reach the REA store.
        logger.error('Failed to load from REA store. Falling back to IndexedDB.', error);
        try {
            const idbAssignments = await getSetting(FAVORITES_KEY);
            if (idbAssignments) {
                logger.info('Successfully loaded from IndexedDB backup during fallback.');
                favoriteAssignments = idbAssignments;
            } else {
                 // Even the backup failed, so create defaults (but they will only be saved locally for now)
                 logger.warn('IndexedDB backup is also empty. Creating defaults.');
                 const profileKeys = Object.keys(availableProfiles);
                 for (let i = 0; i < FAV_COUNT; i++) {
                     favoriteAssignments[i] = profileKeys[i] || null;
                 }
            }
        } catch (idbError) {
            logger.error('CRITICAL: Failed to load from both REA store and IndexedDB backup.', idbError);
        }
    }
}

async function saveAssignments() {
    logger.info('Saving assignments to REA store and IndexedDB backup...');

    // We use Promise.allSettled to ensure we attempt both saves even if one fails.
    const results = await Promise.allSettled([
        setValueInStore(SETTINGS_NAMESPACE, FAVORITES_KEY, favoriteAssignments),
        setSetting(FAVORITES_KEY, favoriteAssignments)
    ]);

    if (results[0].status === 'fulfilled') {
        logger.info('Assignments saved to REA store successfully.');
    } else {
        logger.error('Failed to save assignments to REA store:', results[0].reason);
    }

    if (results[1].status === 'fulfilled') {
        logger.info('Assignments saved to IndexedDB backup successfully.');
    } else {
        logger.error('Failed to save assignments to IndexedDB backup:', results[1].reason);
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

            const existingUploaded = await getSetting(UPLOADED_PROFILES_KEY);
            const allUploaded = existingUploaded || {};
            allUploaded[fileName] = profile;
            
            await Promise.allSettled([
                setValueInStore(SETTINGS_NAMESPACE, UPLOADED_PROFILES_KEY, allUploaded),
                setSetting(UPLOADED_PROFILES_KEY, allUploaded)
            ]);
            
            logger.info(`Saved new profile '${fileName}' to REA store and IndexedDB backup.`);

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

        await openDB(); // Still needed for the backup functionality

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
