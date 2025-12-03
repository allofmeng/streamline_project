import { logger } from './logger.js';
import { sendProfile, getWorkflow } from './api.js';
import { updateProfileName } from './ui.js';
import { getSetting, setSetting, openDB } from './idb.js';

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
    let profileFiles = [];
    try {
        const response = await fetch(`${PROFILES_PATH}profile-manifest.json`);
        if (!response.ok) {
            throw new Error(`Failed to fetch profile manifest. Status: ${response.status}`);
        }
        profileFiles = await response.json();

    } catch (error) {
        logger.error('Failed to load profiles from manifest.', error);
        logger.warn('Falling back to an empty profile list.');
        profileFiles = [];
    }

    // Deduplicate in case of weird directory listing
    profileFiles = [...new Set(profileFiles)];

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

    await loadUploadedProfilesFromDB();
    logger.info('Loaded available profiles:', Object.keys(availableProfiles));
}

async function loadUploadedProfilesFromDB() {
    try {
        const uploadedProfiles = await getSetting(UPLOADED_PROFILES_KEY);
        if (uploadedProfiles) {
            // Merging uploaded profiles. If a name conflicts with a manifest profile, the uploaded one takes precedence.
            Object.assign(availableProfiles, uploadedProfiles);
            logger.info('Loaded custom profiles from DB:', Object.keys(uploadedProfiles));
        }
    } catch (error) {
        logger.error('Failed to load custom profiles from DB.', error);
    }
}

async function loadAssignments() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            favoriteAssignments = JSON.parse(saved);
            logger.info('Loaded profile assignments from localStorage.');
            await saveAssignments(); //This will ensure idb is also updated. 
            return;
        }

        logger.warn('No assignments in localStorage, checking IndexedDB...');
        const idbAssignments = await getSetting(STORAGE_KEY);

        if (idbAssignments) {
            favoriteAssignments = idbAssignments;
            logger.info('Loaded profile assignments from IndexedDB.');
            await saveAssignments(); // This will "heal" localStorage.
            return;
        }

        logger.info('No assignments in IndexedDB, creating defaults.');
        const profileKeys = Object.keys(availableProfiles);
        for (let i = 0; i < FAV_COUNT; i++) {
            favoriteAssignments[i] = profileKeys[i] || null;
        }
        await saveAssignments();
        logger.info('Created and saved default profile assignments.');

    }
    catch (error) {
        logger.error('Failed to load profile assignments:', error);
    }
}


async function saveAssignments() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteAssignments));
        await setSetting(STORAGE_KEY, favoriteAssignments);
        logger.info('Saved profile assignments to localStorage and IndexedDB.');
    }
    catch (error) {
        logger.error('Failed to save profile assignments:', error);
    }
}

async function saveUploadedProfile(fileName, profileData) {
    try {
        const uploadedProfiles = await getSetting(UPLOADED_PROFILES_KEY) || {};
        uploadedProfiles[fileName] = profileData;
        await setSetting(UPLOADED_PROFILES_KEY, uploadedProfiles);
        logger.info(`Saved uploaded profile '${fileName}' to IndexedDB.`);
    } catch (error) {
        logger.error(`Failed to save uploaded profile '${fileName}' to IndexedDB.`, error);
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

function handleProfileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const profile = JSON.parse(e.target.result);
            const fileName = file.name;

            if (profile.title && profile.steps) {
                availableProfiles[fileName] = profile;
                await saveUploadedProfile(fileName, profile);
                logger.info(`Successfully loaded uploaded profile: ${fileName}`);
                // Re-open the modal to show the new profile
                if (currentButtonIndex !== null) {
                    openProfileSelectionModal(currentButtonIndex);
                }
            } else {
                logger.error('Uploaded file is not a valid profile format.');
                alert('Error: Uploaded file is not a valid profile.');
            }
        } catch (error) {
            logger.error('Failed to parse uploaded profile:', error);
            alert('Error: Could not parse the uploaded JSON file.');
        }
    };
    reader.readAsText(file);
}


// --- Initialization ---

export async function init() {
    logger.info('Profile Manager init started.');
    try {
        for (let i = 0; i < FAV_COUNT; i++) {
            const button = document.getElementById(`fav-profile-btn-${i}`);
            if (button) favoriteButtons.push(button);
        }
        logger.info('Buttons collected.');

        await openDB();
        logger.info('Database opened.');

        await loadAvailableProfiles();
        logger.info('Available profiles loaded.');

        await loadAssignments();
        logger.info('Assignments loaded.');

        updateButtonUI();
        logger.info('Button UI updated.');

        favoriteButtons.forEach((button, index) => {
            let pressTimer = null;
            let isLongPress = false;

            const startPress = () => {
                isLongPress = false; // Reset on new press
                clearTimeout(pressTimer);
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    handleLongPress(index);
                    pressTimer = null;
                }, LONG_PRESS_DURATION);
            };

            const cancelPress = () => {
                clearTimeout(pressTimer);
            };

            button.addEventListener('click', (e) => {
                if (isLongPress) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return;
                }
                handleProfileClick(index);
            });

            button.addEventListener('mousedown', startPress);
            button.addEventListener('mouseup', cancelPress);
            button.addEventListener('mouseleave', cancelPress);
            button.addEventListener('touchstart', startPress, { passive: true });
            button.addEventListener('touchend', cancelPress);
        });
        logger.info('Event listeners attached.');

        const uploadButton = document.getElementById('upload-profile-btn');
        const fileInput = document.getElementById('profile-upload-input');
        if (uploadButton && fileInput) {
            uploadButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                logger.info('Upload button clicked, attempting to trigger file input.');
                fileInput.click();
            });
            fileInput.addEventListener('change', handleProfileUpload);
        }
        logger.info('Upload button listener attached.');

    } catch (error) {
        logger.error('CRITICAL: Error during Profile Manager initialization:', error);
    }

    logger.info('Profile Manager initialized.');
}
