import { getReaSettings, setReaSettings } from '../modules/api.js';
import { openDB, getSetting, setSetting } from '../modules/idb.js';

const DEFAULT_REA = Object.freeze({
    weightFlowMultiplier: 1,
    volumeFlowMultiplier: 0.3
});

let state = Object.freeze({
    rea: DEFAULT_REA,
    loading: false,
    error: null
});
let committedRea = DEFAULT_REA;
let pendingRea = Object.freeze({});
let hydrationPromise = null;
let refreshPromise = null;
let networkApplied = false;
const listeners = new Set();

function publish(nextState) {
    state = Object.freeze(nextState);
    listeners.forEach(listener => listener(getSnapshot()));
}

function applyRea(rea, commit = true) {
    if (!rea) return;
    if (commit) committedRea = Object.freeze({ ...DEFAULT_REA, ...rea });
    publish({
        ...state,
        rea: Object.freeze({ ...committedRea, ...pendingRea })
    });
}

async function hydrateInternal() {
    try {
        await openDB();
        const backup = await getSetting('settingsBackup');
        const freshBackup = backup?.ts && Date.now() - backup.ts < 30 * 24 * 60 * 60 * 1000;
        if (!networkApplied) applyRea(freshBackup ? backup.rea : await getSetting('settings-rea'));
    } catch (error) {
        console.warn('Settings cache hydration failed:', error);
    }
}

async function refreshInternal() {
    publish({ ...state, loading: true, error: null });
    try {
        const rea = await getReaSettings();
        networkApplied = true;
        applyRea(rea);
        try {
            await openDB();
            await setSetting('settings-rea', rea);
        } catch (error) {
            console.warn('Settings cache write failed:', error);
        }
    } catch (error) {
        publish({ ...state, error: error?.message || 'Failed to load settings' });
    } finally {
        publish({ ...state, loading: false });
    }
}

export function getSnapshot() {
    return {
        rea: { ...state.rea },
        loading: state.loading,
        error: state.error,
        dirty: Object.keys(pendingRea).length > 0
    };
}

export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function startSettingsData() {
    hydrationPromise ||= hydrateInternal();
    refreshPromise ||= refreshInternal().finally(() => {
        refreshPromise = null;
    });
    return { hydration: hydrationPromise, refresh: refreshPromise };
}

export function resetSettingsSession() {
    pendingRea = Object.freeze({});
    publish({ ...state, rea: committedRea });
}

export function getPendingReaChanges() {
    return { ...pendingRea };
}

export function updateReaSetting(key, value) {
    if (!Number.isFinite(value)) return;
    pendingRea = Object.freeze({ ...pendingRea, [key]: value });
    publish({
        ...state,
        rea: Object.freeze({ ...state.rea, [key]: value })
    });
}

export async function saveSettingsData() {
    if (Object.keys(pendingRea).length === 0) return;
    const changes = pendingRea;
    await setReaSettings(changes);
    committedRea = Object.freeze({ ...state.rea });
    pendingRea = Object.freeze({});
    try {
        await openDB();
        const backup = await getSetting('settingsBackup');
        await Promise.all([
            setSetting('settings-rea', state.rea),
            setSetting('settingsBackup', {
                ...(backup || {}),
                ts: Date.now(),
                rea: { ...state.rea }
            })
        ]);
    } catch (error) {
        console.warn('Settings backup write failed:', error);
    }
    publish({ ...state });
}
