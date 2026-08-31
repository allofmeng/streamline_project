// Firmware upload progress — NDJSON framing + event normalisation.
//
// POST /api/v1/machine/firmware answers with a newline-delimited JSON stream:
// one `erasing` event when the operation starts, zero or more `uploading` events
// in ~1% increments, then `done` (CRC verification passed) or `error` with
// progress -1.0. Erase and CRC verification emit no intermediate percentages, so
// the stream goes quiet for a stretch at both ends of the upload — a bar that
// only moves on `uploading` looks hung there. Hence the phase, not just the
// percentage, drives the UI.
//
// A final `uploading` may report 1.0 (or near it) BEFORE verification: 100% is
// not success. Only `done` is.
//
// Chunk boundaries are not line boundaries, so the caller keeps a buffer across
// reads — that framing is what splitNdjson does.
//
// DOM-free on purpose so `node --test test/` can import it (see test/README.md).

/** Recognised stream phases, in the order they occur. */
export const FIRMWARE_PHASES = ['erasing', 'uploading', 'done', 'error'];

export function isFirmwareCancellationError(error) {
    const message = typeof error === 'string' ? error : error?.message;
    return typeof message === 'string' && message.includes('FirmwareUpdateCancelledException');
}

/**
 * Frame one decoded chunk into whole JSON lines.
 * @param {string} buffer leftover from the previous call ('' to start)
 * @param {string} chunk newly decoded text ('' on the final flush)
 * @param {boolean} atEnd true on the last read — flushes any unterminated line
 * @returns {{events: object[], rest: string}} parsed objects and the new buffer
 */
export function splitNdjson(buffer, chunk, atEnd = false) {
    const lines = (buffer + chunk).split('\n');
    const rest = atEnd ? '' : lines.pop();
    const events = [];
    for (const line of lines) {
        const text = line.trim();
        if (!text) continue;
        try {
            events.push(JSON.parse(text));
        } catch {
            // A malformed line is not worth aborting a firmware upload over.
            // ponytail: dropped silently; the phase machine just sees one fewer tick.
        }
    }
    return { events, rest };
}

/**
 * Normalise one stream event to { phase, progress }.
 *
 * The phase key is read defensively: this endpoint's payload shape is documented
 * by its event NAMES rather than by a schema, so accept the usual spellings
 * instead of betting the update UI on one of them.
 *
 * @param {object} event
 * @returns {{phase: string|null, progress: number|null}} phase null = unrecognised
 */
export function normalizeFirmwareEvent(event) {
    if (!event || typeof event !== 'object') return { phase: null, progress: null };

    const named = [event.event, event.phase, event.status, event.state]
        .find(v => typeof v === 'string' && FIRMWARE_PHASES.includes(v.toLowerCase()));
    const phase = named ? named.toLowerCase() : null;

    const raw = typeof event.progress === 'number' ? event.progress : null;
    // -1.0 is the error sentinel, not a percentage.
    const progress = raw === null || raw < 0 ? null : Math.min(raw, 1);

    return { phase, progress };
}

/**
 * Fold an event into the running UI state. Percent is monotonic: the erase and
 * verification phases carry no percentage, so they hold the last known one
 * rather than snapping the bar back to 0.
 *
 * @param {{phase: string|null, percent: number, error: string|null}} state
 * @param {object} event raw stream event
 */
export function advanceFirmwareState(state, event) {
    const { phase, progress } = normalizeFirmwareEvent(event);
    if (!phase) return state;
    return {
        phase,
        percent: progress !== null ? Math.round(progress * 100)
            : phase === 'done' ? 100
            : state.percent,
        error: phase === 'error' ? (event.message || event.error || 'Firmware update failed') : null,
    };
}

/** Starting state for advanceFirmwareState. */
export const initialFirmwareState = { phase: null, percent: 0, error: null };

// Below this the extrapolation swings wildly from one event to the next — a
// countdown that jumps by minutes is worse than no countdown.
const MIN_ETA_PERCENT = 5;

/**
 * Seconds left in the upload, extrapolated from the rate the bytes sent so far
 * actually went out at. No fixed guess about how long a flash takes: a DE1 on a
 * weak BLE link is minutes slower than one sitting next to the tablet, and only
 * the observed rate knows which one this is.
 *
 * Measured from the FIRST `uploading` event rather than from the start of the
 * operation, so the erase (silent, no percentages) does not drag the rate down;
 * `startPercent` is where that first event landed, so the percent already done
 * when the clock started is not credited to zero time.
 *
 * The rate is fixed at `updatedAt` — the last event — and the wait since then is
 * subtracted, so the number falls every second the label repaints. Recomputing
 * the rate against `now` instead would make it CLIMB between events (same
 * percent, more elapsed time) and only drop when the next event landed, which is
 * the opposite of a countdown. It floors at 0:00: the percentage next to it is
 * what says whether a stalled clock means "nearly there" or "something is wrong".
 *
 * Returns null when there is nothing to extrapolate from — before the upload
 * starts, in the first few percent, and once the bytes are all sent and the
 * machine is verifying. The caller shows a plain elapsed clock in those
 * stretches; a made-up countdown there would just be a lie with a colon in it.
 *
 * @param {{startedAt: number, startPercent?: number, percent: number|null,
 *          updatedAt?: number, now?: number}} args
 * @returns {number|null} whole seconds, or null when not estimable
 */
