// Durable home for the user's UI preferences.
//
// Everything in localStorage (and IndexedDB) belongs to the WebView's origin:
// it is lost when the host app is reinstalled, when its data directory is
// replaced, or when the skin ends up served from a different port. Decaid's KV
// store is a Hive box in the app's own data directory — the same place profiles
// and shots live, so it survives an app update, and Decaid's backup export
// walks every KV namespace, so these settings ride along in a backup too.
//
// The shape is deliberately dumb: localStorage stays the working copy that all
// the existing synchronous `localStorage.getItem(...)` call sites read, and KV
// is a mirror behind it. On boot we pull the mirror down; on every write we
// push the key up. No new read API, no call-site changes.

import { logger } from './logger.js';

// Own namespace. NOT 'streamline' — profileManager treats that one as a
// migration source and deletes keys out of it once they are imported.
export const SETTINGS_NAMESPACE = 'streamlineSettings';

// Preferences the user set on purpose and would have to hunt through Settings
// to restore. Machine-side settings (temperatures, flush, steam targets) are
// already Decaid's and are not mirrored here.
//
// Deliberately excluded:
//  - reaHostname: names the Decaid we are talking to, so it cannot come from it.
//  - visualizer credentials: the KV store answers over the LAN (webui binds the
//    WiFi address), and a password in localStorage is at least confined to the
//    WebView. Not worth the trade for skipping one re-login after an update.
//  - smde_*: draft text from the notes editor, not a setting.
export const SYNCED_KEYS = [
    'language',
    'theme',
    'uiZoom',
    'maxStretch',
    'streamlineHelpHidden',
    'streamlineHelpLaunches',
    'screensaverEnabled',
    'screensaverCycleSeconds',
    'blackScreenSaver',
    'wakeLockEnabled',
    'waterTankUnit',
    'waterRefillLevel',
    'keyboardBindings',
    'streamline.steamStopMode',
    'streamline.steamStopModeFallback',
    'streamline.cupWarmerTarget',
    'streamline.dye2Enabled',
    'streamline.dyeStripMode',
    'streamline.ecoSteam',
    'streamline.settings.location',
    'tempUnit',
    'visualizerEnabled',
    'visualizerAutoUpload',
];

const synced = new Set(SYNCED_KEYS);

// Mirror writes to KV by wrapping Storage.prototype once, rather than editing
// the ~100 existing setItem call sites. Writes are fire-and-forget: a settings
// change must never block on (or fail because of) the network.
export function installMirror(storageProto, push, drop) {
    if (storageProto.__streamlineMirrored) return;
    const { setItem, removeItem, clear } = storageProto;
    storageProto.setItem = function (key, value) {
        setItem.call(this, key, value);
        if (synced.has(key)) push(key, String(value));
    };
    storageProto.removeItem = function (key) {
        removeItem.call(this, key);
        if (synced.has(key)) drop(key);
    };
    // clear() is a reset, and a reset the user asked for should clear the
    // durable copy too — otherwise the next boot hydrates it all back.
    storageProto.clear = function () {
        clear.call(this);
        for (const key of synced) drop(key);
    };
    storageProto.__streamlineMirrored = true;
    return () => { Object.assign(storageProto, { setItem, removeItem, clear }); delete storageProto.__streamlineMirrored; };
}

// Pull KV into localStorage, then push up anything KV does not have yet.
// KV wins on conflict: it is the copy that survived, and the local copy after a
// wipe is either absent or a stock default.
// `write` is the *unwrapped* setter — hydrating must not echo straight back to
// the server. Returns what changed, for the caller and for the test.
export async function hydrate(storage, remote, write, push) {
    const applied = {};
    const seeded = {};
    for (const key of SYNCED_KEYS) {
        const value = remote[key];
        const local = storage.getItem(key);
        if (value === undefined || value === null) {
            // Nothing durable yet — protect what this device already has.
            if (local !== null) { seeded[key] = local; push(key, local); }
            continue;
        }
        const str = String(value);
        if (local !== str) { write.call(storage, key, str); applied[key] = str; }
    }
    return { applied, seeded };
}

// Boot-time wiring. Kept out of hydrate() so the logic above stays testable.
async function boot() {
    // Imported here, not at the top: api.js pulls in the DOM-touching modules,
    // and keeping this file importable on its own is what makes it testable.
    const { getKVAll, setKVValue, deleteKVValue } = await import('./api.js');
    const { openDB, setSetting } = await import('./idb.js');

    const proto = window.Storage.prototype;
    const rawSetItem = proto.setItem;
    installMirror(
        proto,
        (key, value) => setKVValue(SETTINGS_NAMESPACE, key, value)
            .catch(e => logger.info(`settings push ${key} failed: ${e.message}`)),
        (key) => deleteKVValue(SETTINGS_NAMESPACE, key)
            .catch(e => logger.info(`settings drop ${key} failed: ${e.message}`)),
    );

    let remote;
    try {
        remote = await getKVAll(SETTINGS_NAMESPACE);
    } catch (e) {
        // No Decaid (browser dev, or the app is still starting): run on whatever
        // localStorage has. Later writes still try to push.
        logger.info(`settings hydrate skipped: ${e.message}`);
        return;
    }

    const { applied } = await hydrate(
        localStorage, remote, rawSetItem,
        (key, value) => setKVValue(SETTINGS_NAMESPACE, key, value).catch(() => {}),
    );

    // The theme was already applied by the inline script in index.html, before
    // this ran — re-apply it if KV disagreed.
    if (applied.theme) document.documentElement.setAttribute('data-theme', applied.theme);
    // i18n reads IndexedDB first and only falls back to localStorage, so a stale
    // IDB copy would outrank what we just hydrated. setSetting rejects unless the
    // DB is already open, and this runs before initI18n opens it.
    if (applied.language) {
        await openDB().then(() => setSetting('language', applied.language)).catch(() => {});
    }

    if (Object.keys(applied).length) logger.info(`Restored settings from KV: ${Object.keys(applied).join(', ')}`);
}

// Await this before reading any synced preference. Resolves either way — a
// hydrate failure must not stop the app booting.
export const settingsReady = typeof window === 'undefined'
    ? Promise.resolve()
    : boot().catch(e => { logger.warn('Settings hydrate failed', e); });
