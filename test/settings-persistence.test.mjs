// UI preferences must survive an app update: WebView storage (localStorage,
// IndexedDB) belongs to the WebView's origin and is gone after a reinstall or a
// data-directory swap, so src/modules/settingsSync.js mirrors them into
// Decaid's KV store and pulls them back on boot.
// Run: node --test test/settings-persistence.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hydrate, installMirror, SYNCED_KEYS, SETTINGS_NAMESPACE } from '../src/modules/settingsSync.js';

// Stand-in for window.localStorage with a shared prototype to patch, matching
// the browser's Storage/Storage.prototype split.
function makeStorage(initial = {}) {
    class FakeStorage {
        constructor(data) { this._data = { ...data }; }
        getItem(key) { return key in this._data ? this._data[key] : null; }
        setItem(key, value) { this._data[key] = String(value); }
        removeItem(key) { delete this._data[key]; }
        clear() { this._data = {}; }
    }
    return { storage: new FakeStorage(initial), proto: FakeStorage.prototype };
}

test('a synced write is mirrored to KV, an unsynced one is not', () => {
    const { storage, proto } = makeStorage();
    const pushed = [], dropped = [];
    installMirror(proto, (k, v) => pushed.push([k, v]), k => dropped.push(k));

    storage.setItem('theme', 'dark');
    storage.setItem('reaHostname', '10.0.0.5');   // device-specific, never mirrored
    storage.removeItem('theme');

    assert.deepEqual(pushed, [['theme', 'dark']]);
    assert.deepEqual(dropped, ['theme']);
    assert.equal(storage.getItem('reaHostname'), '10.0.0.5', 'the real write still happens');
});

test('credentials and the hostname stay out of the KV store', () => {
    // KV answers over the LAN (webui binds the WiFi address), localStorage does not.
    for (const key of ['visualizerPassword', 'visualizerUsername', 'reaHostname']) {
        assert.ok(!SYNCED_KEYS.includes(key), `${key} must not be mirrored`);
    }
    assert.notEqual(SETTINGS_NAMESPACE, 'streamline',
        'the legacy namespace is a migration source profileManager deletes keys out of');
});

test('clear() also clears the durable copy', () => {
    // Otherwise a reset the user asked for comes straight back on the next boot.
    const { storage, proto } = makeStorage({ theme: 'dark' });
    const dropped = [];
    installMirror(proto, () => {}, k => dropped.push(k));
    storage.clear();
    assert.deepEqual(dropped.sort(), [...SYNCED_KEYS].sort());
});

test('the mirror installs once, so a second call cannot double-push', () => {
    const { storage, proto } = makeStorage();
    const pushed = [];
    installMirror(proto, (k, v) => pushed.push([k, v]), () => {});
    installMirror(proto, (k, v) => pushed.push([k, v]), () => {});
    storage.setItem('theme', 'dark');
    assert.equal(pushed.length, 1);
});

test('after a wipe, boot restores the settings from KV', async () => {
    const { storage, proto } = makeStorage();   // localStorage is empty: fresh install
    const pushed = [];
    const { applied, seeded } = await hydrate(
        storage,
        { theme: 'dark', language: 'de', streamlineHelpHidden: '1' },
        proto.setItem, (k, v) => pushed.push([k, v]),
    );

    assert.equal(storage.getItem('theme'), 'dark');
    assert.equal(storage.getItem('language'), 'de');
    assert.equal(storage.getItem('streamlineHelpHidden'), '1');
    assert.deepEqual(applied, { theme: 'dark', language: 'de', streamlineHelpHidden: '1' });
    assert.deepEqual(seeded, {}, 'nothing local to protect');
    assert.deepEqual(pushed, [], 'hydrating must not echo back to the server');
});

test('the first boot after the update seeds KV from what this device has', async () => {
    // KV is empty and localStorage still holds the real settings — push them up
    // rather than treating the empty store as "no preferences".
    const { storage, proto } = makeStorage({ theme: 'dark', uiZoom: '1.2' });
    const pushed = [];
    const { applied, seeded } = await hydrate(storage, {}, proto.setItem, (k, v) => pushed.push([k, v]));

    assert.deepEqual(applied, {});
    assert.deepEqual(seeded, { theme: 'dark', uiZoom: '1.2' });
    assert.deepEqual(pushed, [['theme', 'dark'], ['uiZoom', '1.2']]);
    assert.equal(storage.getItem('theme'), 'dark', 'local values are left alone');
});

test('KV wins where the two disagree, and untouched keys are left alone', async () => {
    const { storage, proto } = makeStorage({ theme: 'light', uiZoom: '1.0' });
    const writes = [];
    const write = function (key, value) { writes.push(key); proto.setItem.call(this, key, value); };
    const { applied } = await hydrate(storage, { theme: 'dark', uiZoom: '1.0' }, write, () => {});

    assert.equal(storage.getItem('theme'), 'dark');
    assert.deepEqual(applied, { theme: 'dark' });
    assert.deepEqual(writes, ['theme'], 'a matching value must not be rewritten');
});

test('a KV value of null is treated as absent, not as a wipe', async () => {
    // The store answers 200 with null for a key it has never held.
    const { storage, proto } = makeStorage({ theme: 'dark' });
    const { applied, seeded } = await hydrate(storage, { theme: null }, proto.setItem, () => {});
    assert.equal(storage.getItem('theme'), 'dark');
    assert.deepEqual(applied, {});
    assert.deepEqual(seeded, { theme: 'dark' });
});
