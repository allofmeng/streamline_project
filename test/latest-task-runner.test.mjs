import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLatestTaskRunner } from '../src/modules/latest-task-runner.js';

test('latest task runner finishes the active task then runs only the newest queued task', async () => {
    let calls = [];
    let releaseFirst;
    const firstDone = new Promise((resolve) => { releaseFirst = resolve; });
    let finish;
    const finished = new Promise((resolve) => { finish = resolve; });
    const enqueue = createLatestTaskRunner(async (value) => {
        calls = [...calls, value];
        if (value === 'first') await firstDone;
        if (value === 'third') finish();
    }, assert.fail);

    enqueue('first');
    enqueue('second');
    enqueue('third');
    releaseFirst();
    await finished;

    assert.deepEqual(calls, ['first', 'third']);
});

test('latest task runner continues after a failed task', async () => {
    let errors = [];
    let finish;
    const finished = new Promise((resolve) => { finish = resolve; });
    const enqueue = createLatestTaskRunner(async (value) => {
        if (value === 'first') throw new Error('failed');
        finish();
    }, (error) => { errors = [...errors, error.message]; });

    enqueue('first');
    enqueue('second');
    await finished;

    assert.deepEqual(errors, ['failed']);
});

test('disposing drops pending work and waits for the active task', async () => {
    let calls = [];
    let release;
    const active = new Promise(resolve => { release = resolve; });
    const enqueue = createLatestTaskRunner(async value => {
        calls = [...calls, value];
        if (value === 'first') await active;
    }, assert.fail);

    enqueue('first');
    enqueue('second');
    const disposed = enqueue.dispose();
    enqueue('third');
    release();
    await disposed;

    assert.deepEqual(calls, ['first']);
});
