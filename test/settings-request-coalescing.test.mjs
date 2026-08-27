import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/modules/api.js', import.meta.url), 'utf8');
const pick = pattern => {
    const match = source.match(pattern);
    assert.ok(match);
    return match[0].replace('export ', '');
};
const cacheSource = [
    pick(/(?:const|let) de1SettingsCache = \{[\s\S]*?\r?\n\};/),
    pick(/(?:const|let) de1AdvancedSettingsCache = \{[\s\S]*?\r?\n\};/),
].join('\n');
const functionSource = [
    pick(/export async function getDe1Settings\(\) \{[\s\S]*?\r?\n\}/),
    pick(/export async function getDe1AdvancedSettings\(\) \{[\s\S]*?\r?\n\}/),
].join('\n');

function createReaders(fetch) {
    return new Function(
        'fetch', 'logger', 'API_BASE_URL', 'firmwareFlashInFlight',
        `${cacheSource}\n${functionSource}\nreturn { getDe1Settings, getDe1AdvancedSettings };`,
    )(fetch, { info() {}, error() {} }, 'http://decaid/api/v1', false);
}

test('concurrent standard settings reads share one request', async () => {
    let finish;
    let calls = 0;
    const fetch = () => {
        calls += 1;
        return new Promise(resolve => {
            finish = () => resolve({ ok: true, json: async () => ({ mode: 'standard' }) });
        });
    };
    const { getDe1Settings } = createReaders(fetch);
    const first = getDe1Settings();
    const second = getDe1Settings();
    assert.equal(calls, 1);
    finish();
    assert.deepEqual(await Promise.all([first, second]), [{ mode: 'standard' }, { mode: 'standard' }]);
    assert.equal(calls, 1);
});

test('concurrent advanced settings reads share one request', async () => {
    let finish;
    let calls = 0;
    const fetch = () => {
        calls += 1;
        return new Promise(resolve => {
            finish = () => resolve({ ok: true, json: async () => ({ mode: 'advanced' }) });
        });
    };
    const { getDe1AdvancedSettings } = createReaders(fetch);
    const first = getDe1AdvancedSettings();
    const second = getDe1AdvancedSettings();
    assert.equal(calls, 1);
    finish();
    assert.deepEqual(await Promise.all([first, second]), [{ mode: 'advanced' }, { mode: 'advanced' }]);
    assert.equal(calls, 1);
});
