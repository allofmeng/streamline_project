import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIN_CHART_INTERVAL_MS } from '../src/modules/chart-live-policy.js';

test('live chart frames are paint-aligned, deferred while hidden, and expanded in one instance', async t => {
    const options = [];
    const handlers = {};
    let legendBindings = 0;
    const instances = [];
    const appends = [];
    const createInstance = () => {
        let current = { legend: [], series: [] };
        const instance = {
            setOption(option) {
                options.push(option);
                current = { ...current, ...option };
                if (option.series) current.series = option.series.map(series => ({ ...series, data: series.data.map(point => [...point]) }));
            },
            appendData({ seriesIndex, data }) {
                appends.push({ instance, seriesIndex, data });
                for (const point of data) current.series[seriesIndex].data.push([...point]);
            },
            getOption() { return current; },
            resize() {},
            dispose() {},
            on(name, handler) { handlers[name] = handler; if (name === 'legendselectchanged') legendBindings++; },
            off() {},
            dispatchAction() {}
        };
        instances.push(instance);
        return instance;
    };
    const painted = () => instances[0].getOption().series[0].data;
    const element = (id, width, height) => ({
        id,
        offsetParent: {},
        clientWidth: width,
        clientHeight: height,
        isConnected: true,
        style: {},
        replaceChildren() {}
    });
    const chartElement = element('plotly-chart', 960, 390);
    const expandedElement = element('expanded-chart', 1920, 1104);
    const expandedOverlay = { style: { display: 'none' } };
    const helpButton = { style: { display: '' } };
    const mainPage = {
        style: { display: 'block' },
        querySelector: selector => selector === '#plotly-chart' ? chartElement : null
    };
    const documentTarget = new EventTarget();
    Object.assign(documentTarget, {
        visibilityState: 'visible',
        getElementById: id => ({
            'main-page': mainPage,
            'expanded-chart': expandedElement,
            'expanded-chart-overlay': expandedOverlay,
            'help-overlay-btn': helpButton
        })[id] || null,
        createElement: () => ({ style: {}, getContext: () => ({ measureText: text => ({ width: text.length * 8 }) }) })
    });
    const windowTarget = new EventTarget();
    Object.assign(windowTarget, { devicePixelRatio: 2, echarts: { init: createInstance } });

    globalThis.document = documentTarget;
    globalThis.window = windowTarget;
    globalThis.localStorage = { getItem: () => 'light' };
    let now = 1000;
    globalThis.performance = { now: () => now };
    globalThis.requestAnimationFrame = callback => setTimeout(() => callback(1000), 0);
    globalThis.cancelAnimationFrame = clearTimeout;

    const chart = await import(`../src/modules/chart.js?live-render=${Date.now()}`);
    chart.initChart();
    chart.clearChart();
    await new Promise(resolve => setTimeout(resolve, 0));

    const start = new Date('2026-01-01T00:00:00.000Z');
    const frame = seconds => ({
        timestamp: new Date(start.getTime() + seconds * 1000).toISOString(),
        state: { substate: 'pouring' },
        pressure: seconds,
        flow: seconds / 2,
        targetPressure: 9,
        targetFlow: 0,
        groupTemperature: 92,
        targetGroupTemperature: 93,
        mixTemperature: 90,
        targetMixTemperature: 85
    });

    chart.updateChart(start, frame(1), 1);
    chart.updateChart(start, frame(2), 2);
    chart.updateChart(start, frame(3), 3);
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.deepEqual(painted(), [[1, 1], [2, 2], [3, 3]]);
    assert.deepEqual([options.at(-1).xAxis[0].min, options.at(-1).xAxis[0].max], [0, 3 / 0.93]);

    const visibleRenderCount = options.length;
    const visibleAppendCount = appends.length;
    documentTarget.visibilityState = 'hidden';
    chart.updateChart(start, frame(4), 4);
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.equal(options.length, visibleRenderCount);
    assert.equal(appends.length, visibleAppendCount);
    assert.equal(painted().length, 3);

    const nativeSetTimeout = globalThis.setTimeout;
    const delays = [];
    const timer = t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
        delays.push(delay);
        return nativeSetTimeout(callback, delay, ...args);
    });
    documentTarget.visibilityState = 'visible';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    timer.mock.restore();
    assert.deepEqual(delays, [100]); // Frozen clock retains the documented default.
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.deepEqual(painted(), [[1, 1], [2, 2], [3, 3], [4, 4]]);
    assert.equal(Object.hasOwn(options.at(-1), 'series'), false);
    assert.deepEqual(appends.findLast(call => call.seriesIndex === 0).data, [[4, 4]]);

    const projected = painted();
    now = 1001;
    const fastDelays = [];
    const fastTimer = t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
        fastDelays.push(delay);
        return nativeSetTimeout(callback, delay, ...args);
    });
    chart.updateChart(start, frame(5), 5);
    fastTimer.mock.restore();
    assert.deepEqual(fastDelays, [MIN_CHART_INTERVAL_MS - 1]); // floor minus 1 ms since paint.
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.strictEqual(painted(), projected);
    assert.equal(Object.hasOwn(options.at(-1), 'series'), false);
    assert.deepEqual(appends.findLast(call => call.seriesIndex === 0).data, [[5, 5]]);
    assert.equal(projected.length, 5);

    chart.finalizeLiveChart();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(options.at(-1).animation, false);
    assert.ok(options.at(-1).xAxis[0].max > 5);
    assert.notStrictEqual(painted(), projected);
    assert.equal(painted().length, 5);

    const finalized = painted();
    chart.setTheme('dark');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.notStrictEqual(painted(), finalized);
    assert.equal(painted().length, 5);

    chart.openExpandedChart();
    await new Promise(resolve => setTimeout(resolve, 20));
    const expanded = options.at(-1);
    assert.equal(expanded.grid.length, 2);
    assert.equal(expanded.series.length, 9);
    assert.equal(expanded.series.filter(series => series.id.startsWith('trace-') && series.xAxisIndex === 1 && series.yAxisIndex === 1).length, 4);
    assert.equal(typeof handlers.legendselectchanged, 'function');
    chart.closeExpandedChart();
    await new Promise(resolve => setTimeout(resolve, 0));
    chart.openExpandedChart();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(legendBindings, 2);
    chart.closeExpandedChart();
    await new Promise(resolve => setTimeout(resolve, 0));

    chart.clearChart();
    await new Promise(resolve => setTimeout(resolve, 0));
    chart.updateChart(start, frame(1), 1);
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.deepEqual(painted(), [[1, 1]]);
    chart.finalizeLiveChart();
    await new Promise(resolve => setTimeout(resolve, 0));
});

