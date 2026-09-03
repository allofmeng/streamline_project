// The two Visualizer switches over the plugin's single AutoUpload flag, and the
// manual per-shot upload the history long-press menu calls.
// Run: node --test test/visualizer.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = {
    store: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; },
};

const {
    VISUALIZER_PLUGIN_ID, setVisualizerApi, isVisualizerEnabled, isAutoUploadEnabled,
    setVisualizerEnabled, setAutoUpload, uploadShotToVisualizer,
} = await import('../src/modules/visualizer.js');

function reset(keys = {}) {
    localStorage.store = { ...keys };
    const calls = [];
    setVisualizerApi({
        setPluginSettings: async (id, settings) => { calls.push(['settings', id, settings]); return true; },
        callPluginEndpoint: async (id, endpoint, body) => {
            calls.push(['call', id, endpoint, body]);
            if (body.shotId === 'short') throw new Error('Not uploading shot because it\'s too short: 3');
            return { visualizer_id: 'vis-1' };
        },
    });
    return calls;
}

test('both switches off by default — an unconfigured install uploads nothing', () => {
    reset();
    assert.equal(isVisualizerEnabled(), false);
    assert.equal(isAutoUploadEnabled(), false);
});

test('auto-upload is on unless the user turned it off', () => {
    reset({ visualizerEnabled: 'true' });
    assert.equal(isAutoUploadEnabled(), true, 'no stored choice means the plugin default, on');
    reset({ visualizerEnabled: 'true', visualizerAutoUpload: 'false' });
    assert.equal(isAutoUploadEnabled(), false);
});

test('the master switch off keeps shots on the machine, whatever auto-upload says', () => {
    reset({ visualizerEnabled: 'false', visualizerAutoUpload: 'true' });
    assert.equal(isAutoUploadEnabled(), false);
});

test('turning Visualizer off pushes AutoUpload:false to the plugin', async () => {
    const calls = reset({ visualizerEnabled: 'true', visualizerAutoUpload: 'true' });
    await setVisualizerEnabled(false);
    assert.deepEqual(calls.at(-1), ['settings', VISUALIZER_PLUGIN_ID, { AutoUpload: false }]);
    assert.equal(localStorage.getItem('visualizerEnabled'), 'false');
});

test('turning Visualizer back on restores the user\'s own auto-upload choice', async () => {
    const calls = reset({ visualizerEnabled: 'false', visualizerAutoUpload: 'false' });
    await setVisualizerEnabled(true);
    assert.deepEqual(calls.at(-1), ['settings', VISUALIZER_PLUGIN_ID, { AutoUpload: false }], 'still off by choice');
    await setAutoUpload(true);
    assert.deepEqual(calls.at(-1), ['settings', VISUALIZER_PLUGIN_ID, { AutoUpload: true }]);
});

test('auto-upload cannot be switched on while Visualizer itself is off', async () => {
    const calls = reset({ visualizerEnabled: 'false' });
    await setAutoUpload(true);
    assert.deepEqual(calls.at(-1), ['settings', VISUALIZER_PLUGIN_ID, { AutoUpload: false }]);
    assert.equal(localStorage.getItem('visualizerAutoUpload'), 'true', 'the choice is remembered for later');
});

test('a manual upload posts the shot id and answers with the visualizer id', async () => {
    const calls = reset({ visualizerEnabled: 'true', visualizerAutoUpload: 'false' });
    const id = await uploadShotToVisualizer('shot-42');
    assert.deepEqual(calls.at(-1), ['call', VISUALIZER_PLUGIN_ID, 'upload', { shotId: 'shot-42' }]);
    assert.equal(id, 'vis-1');
});

test('a manual upload without a shot never reaches the plugin', async () => {
    const calls = reset({ visualizerEnabled: 'true' });
    await assert.rejects(() => uploadShotToVisualizer(undefined), /No shot to upload/);
    assert.equal(calls.length, 0);
});

test('the plugin\'s own refusal reaches the caller for the toast', async () => {
    reset({ visualizerEnabled: 'true' });
    await assert.rejects(() => uploadShotToVisualizer('short'), /too short/);
});
