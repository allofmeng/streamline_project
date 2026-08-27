import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createHistoryPager } from '../src/modules/history-pager.js';

const shots = count => Array.from({ length: count }, (_, index) => ({
    id: `shot-${index}`,
    timestamp: new Date(index * 1000).toISOString()
})).reverse();

test('offline history pages every cached summary', async () => {
    const cached = shots(55);
    const pager = createHistoryPager({
        pageSize: 20,
        fetchServerPage: async () => { throw new Error('offline'); },
        fetchSummaryPage: async (offset, limit) => cached.slice(offset, offset + limit),
        fetchCachedPage: async () => []
    });

    let page = await pager.initial();
    page = await pager.more();
    page = await pager.more();
    assert.equal(page.shots.length, 55);
    assert.deepEqual(page.shots.map(shot => shot.id), cached.map(shot => shot.id));
    assert.equal(page.hasMore, false);
});

test('server and cache use independent offsets and merge duplicate ids', async () => {
    const offsets = [];
    const local = shots(20).map(shot => ({ ...shot, local: true }));
    const server = [{ ...local[0], server: true }, { id: 'server-only', timestamp: new Date(30000).toISOString() }];
    const pager = createHistoryPager({
        pageSize: 20,
        fetchServerPage: async offset => {
            offsets.push(offset);
            return { items: offset === 0 ? server : [], total: server.length };
        },
        fetchSummaryPage: async () => local,
        fetchCachedPage: async () => []
    });

    const page = await pager.initial();
    assert.deepEqual(offsets, [0]);
    assert.equal(page.shots.length, 21);
    assert.equal(page.shots.filter(shot => shot.id === local[0].id).length, 1);
    assert.equal(page.shots.find(shot => shot.id === local[0].id).server, true);
});

test('simultaneous loads share one page request and retry the same server offset after failure', async () => {
    let calls = 0;
    let online = false;
    let release;
    const pager = createHistoryPager({
        pageSize: 20,
        fetchServerPage: async offset => {
            calls += 1;
            assert.equal(offset, 0);
            if (!online) throw new Error('offline');
            await new Promise(resolve => { release = resolve; });
            return { items: [{ id: 'server', timestamp: new Date(1000).toISOString() }], total: 1 };
        },
        fetchSummaryPage: async () => [],
        fetchCachedPage: async () => []
    });

    await pager.initial();
    online = true;
    const first = pager.more();
    const second = pager.more();
    const third = pager.more();
    assert.equal(calls, 2);
    release();
    const pages = await Promise.all([first, second, third]);
    assert.equal(calls, 2);
    assert.equal(pages[0].shots.length, 1);
});

test('updated shots are not replaced by stale later pages', async () => {
    const oldShot = { id: 'shot', timestamp: new Date(1000).toISOString(), title: 'old' };
    let pageNumber = 0;
    const pager = createHistoryPager({
        pageSize: 1,
        fetchServerPage: async () => ({ items: [], total: 0 }),
        fetchSummaryPage: async () => pageNumber++ < 2 ? [oldShot] : [],
        fetchCachedPage: async () => []
    });

    await pager.initial();
    pager.update({ ...oldShot, title: 'new' });
    const page = await pager.more();
    assert.equal(page.shots[0].title, 'new');
});
