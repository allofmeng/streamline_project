function mergeShots(existing, pages) {
    const byId = new Map(existing.map(shot => [shot.id, shot]));
    for (const shot of pages.flat()) {
        const current = byId.get(shot.id);
        byId.set(shot.id, current
            ? { ...current, ...shot, ...(current.measurements && !shot.measurements ? { measurements: current.measurements } : {}) }
            : shot);
    }
    return [...byId.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function createHistoryPager({ pageSize, fetchServerPage, fetchSummaryPage, fetchCachedPage }) {
    let shots = [];
    let server = { offset: 0, exhausted: false, failed: false };
    let summaries = { offset: 0, exhausted: false };
    let cached = { offset: 0, exhausted: false };
    let updatedShots = new Map();
    let loadPromise = null;

    async function loadPage() {
        const results = await Promise.allSettled([
            server.exhausted ? [] : fetchServerPage(server.offset, pageSize),
            summaries.exhausted ? [] : fetchSummaryPage(summaries.offset, pageSize),
            cached.exhausted ? [] : fetchCachedPage(cached.offset, pageSize)
        ]);
        const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
        const serverPage = results[0].status === 'fulfilled' ? results[0].value : null;
        const summaryPage = results[1].status === 'fulfilled' ? results[1].value : [];
        const cachedPage = results[2].status === 'fulfilled' ? results[2].value : [];

        if (serverPage) {
            const items = serverPage.items ?? [];
            const offset = server.offset + items.length;
            server = {
                offset,
                exhausted: Number.isFinite(serverPage.total) ? offset >= serverPage.total : items.length < pageSize,
                failed: false
            };
        } else if (results[0].status === 'rejected') {
            server = { ...server, failed: true };
        }
        if (results[1].status === 'fulfilled') {
            summaries = { offset: summaries.offset + summaryPage.length, exhausted: summaryPage.length < pageSize };
        } else {
            summaries = { ...summaries, exhausted: true };
        }
        if (results[2].status === 'fulfilled') {
            cached = { offset: cached.offset + cachedPage.length, exhausted: cachedPage.length < pageSize };
        } else {
            cached = { ...cached, exhausted: true };
        }

        shots = mergeShots(shots, [summaryPage, cachedPage, serverPage?.items ?? []]);
        shots = mergeShots(shots, [[...updatedShots.values()]]);
        return { shots: [...shots], hasMore: (!server.exhausted && !server.failed) || !summaries.exhausted || !cached.exhausted, errors };
    }

    function load() {
        if (!loadPromise) loadPromise = loadPage().finally(() => { loadPromise = null; });
        return loadPromise;
    }

    return {
        initial() {
            shots = [];
            server = { offset: 0, exhausted: false, failed: false };
            summaries = { offset: 0, exhausted: false };
            cached = { offset: 0, exhausted: false };
            updatedShots = new Map();
            return load();
        },
        more: load,
        hasMore: () => (!server.exhausted && !server.failed) || !summaries.exhausted || !cached.exhausted,
        update(shot) {
            shots = mergeShots(shots, [[shot]]);
            updatedShots = new Map([...updatedShots, [shot.id, shots.find(item => item.id === shot.id)]]);
            return [...shots];
        },
        remove(id) {
            if (shots.some(shot => shot.id === id)) {
                server = { ...server, offset: Math.max(0, server.offset - 1) };
                summaries = { ...summaries, offset: Math.max(0, summaries.offset - 1) };
                cached = { ...cached, offset: Math.max(0, cached.offset - 1) };
            }
            updatedShots = new Map([...updatedShots].filter(([shotId]) => shotId !== id));
            shots = shots.filter(shot => shot.id !== id);
            return [...shots];
        }
    };
}
