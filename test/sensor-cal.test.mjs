import test from 'node:test';
import assert from 'node:assert/strict';

import {
    parseSensorCalInput,
    previewCalibration,
    absoluteSetCorrection,
    formatCalValue,
    sensorCalTarget,
    snapshotGoal,
    correctionBlocked,
    SENSOR_CAL_TARGETS,
    SENSOR_CAL_MIN,
    SENSOR_CAL_MAX,
} from '../src/modules/sensor-cal.js';

// --- input parsing ----------------------------------------------------------

test('parseSensorCalInput: accepts decimals and negatives', () => {
    assert.equal(parseSensorCalInput('9.5'), 9.5);
    assert.equal(parseSensorCalInput(' 92 '), 92);
    assert.equal(parseSensorCalInput('-1.25'), -1.25);
    assert.equal(parseSensorCalInput(0), 0);
});

test('parseSensorCalInput: blank and unparseable are null, not 0', () => {
    for (const bad of ['', '   ', null, undefined, 'abc', '9,5', NaN, Infinity]) {
        assert.equal(parseSensorCalInput(bad), null, `${String(bad)} must not parse`);
    }
});

// Decaid 400s anything outside the signed Q16.16 range, so the page has to
// stop it at the input rather than round-trip a rejection.
test('parseSensorCalInput: rejects values outside the Q16.16 range', () => {
    assert.equal(parseSensorCalInput(SENSOR_CAL_MIN), SENSOR_CAL_MIN);
    assert.equal(parseSensorCalInput(SENSOR_CAL_MAX), SENSOR_CAL_MAX);
    assert.equal(parseSensorCalInput(SENSOR_CAL_MIN - 1), null);
    assert.equal(parseSensorCalInput(40000), null);
});

// --- the firmware's own arithmetic ------------------------------------------

test('previewCalibration: ratio multiplies, offset adds', () => {
    // gauge read 9.5 where the DE1 said 9.0, on a stored 1.0 multiplier
    assert.equal(previewCalibration('ratio', 1, 9, 9.5).toFixed(4), '1.0556');
    // thermometer read 90.5 where the DE1 said 92, on a stored 0 offset
    assert.equal(previewCalibration('offset', 0, 92, 90.5), -1.5);
});

test('previewCalibration: folds into a calibration that is already non-default', () => {
    assert.equal(previewCalibration('ratio', 1.1, 10, 11), 1.2100000000000002);
    assert.equal(previewCalibration('offset', -1.5, 92, 91), -2.5);
});

test('previewCalibration: not computable returns null, never a wrong number', () => {
    assert.equal(previewCalibration('ratio', 1, 0, 9.5), null);
    assert.equal(previewCalibration('ratio', null, 9, 9.5), null);
    assert.equal(previewCalibration('offset', 0, 92, undefined), null);
});

// This is the whole reason the page previews and then clears its inputs: the
// same pair applied twice is a different, wrong calibration.
test('previewCalibration: a correction applied twice compounds', () => {
    const once = previewCalibration('ratio', 1, 1, 1.05);
    const twice = previewCalibration('ratio', once, 1, 1.05);
    assert.equal(once, 1.05);
    assert.equal(twice.toFixed(4), '1.1025');
});

// --- absolute set (used by factory reset) -----------------------------------

test('absoluteSetCorrection: lands exactly on the wanted value, both kinds', () => {
    const fromRatio = absoluteSetCorrection(1.1025, 1.0);
    assert.deepEqual(fromRatio, { de1ReportedValue: 1.1025, measuredValue: 1.0 });
    assert.equal(previewCalibration('ratio', 1.1025, fromRatio.de1ReportedValue, fromRatio.measuredValue), 1.0);

    const fromOffset = absoluteSetCorrection(-2.5, 0);
    assert.equal(previewCalibration('offset', -2.5, fromOffset.de1ReportedValue, fromOffset.measuredValue), 0);
});

test('absoluteSetCorrection: repeating it is a no-op (safe to press twice)', () => {
    const again = absoluteSetCorrection(1.0, 1.0);
    assert.equal(previewCalibration('ratio', 1.0, again.de1ReportedValue, again.measuredValue), 1.0);
    assert.equal(previewCalibration('offset', 0, 0, 0), 0);
});

// --- display ----------------------------------------------------------------

test('formatCalValue: multipliers get 4 decimals, offsets get a sign', () => {
    assert.equal(formatCalValue('ratio', 1), '1.0000');
    assert.equal(formatCalValue('offset', 0), '+0.00');
    assert.equal(formatCalValue('offset', -1.5), '-1.50');
    assert.equal(formatCalValue('ratio', null), '—');
});

test('sensorCalTarget: the three firmware targets, and nothing else', () => {
    assert.deepEqual(SENSOR_CAL_TARGETS.map((t) => t.id), ['temperature', 'pressure', 'flow']);
    assert.equal(sensorCalTarget('flow').kind, 'ratio');
    assert.equal(sensorCalTarget('temperature').kind, 'offset');
    assert.equal(sensorCalTarget('nope'), null);
});

// --- live capture (the "DE1 now" column) ------------------------------------

test('snapshotGoal: reads what the machine is targeting, not what it senses', () => {
    const frame = { groupTemperature: 90.3, targetGroupTemperature: 92,
                    pressure: 8.9, targetPressure: 9, flow: 2.1, targetFlow: 2 };
    assert.equal(snapshotGoal(sensorCalTarget('temperature'), frame), 92);
    assert.equal(snapshotGoal(sensorCalTarget('pressure'), frame), 9);
    assert.equal(snapshotGoal(sensorCalTarget('flow'), frame), 2);
});

// No frame yet = machine asleep or disconnected. Capture has to say so
// rather than quietly hand a correction a 0 for what the DE1 reported.
test('snapshotGoal: no frame or missing field reads null, never 0', () => {
    assert.equal(snapshotGoal(sensorCalTarget('flow'), null), null);
    assert.equal(snapshotGoal(sensorCalTarget('flow'), {}), null);
    assert.equal(snapshotGoal(sensorCalTarget('flow'), { targetFlow: null }), null);
    assert.equal(snapshotGoal(null, { targetFlow: 2 }), null);
});

// --- zero guards ------------------------------------------------------------

// An idle machine targets nothing: every goal reads 0. Correcting against
// it divides by zero (ratio) or shoves the whole reading into the offset.
test('correctionBlocked: a zero goal is refused for every target', () => {
    assert.ok(correctionBlocked('ratio', 0, 9.5).length > 0);
    assert.ok(correctionBlocked('offset', 0, 90.5).length > 0);
});

test('correctionBlocked: a measured zero is refused only where it multiplies', () => {
    assert.ok(correctionBlocked('ratio', 9, 0).length > 0);
    assert.equal(correctionBlocked('offset', 92, 0), '');
    assert.equal(correctionBlocked('ratio', 9, 9.5), '');
});
