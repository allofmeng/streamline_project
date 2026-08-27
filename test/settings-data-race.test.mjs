import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/settings/settings-data.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replaceAll('export ', '');

function createSettingsData({ getReaSettings = async () => ({}), setReaSettings, getSetting = async () => undefined, setSetting = async () => undefined }) {
    return new Function(
        'getReaSettings', 'setReaSettings', 'openDB', 'getSetting', 'setSetting',
        `${source}\nreturn { getSnapshot, getPendingReaChanges, updateReaSetting, saveSettingsData, startSettingsData };`
    )(
        getReaSettings,
        setReaSettings,
        async () => {},
        getSetting,
        setSetting
    );
}

test('an edit made during save remains pending', async () => {
    const finishes = [];
    const sent = [];
    const settings = createSettingsData({ setReaSettings: changes => {
        sent.push(changes);
        return new Promise(resolve => { finishes.push(resolve); });
    } });

    settings.updateReaSetting('weightFlowMultiplier', 1.1);
    const save = settings.saveSettingsData();
    settings.updateReaSetting('weightFlowMultiplier', 1.2);
    assert.deepEqual(settings.getPendingReaChanges(), { weightFlowMultiplier: 1.2 });
    assert.equal(settings.getSnapshot().rea.weightFlowMultiplier, 1.2);
    finishes[0]();
    await new Promise(resolve => setImmediate(resolve));
    finishes[1]();
    await save;

    assert.deepEqual(sent, [{ weightFlowMultiplier: 1.1 }, { weightFlowMultiplier: 1.2 }]);
    assert.deepEqual(settings.getPendingReaChanges(), {});
    assert.equal(settings.getSnapshot().rea.weightFlowMultiplier, 1.2);
    assert.equal(settings.getSnapshot().dirty, false);
});

test('overlapping saves are serialized and persist the newest edit last', async () => {
    const sent = [];
    const finishes = [];
    const settings = createSettingsData({
        setReaSettings: changes => new Promise(resolve => {
            sent.push(changes);
            finishes.push(resolve);
        })
    });

    settings.updateReaSetting('weightFlowMultiplier', 1.1);
    const first = settings.saveSettingsData();
    settings.updateReaSetting('weightFlowMultiplier', 1.2);
    const second = settings.saveSettingsData();

    assert.strictEqual(second, first);
    assert.deepEqual(sent, [{ weightFlowMultiplier: 1.1 }]);
    finishes[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(sent, [{ weightFlowMultiplier: 1.1 }, { weightFlowMultiplier: 1.2 }]);
    finishes[1]();
    await Promise.all([first, second]);
    assert.equal(settings.getSnapshot().rea.weightFlowMultiplier, 1.2);
    assert.equal(settings.getSnapshot().dirty, false);
});

test('startup refresh cannot overwrite a successful save', async () => {
    let finishRefresh;
    const writes = [];
    const settings = createSettingsData({
        getReaSettings: () => new Promise(resolve => { finishRefresh = resolve; }),
        setReaSettings: async () => {},
        setSetting: async (key, value) => { writes.push([key, value]); }
    });

    const { refresh } = settings.startSettingsData();
    settings.updateReaSetting('weightFlowMultiplier', 1.2);
    await settings.saveSettingsData();
    finishRefresh({ weightFlowMultiplier: 1 });
    await refresh;

    assert.equal(settings.getSnapshot().rea.weightFlowMultiplier, 1.2);
    assert.equal(writes.filter(([key]) => key === 'settings-rea').at(-1)[1].weightFlowMultiplier, 1.2);
});

test('startup hydration cannot overwrite a successful save', async () => {
    let finishHydration;
    let settingsBackupReads = 0;
    const settings = createSettingsData({
        getReaSettings: () => new Promise(() => {}),
        setReaSettings: async () => {},
        getSetting: async key => {
            if (key !== 'settingsBackup' || settingsBackupReads++ > 0) return undefined;
            return new Promise(resolve => { finishHydration = resolve; });
        }
    });

    const { hydration } = settings.startSettingsData();
    settings.updateReaSetting('weightFlowMultiplier', 1.2);
    await settings.saveSettingsData();
    finishHydration({ ts: Date.now(), rea: { weightFlowMultiplier: 1 } });
    await hydration;

    assert.equal(settings.getSnapshot().rea.weightFlowMultiplier, 1.2);
});

test('failed startup refresh preserves a valid cached setting', async () => {
    let finishHydration;
    const writes = [];
    const settings = createSettingsData({
        getReaSettings: async () => null,
        setReaSettings: async () => {},
        getSetting: async key => key === 'settingsBackup'
            ? undefined
            : new Promise(resolve => { finishHydration = resolve; }),
        setSetting: async (key, value) => { writes.push([key, value]); }
    });

    const { hydration, refresh } = settings.startSettingsData();
    await refresh;
    finishHydration({ weightFlowMultiplier: 1.2, volumeFlowMultiplier: 0.4 });
    await hydration;

    assert.deepEqual(settings.getSnapshot().rea, { weightFlowMultiplier: 1.2, volumeFlowMultiplier: 0.4 });
    assert.equal(writes.some(([key, value]) => key === 'settings-rea' && value === null), false);
    assert.match(settings.getSnapshot().error, /returned no data/);
});