export function estimateRemainingSeconds({ startedAt, startPercent = 0, percent, updatedAt, now = Date.now() }) {
    if (!startedAt || typeof percent !== 'number') return null;
    if (percent < MIN_ETA_PERCENT || percent >= 100) return null;
    const measuredAt = updatedAt || now;
    const done = percent - startPercent;
    const elapsed = (measuredAt - startedAt) / 1000;
    if (done <= 0 || elapsed <= 0) return null;
    const projected = (elapsed / done) * (100 - percent);
    return Math.max(0, Math.round(projected - (now - measuredAt) / 1000));
}

/** Seconds as m:ss. */
export function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The whole-operation ballpark shown before there is any real upload rate to
// extrapolate from (erase, and the slow trickle before the first upload tick —
// see the comment on firmwareStartedAt in settings.js). Matches the number
// FIRMWARE_DURATION_NOTE already promises the user, so the UI never states two
// different durations. This is a floor, not a measurement: decaid's own erase
// and verify BLE timeouts are 30s each (unified_de1.dart), but the label can sit
// on "Erase…" for minutes past that while it waits for the first 1%-granularity
// upload event, so a countdown pinned to those short timeouts would hit 0:00
// and then freeze — exactly the "looks hung" symptom this is meant to fix.
export const FIRMWARE_ESTIMATED_TOTAL_SECONDS = 50 * 60;

/**
 * Ballpark countdown against FIRMWARE_ESTIMATED_TOTAL_SECONDS, for the
 * stretches where estimateRemainingSeconds has nothing to extrapolate from.
 * Returns null once the estimate is exhausted — the caller then says "taking
 * longer than usual" instead of showing a countdown that lied about being done.
 */
export function estimateTotalRemainingSeconds(startedAt, now = Date.now()) {
    if (!startedAt) return null;
    const remaining = FIRMWARE_ESTIMATED_TOTAL_SECONDS - (now - startedAt) / 1000;
    return remaining > 0 ? Math.round(remaining) : null;
}

/**
 * Reduce a GET /machine/firmware catalog to what the update check displays.
 *
 * `updateAvailable` is the middleware's own verdict and is authoritative — it is
 * nullable, and null means "could not decide" (offline, unknown build), which is
 * NOT the same as "up to date". Those three cases stay distinct all the way to
 * the UI, because telling someone they are current when nothing was actually
 * compared is the one wrong answer here.
 *
 * The installed build can legitimately be NEWER than anything bundled (a beta
 * machine): that reads as `notApplicable`/`not_newer` and is reported as `ahead`,
 * not as an update.
 *
 * @param {object|null} catalog parsed FirmwareCatalog, or null if unreachable
 * @returns {{status: string, installedBuild: number|null, model: string|null,
 *            latestBuild: number|null, latestLabel: string|null,
 *            artifactId: string|null, releaseNotes: string|null,
 *            reason: string|null, operationState: string}}
 */
export function summarizeFirmwareCatalog(catalog) {
    const empty = {
        status: 'unknown', installedBuild: null, model: null, latestBuild: null,
        latestLabel: null, artifactId: null, releaseNotes: null,
        reason: 'unreachable', operationState: 'idle',
    };
    if (!catalog || typeof catalog !== 'object') return empty;

    const artifacts = Array.isArray(catalog.artifacts) ? catalog.artifacts : [];
    const installedBuild = typeof catalog.machine?.build === 'number' ? catalog.machine.build : null;

    // The recommended artifact is the one the middleware would apply. With none
    // recommended (nothing eligible), fall back to the highest build on offer so
    // the page can still name what is bundled.
    const recommended = artifacts.find(a => a && a.id === catalog.recommendedArtifactId);
    const highest = artifacts.reduce((best, a) => {
        if (!a || typeof a.build !== 'number') return best;
        return !best || a.build > best.build ? a : best;
    }, null);
    const latest = recommended || highest || null;

    // A `not_newer` verdict means the bundle is behind the machine, not that the
    // machine is current — worth saying out loud so a beta build isn't mistaken
    // for a failed check.
    const reasons = latest?.eligibility?.reasons;
    const reason = Array.isArray(reasons) && reasons.length ? reasons[0] : null;

    const status = catalog.updateAvailable === true ? 'updateAvailable'
        : catalog.updateAvailable === false
            ? (reason === 'not_newer' && installedBuild !== null && latest?.build < installedBuild ? 'ahead' : 'upToDate')
            : 'unknown';

    return {
        status,
        installedBuild,
        model: catalog.machine?.model ?? null,
        latestBuild: typeof latest?.build === 'number' ? latest.build : null,
        latestLabel: latest?.versionLabel ?? null,
        artifactId: latest?.id ?? null,
        releaseNotes: latest?.releaseNotes ?? null,
        reason,
        operationState: catalog.operation?.state ?? 'idle',
    };
}
