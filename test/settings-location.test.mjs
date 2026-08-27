import test from 'node:test';
import assert from 'node:assert/strict';

const values = new Map();
globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
};

const { readSettingsLocation, writeSettingsLocation } = await import('../src/settings/settings-location.js');

test('settings location survives the next settings visit', () => {
    writeSettingsLocation('machine', 'machineinfo');
    assert.deepEqual(readSettingsLocation(), {
        mainCategory: 'machine',
        category: 'machineinfo'
    });
});

test('invalid saved settings locations are ignored', () => {
    values.set('streamline.settings.location', '{broken');
    assert.equal(readSettingsLocation(), null);
});
