import assert from 'node:assert/strict';
import { test } from 'node:test';

test('main chart observation is restored after subpage cleanup', async () => {
    const observed = [];
    const unobserved = [];
    class ResizeObserver {
        observe(element) { observed.push(element.id); }
        unobserve(element) { unobserved.push(element.id); }
    }
    const mainChart = { id: 'main-chart', clientWidth: 960, clientHeight: 390 };
    const profileChart = { id: 'profile-chart', clientWidth: 960, clientHeight: 390 };
    const mainPage = {
        style: { display: 'block' },
        querySelector: selector => selector === '#plotly-chart' ? mainChart : null
    };
    const subpageHost = {
        querySelector: selector => selector === '#plotly-chart' ? profileChart : null,
        querySelectorAll: selector => selector === '#plotly-chart' ? [profileChart] : [],
        contains: element => element === profileChart
    };
    const documentTarget = new EventTarget();
    Object.assign(documentTarget, {
        visibilityState: 'visible',
        getElementById: id => ({ 'main-page': mainPage, 'subpage-host': subpageHost })[id] || null,
        createElement: () => ({ style: {}, getContext: () => ({ measureText: text => ({ width: text.length * 8 }) }) })
    });
    const windowTarget = new EventTarget();
    windowTarget.ResizeObserver = ResizeObserver;

    globalThis.document = documentTarget;
    globalThis.window = windowTarget;
    globalThis.localStorage = { getItem: () => 'light' };

    const chart = await import(`../src/modules/chart.js?lifecycle=${Date.now()}`);
    chart.initChart();
    mainPage.style.display = 'none';
    chart.initChart();
    await chart.cleanupSubpageChart(subpageHost);
    mainPage.style.display = 'block';
    documentTarget.dispatchEvent(new Event('streamline:mainpagevisible'));

    assert.deepEqual(observed, ['main-chart', 'profile-chart', 'main-chart']);
    assert.deepEqual(unobserved, ['main-chart', 'profile-chart']);
});