test('real ECharts (SVG ssr) keeps every live series equal to its source across a 600-frame replay', async () => {
    const echarts = await import('echarts');
    const { renderChart, destroyChart } = await import('../src/modules/echarts-renderer.js?real-echarts');
    let instance;
    const wrapper = {
        init: (_element, theme, options) => {
            instance = echarts.init(null, theme, { ...options, renderer: 'svg', ssr: true });
            return instance;
        }
    };
    const previousWindow = globalThis.window;
    globalThis.window = { devicePixelRatio: 1, localStorage: { getItem: () => 'light' } };
    const element = { clientWidth: 960, clientHeight: 390, style: {}, replaceChildren() {}, append() {}, ownerDocument: { createElement: () => ({ style: {}, remove() {} }) } };
    const traces = ['Pressure', 'Flow', 'Target Pressure', 'Target Flow'].map(name => ({ name, x: [], y: [], line: { color: '#17c29a', width: 2 }, hoverinfo: 'name' }));
    const layout = {
        paper_bgcolor: '#0d0e14',
        font: { color: '#606579', size: 16 },
        margin: { l: 50, r: 60, t: 20, b: 40 },
        xaxis: { range: [0, 10] },
        yaxis: { range: [0, 12] },
        showlegend: false
    };
    try {
        renderChart(wrapper, element, traces, layout, 'full');
        for (let frame = 0; frame < 600; frame++) {
            traces.forEach((trace, index) => { trace.x.push(frame / 10); trace.y.push(frame * (index + 1) / 100); });
            layout.xaxis.range = [0, Math.max(10, frame / 10 + 1)];
            renderChart(wrapper, element, traces, layout, 'live');
        }
        instance.resize({ width: 960, height: 390 }); // flushes the lazyUpdate pending state
        instance.renderToSVGString();
        assert.equal(instance.getModel().getSeriesCount() >= traces.length, true);
        traces.forEach((trace, index) => {
            const data = instance.getModel().getSeriesByIndex(index).getData();
            assert.equal(data.count(), trace.x.length, `series ${index} point count`);
            assert.equal(data.count(), 600);
            const last = data.count() - 1;
            assert.equal(data.get('x', last), trace.x[last]);
            assert.equal(data.get('y', last), trace.y[last]);
        });
    } finally {
        destroyChart(element);
        globalThis.window = previousWindow;
    }
});
