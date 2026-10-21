import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createChartCadence, DEFAULT_CHART_INTERVAL_MS, MAX_CHART_INTERVAL_MS, MIN_CHART_INTERVAL_MS, projectTraceDelta } from '../src/modules/chart-live-policy.js';

test('cadence falls back for first, frozen, backwards and non-finite timestamps', () => {
    const observe = createChartCadence();
    for (const now of [1000, 1000, 999, NaN, Infinity, 2000]) {
        assert.equal(observe(now), DEFAULT_CHART_INTERVAL_MS);
    }
    assert.equal(observe(2010), MIN_CHART_INTERVAL_MS);
    assert.equal(MIN_CHART_INTERVAL_MS, 25, 'floor lowered after the on-tablet measurement; raise it only with counter-evidence');
    assert.equal(observe(2010), DEFAULT_CHART_INTERVAL_MS);
});

test('fast and burst cadence cannot unthrottle painting', () => {
    const observe = createChartCadence();
    observe(0);
    for (let now = 1; now <= 100; now++) {
        assert.equal(observe(now), MIN_CHART_INTERVAL_MS);
    }
});

test('slow cadence and stalls cannot paint slower than the historical gate', () => {
    const observe = createChartCadence();
    observe(0);
    assert.equal(observe(200), MAX_CHART_INTERVAL_MS);
    assert.equal(observe(10000), MAX_CHART_INTERVAL_MS);
});

test('cadence smooths normal jitter and a new observer starts with the default', () => {
    const observe = createChartCadence();
    observe(0);
    // Express the EMA rather than the post-clamp value: at MIN 100 these read 100
    // only because the floor equalled MAX and swallowed the smoothed estimate.
    assert.equal(observe(50), Math.max(MIN_CHART_INTERVAL_MS, 50));
    assert.equal(observe(130), Math.max(MIN_CHART_INTERVAL_MS, 0.75 * 50 + 0.25 * 80));
    assert.equal(createChartCadence()(130), DEFAULT_CHART_INTERVAL_MS);
});

test('projection returns only the appended tail without reading earlier points', () => {
    const trace = { x: [0, 1], y: [2, 3] };
    const first = projectTraceDelta(trace);
    assert.deepEqual(first.points, [[0, 2], [1, 3]]);
    assert.equal(first.reset, true);
    trace.x.push(2);
    trace.y.push(4);
    // A cached prefix must not even be read, not merely reused after mapping it.
    for (const array of [trace.x, trace.y]) {
        Object.defineProperty(array, 0, { get() { throw new Error('re-read projected prefix'); } });
        Object.defineProperty(array, 1, { get() { throw new Error('re-read projected prefix'); } });
    }
    const second = projectTraceDelta(trace, first);
    assert.deepEqual(second.points, [[2, 4]]);
    assert.equal(second.reset, false);
    assert.deepEqual(projectTraceDelta(trace, second).points, []);
});

test('projection replacement of either source array and truncation invalidate the prefix', () => {
    const trace = { x: [0, 1], y: [2, 3] };
    const first = projectTraceDelta(trace);
    for (const replacement of [
        { x: [5, 6], y: trace.y },
        { x: trace.x, y: [7, 8] }
    ]) {
        const delta = projectTraceDelta(replacement, first);
        assert.equal(delta.reset, true);
        assert.deepEqual(delta.points, replacement.x.map((x, index) => [x, replacement.y[index]]));
    }
    trace.x.length = 1;
    trace.y.length = 1;
    const truncated = projectTraceDelta(trace, first);
    assert.equal(truncated.reset, true);
    assert.deepEqual(truncated.points, [[0, 2]]);
});
