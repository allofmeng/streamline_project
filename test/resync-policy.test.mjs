import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decideResync, ECHO_WINDOW_MS } from '../src/modules/resync-policy.js';

const now = 1_000_000;
const decide = (p) => decideResync({ now, ...p });

test('nothing remembered: whatever the workflow holds stands', () => {
    assert.deepEqual(decide({ remembered: null, observed: 250 }), { action: 'none' });
    assert.deepEqual(decide({ remembered: null, observed: undefined }), { action: 'none' });
});

test('agreement is a no-op', () => {
    assert.deepEqual(decide({ remembered: 200, observed: 200 }), { action: 'none' });
});

test('a missing workflow field is filled from the remembered value', () => {
    assert.deepEqual(decide({ remembered: 200, observed: null }), { action: 'push', value: 200 });
    assert.deepEqual(decide({ remembered: 200, observed: undefined }), { action: 'push', value: 200 });
});

test('a value written by something else is adopted, not pushed back (#105)', () => {
    assert.deepEqual(decide({ remembered: 200, observed: 250 }), { action: 'adopt', value: 250 });
});

test('our own unlanded push is retried, even after a reload cleared lastPush', () => {
    assert.deepEqual(decide({ remembered: 250, pending: 250, observed: 200 }), { action: 'push', value: 250 });
});

test('a pending push that has landed is not retried', () => {
    assert.deepEqual(decide({ remembered: 250, pending: 250, observed: 250 }), { action: 'none' });
});

test('pending wins over a store another device rewrote', () => {
    assert.deepEqual(decide({ remembered: 200, pending: 250, observed: 200 }), { action: 'push', value: 250 });
});

test('a stale echo of our own recent push is ignored (decaid gh-678)', () => {
    const lastPush = { value: 250, at: now - 1000 };
    assert.deepEqual(decide({ remembered: 250, observed: 200, lastPush }), { action: 'none' });
});

test('the echo window expires: a later differing value is an outside change', () => {
    const lastPush = { value: 250, at: now - ECHO_WINDOW_MS - 1 };
    assert.deepEqual(decide({ remembered: 250, observed: 200, lastPush }), { action: 'adopt', value: 200 });
});

test('inside the echo window the pushed value itself is never treated as an echo', () => {
    const lastPush = { value: 250, at: now - 1000 };
    assert.deepEqual(decide({ remembered: 200, observed: 250, lastPush }), { action: 'adopt', value: 250 });
});

test('zero is a real value, not an absence', () => {
    assert.deepEqual(decide({ remembered: 0, observed: 30 }), { action: 'adopt', value: 30 });
    assert.deepEqual(decide({ remembered: 30, observed: 0 }), { action: 'adopt', value: 0 });
    assert.deepEqual(decide({ remembered: 0, observed: 0 }), { action: 'none' });
});
