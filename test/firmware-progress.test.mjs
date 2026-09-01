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
    isUploadComplete,
    estimateVerifyRemainingSeconds,
    estimateTotalRemainingSeconds,
    FIRMWARE_ESTIMATED_TOTAL_SECONDS,
    FIRMWARE_VERIFY_SECONDS,
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
    // 20% took 60s => 3s per percent => 80% left = 240s. Upload only; the caller
    // adds the CRC allowance (see firmwareClock in settings.js).
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

test('the measured countdown takes over as soon as one percent has been timed', () => {
    // A 1-point span over a long enough sample is already a real measurement:
    // every chunk is the same size at the same cadence. Holding out for 5%
    // meant minutes of showing the fixed ballpark instead of this machine's
    // actual link speed.
    assert.equal(estimateRemainingSeconds({
        startedAt: T0, startPercent: 1, percent: 2, updatedAt: T0 + 30_000, now: T0 + 30_000,
    }), 30 * 98);
});

test('no countdown before the upload or on too short a sample', () => {
    const base = { startedAt: T0, startPercent: 0, updatedAt: T0 + 60_000, now: T0 + 60_000 };
    assert.equal(estimateRemainingSeconds({ ...base, startedAt: 0, percent: 50 }), null,
        'nothing to measure from until the first uploading event');
    assert.equal(estimateRemainingSeconds({ ...base, startPercent: 4, percent: 4 }), null,
        'no span timed yet');
    assert.equal(estimateRemainingSeconds({
        ...base, percent: 2, updatedAt: T0 + 5_000, now: T0 + 5_000,
    }), null, 'a five-second sample swings too wildly to show');
    assert.equal(estimateRemainingSeconds({ ...base, percent: null }), null);
});

// ── End of upload, without an end-of-upload event ───────────────────────────
// The stream never reports 100%: decaid drops any tick within 1% of the last one
// (firmware_handler.dart), and the bundled image is 463872 B = exactly 28992
// 16-byte chunks, so ticks land on chunks 1, 291 ... 28711 (99%) and the final
// onProgress(1.0) at chunk 28992 is 0.97% later — swallowed. Anything keyed on a
// 100% event is therefore dead code; the projection running out is the signal.
test('the bundled image really does stop emitting at 99%', () => {
    const chunks = 463872 / 16;
    assert.equal(chunks, 28992, 'a whole number of 16-byte chunks');
    const step = Math.ceil(0.01 * chunks); // chunks needed for the delta to clear 1%
    let last = 1;
    while (last + step <= chunks) last += step;
    assert.equal(last, 28711);
    assert.equal(Math.round((last / chunks) * 100), 99, 'last percentage on the wire');
    assert.ok(chunks - last < 0.01 * chunks, 'the final 1.0 tick is inside the 1% gate');
});

test('the upload is complete once the measured projection runs out', () => {
    // Last tick at 99% took 99s for 99 points => 1s/point => ~1s of chunks left.
    const at = now => isUploadComplete({
        startedAt: T0, startPercent: 0, percent: 99, updatedAt: T0 + 99_000, now,
    });
    assert.equal(at(T0 + 99_000), false, 'bytes still going out');
    assert.equal(at(T0 + 101_000), true, 'projected last chunk has gone out');
});

test('a 100% event still counts as complete where one arrives', () => {
    assert.equal(isUploadComplete({ startedAt: T0, percent: 100, updatedAt: T0 + 60_000, now: T0 + 60_000 }), true);
    // ...and nothing is claimed complete before there is anything to measure.
    assert.equal(isUploadComplete({ startedAt: 0, percent: 99, now: T0 }), false);
    assert.equal(isUploadComplete({
        startedAt: T0, startPercent: 0, percent: 2, updatedAt: T0 + 5_000, now: T0 + 5_000,
    }), false, 'unmeasurable is not complete');
});

// ── Verification countdown ──────────────────────────────────────────────────
// The stream is silent from the last chunk to `done`, but the phase is bounded
// by decaid's firmwareVerificationTimeout — a real ceiling, not a guess, so it
// counts down against that instead of the 50-minute ballpark.
test('verification counts down against decaid own timeout', () => {
    assert.equal(estimateVerifyRemainingSeconds(T0, T0), FIRMWARE_VERIFY_SECONDS);
    assert.equal(estimateVerifyRemainingSeconds(T0, T0 + 10_000), FIRMWARE_VERIFY_SECONDS - 10);
});

test('verification countdown is null past the bound, not zero forever', () => {
    // Past here decaid is about to throw 'Timed out waiting for firmware
    // verification' — the caller says "taking longer than usual", not "0:00".
    assert.equal(estimateVerifyRemainingSeconds(T0, T0 + (FIRMWARE_VERIFY_SECONDS + 1) * 1000), null);
    assert.equal(estimateVerifyRemainingSeconds(0, T0), null, 'not verifying yet');
});

// ── Ballpark countdown (erase / pre-first-tick) ─────────────────────────────
// Used only where estimateRemainingSeconds has nothing to extrapolate from —
// see firmwareClock in settings.js.
test('ballpark counts down from the published total estimate', () => {
    assert.equal(estimateTotalRemainingSeconds(T0, T0), FIRMWARE_ESTIMATED_TOTAL_SECONDS);
    assert.equal(estimateTotalRemainingSeconds(T0, T0 + 60_000), FIRMWARE_ESTIMATED_TOTAL_SECONDS - 60);
});

test('ballpark is null once the estimate is exhausted, not negative', () => {
    assert.equal(estimateTotalRemainingSeconds(T0, T0 + (FIRMWARE_ESTIMATED_TOTAL_SECONDS + 1) * 1000), null);
});

test('ballpark is null with nothing started', () => {
    assert.equal(estimateTotalRemainingSeconds(0, T0), null);
});

test('m:ss formatting pads the seconds', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(9), '0:09');
    assert.equal(formatDuration(65), '1:05');
    assert.equal(formatDuration(600), '10:00');
    assert.equal(formatDuration(-5), '0:00');
});
