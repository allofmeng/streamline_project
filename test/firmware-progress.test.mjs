import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    splitNdjson,
    normalizeFirmwareEvent,
    advanceFirmwareState,
    initialFirmwareState,
    summarizeFirmwareCatalog,
    estimateRemainingSeconds,
    formatDuration,
} from '../src/modules/firmware-progress.js';

function loadConsumeFirmwareStream() {
    const source = readFileSync(new URL('../src/modules/api.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const start = source.indexOf('async function consumeFirmwareStream');
    const end = source.indexOf('export async function uploadFirmware', start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    return new Function('splitNdjson', 'advanceFirmwareState', 'initialFirmwareState', `${source.slice(start, end)}; return consumeFirmwareStream;`)(splitNdjson, advanceFirmwareState, initialFirmwareState);
}

/** Feed a stream of decoded chunks through framing + folding, as api.js does. */
function runStream(chunks) {
    let buffer = '';
    let state = initialFirmwareState;
    const seen = [];
    chunks.forEach((chunk, i) => {
        const atEnd = i === chunks.length - 1;
        const { events, rest } = splitNdjson(buffer, chunk, atEnd);
        buffer = rest;
        for (const event of events) {
            state = advanceFirmwareState(state, event);
            seen.push({ ...state });
        }
    });
    return { state, seen };
}

test('lines split across chunk boundaries are reassembled', () => {
    const { seen } = runStream([
        '{"event":"erasing"}\n{"event":"upl',
        'oading","progress":0.5}\n',
        '{"event":"done"}\n',
    ]);
    assert.deepEqual(seen.map(s => s.phase), ['erasing', 'uploading', 'done']);
    assert.deepEqual(seen.map(s => s.percent), [0, 50, 100]);
});

test('a final line without a trailing newline is still parsed', () => {
    const { state } = runStream(['{"event":"erasing"}\n{"event":"done"}']);
    assert.equal(state.phase, 'done');
});

test('a response without a readable progress stream is not success', async () => {
    await assert.rejects(loadConsumeFirmwareStream()({ body: null }), /did not provide a progress stream/);
});

test('blank and malformed lines are skipped, not thrown', () => {
    const { events } = splitNdjson('', '\n{"event":"erasing"}\n{oops\n\n', false);
    assert.deepEqual(events, [{ event: 'erasing' }]);
});

test('phase key is read defensively across spellings', () => {
    for (const event of [{ event: 'uploading' }, { phase: 'uploading' }, { status: 'uploading' }, { state: 'uploading' }]) {
        assert.equal(normalizeFirmwareEvent(event).phase, 'uploading');
    }
    assert.equal(normalizeFirmwareEvent({ event: 'something-else' }).phase, null);
    assert.equal(normalizeFirmwareEvent(null).phase, null);
});

test('the -1.0 error sentinel is not treated as a percentage', () => {
    assert.equal(normalizeFirmwareEvent({ event: 'error', progress: -1.0 }).progress, null);

    const state = advanceFirmwareState({ phase: 'uploading', percent: 98, error: null },
        { event: 'error', progress: -1.0, message: 'CRC mismatch' });
    assert.equal(state.phase, 'error');
    assert.equal(state.error, 'CRC mismatch');
    assert.equal(state.percent, 98); // held, not rewound to 0 or -100
});

test('percent holds through the silent verification phase', () => {
    // Last uploading event can report 1.0 before CRC verification even starts.
    const { seen, state } = runStream([
        '{"event":"erasing"}\n{"event":"uploading","progress":0.99}\n{"event":"uploading","progress":1.0}\n{"event":"done"}\n',
    ]);
    assert.deepEqual(seen.map(s => s.percent), [0, 99, 100, 100]);
    assert.equal(state.phase, 'done');
});

test('unrecognised events leave the state untouched', () => {
    const before = { phase: 'uploading', percent: 42, error: null };
    assert.deepEqual(advanceFirmwareState(before, { hello: 'world' }), before);
});

// ── summarizeFirmwareCatalog ────────────────────────────────────────────────

/** The shape GET /machine/firmware actually returns, minus the noise. */
function catalog({ build, artifactBuild = 1352, updateAvailable, reasons = [], recommended = null, operation = 'idle' }) {
    return {
        artifacts: [{
            id: `de1-${artifactBuild}`, build: artifactBuild, versionLabel: String(artifactBuild),
            releaseNotes: 'Fixed a thing.',
            eligibility: { status: reasons.length ? 'notApplicable' : 'applicable', reasons },
        }],
        machine: build === null ? null : { model: 'DE1Pro', build },
        recommendedArtifactId: recommended,
        updateAvailable,
        operation: { state: operation },
    };
}

test('an offered newer build reads as an update', () => {
    const s = summarizeFirmwareCatalog(catalog({ build: 1340, updateAvailable: true, recommended: 'de1-1352' }));
    assert.equal(s.status, 'updateAvailable');
    assert.equal(s.installedBuild, 1340);
    assert.equal(s.latestBuild, 1352);
    assert.equal(s.artifactId, 'de1-1352');
    assert.equal(s.releaseNotes, 'Fixed a thing.');
});

test('installed build newer than the bundle is "ahead", not "up to date"', () => {
    // The live case on a beta machine: build 1357 vs bundled 1352.
    const s = summarizeFirmwareCatalog(catalog({ build: 1357, updateAvailable: false, reasons: ['not_newer'] }));
    assert.equal(s.status, 'ahead');
    assert.equal(s.installedBuild, 1357);
    assert.equal(s.latestBuild, 1352);
});

test('matching the bundled build reads as up to date', () => {
    const s = summarizeFirmwareCatalog(catalog({ build: 1352, updateAvailable: false, reasons: ['not_newer'] }));
    assert.equal(s.status, 'upToDate');
});

test('a null verdict is unknown, never up to date', () => {
    // Offline: no machine, so nothing was actually compared. Reporting this as
    // "up to date" would be the one genuinely harmful answer.
    const s = summarizeFirmwareCatalog(catalog({ build: null, updateAvailable: null, reasons: ['machine_not_connected'] }));
    assert.equal(s.status, 'unknown');
    assert.equal(s.reason, 'machine_not_connected');
    assert.equal(s.installedBuild, null);
});

test('an unreachable service is unknown with a reason', () => {
    const s = summarizeFirmwareCatalog(null);
    assert.equal(s.status, 'unknown');
    assert.equal(s.reason, 'unreachable');
});

test('an in-flight operation is surfaced', () => {
    const s = summarizeFirmwareCatalog(catalog({ build: 1340, updateAvailable: true, operation: 'uploading' }));
    assert.equal(s.operationState, 'uploading');
});

test('an empty catalog does not throw', () => {
    const s = summarizeFirmwareCatalog({ artifacts: [], machine: null, updateAvailable: null, operation: { state: 'idle' } });
    assert.equal(s.status, 'unknown');
    assert.equal(s.latestBuild, null);
});

// ── Upload countdown ────────────────────────────────────────────────────────
// The label counts DOWN through the upload. Times are epoch ms; `startedAt` is
// the first `uploading` event, not the start of the operation (the erase carries
// no percentages and would skew the rate). 0 is the "not started" sentinel, so
// these use a real-looking epoch.
const T0 = 1_700_000_000_000;

test('remaining is extrapolated from the observed upload rate', () => {
    // 20% took 60s => 3s per percent => 80% left = 240s.
    const remaining = estimateRemainingSeconds({
        startedAt: T0, startPercent: 0, percent: 20, updatedAt: T0 + 60_000, now: T0 + 60_000,
    });
    assert.equal(remaining, 240);
});

test('the percent already done when the clock started is not credited to zero time', () => {
    // First event landed at 10%; 10% -> 30% took 60s => 3s per percent => 70% left.
    assert.equal(estimateRemainingSeconds({
        startedAt: T0, startPercent: 10, percent: 30, updatedAt: T0 + 60_000, now: T0 + 60_000,
    }), 210);
    // Ignoring startPercent would price 30% into 60s and understate the wait.
    assert.equal(estimateRemainingSeconds({
        startedAt: T0, startPercent: 0, percent: 30, updatedAt: T0 + 60_000, now: T0 + 60_000,
    }), 140);
});

test('the countdown falls between events instead of climbing', () => {
    const at = now => estimateRemainingSeconds({
        startedAt: T0, startPercent: 0, percent: 20, updatedAt: T0 + 60_000, now,
    });
    // Same event, three repaints of the 1 Hz label.
    assert.equal(at(T0 + 60_000), 240);
    assert.equal(at(T0 + 70_000), 230);
    assert.equal(at(T0 + 90_000), 210);
});

test('a stalled stream floors at zero rather than going negative', () => {
    assert.equal(estimateRemainingSeconds({
        startedAt: T0, startPercent: 0, percent: 20, updatedAt: T0 + 60_000, now: T0 + 10_000_000,
    }), 0);
});

test('no countdown before the upload, in the first few percent, or while verifying', () => {
    const base = { startedAt: T0, startPercent: 0, updatedAt: T0 + 60_000, now: T0 + 60_000 };
    assert.equal(estimateRemainingSeconds({ ...base, startedAt: 0, percent: 50 }), null,
        'nothing to measure from until the first uploading event');
    assert.equal(estimateRemainingSeconds({ ...base, percent: 4 }), null,
        'too noisy to show in the first few percent');
    assert.equal(estimateRemainingSeconds({ ...base, percent: 100 }), null,
        'the bytes are sent; verification carries no percentage to project');
    assert.equal(estimateRemainingSeconds({ ...base, percent: null }), null);
});

test('m:ss formatting pads the seconds', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(9), '0:09');
    assert.equal(formatDuration(65), '1:05');
    assert.equal(formatDuration(600), '10:00');
    assert.equal(formatDuration(-5), '0:00');
});
