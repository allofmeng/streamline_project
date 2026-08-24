// The "Out of water" rule (issue #60): a level warning must not replace the
// status of an operation in progress, must stay quiet on a plumbed machine, and
// must not chatter around the refill threshold.
// Run: node --test test/tank-warning.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTankWarning, shouldShowTankWarning, REFILL_HYSTERESIS_MM } from '../src/modules/tank-warning.js';

test('the warning trips at or below the refill line', () => {
    assert.equal(nextTankWarning(false, 10, 10), true);
    assert.equal(nextTankWarning(false, 9, 10), true);
    assert.equal(nextTankWarning(false, 11, 10), false);
});

test('it holds until the level is back above the line by the hysteresis margin', () => {
    // A refill kit parks the tank right on the threshold; without this the
    // warning flipped on and off with every millimetre of slosh.
    assert.equal(nextTankWarning(true, 10, 10), true);
    assert.equal(nextTankWarning(true, 10 + REFILL_HYSTERESIS_MM - 1, 10), true);
    assert.equal(nextTankWarning(true, 10 + REFILL_HYSTERESIS_MM, 10), false);
});

test('an unknown level or threshold is not a warning', () => {
    assert.equal(nextTankWarning(true, null, 10), false);
    assert.equal(nextTankWarning(true, 5, null), false);
    assert.equal(nextTankWarning(true, undefined, undefined), false);
});

test('an operation in progress keeps its own status', () => {
    // Replacing "steam" here is what tore down the steam elapsed timer and made
    // it restart at 0 on every threshold crossing.
    for (const state of ['steam', 'steamRinse', 'espresso', 'hotWater', 'flush', 'cleaning', 'descaling', 'transportMode']) {
        assert.equal(shouldShowTankWarning({ state, tankLow: true, refillKitSetting: 2 }), false, state);
    }
});

test('an idle machine still gets the warning', () => {
    for (const state of ['idle', 'ready', 'sleeping', 'heating', 'preheating', 'booting']) {
        assert.equal(shouldShowTankWarning({ state, tankLow: true, refillKitSetting: 2 }), true, state);
    }
});

test('a forced-on refill kit fills itself, so the level warning stays quiet', () => {
    assert.equal(shouldShowTankWarning({ state: 'idle', tankLow: true, refillKitSetting: 1 }), false);
    // Auto-detect is indistinguishable from "no kit" through the API, and an
    // unknown setting (advanced settings not fetched yet) must not suppress it.
    assert.equal(shouldShowTankWarning({ state: 'idle', tankLow: true, refillKitSetting: 2 }), true);
    assert.equal(shouldShowTankWarning({ state: 'idle', tankLow: true, refillKitSetting: 0 }), true);
    assert.equal(shouldShowTankWarning({ state: 'idle', tankLow: true, refillKitSetting: null }), true);
});

test('no warning without a low tank, and none over the real needsWater state', () => {
    assert.equal(shouldShowTankWarning({ state: 'idle', tankLow: false, refillKitSetting: 2 }), false);
    assert.equal(shouldShowTankWarning({ state: 'needsWater', tankLow: true, refillKitSetting: 2 }), false);
});
