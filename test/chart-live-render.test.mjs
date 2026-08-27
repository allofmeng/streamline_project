import assert from 'node:assert/strict';
import { test } from 'node:test';

test('live chart frames are paint-aligned, deferred while hidden, and expanded in one instance', async () => {
    const options = [];
    const handlers = {};
    let legendBindings = 0;
    const instance = {
        setOption(option) { options.push(option); },
        getOption() { return options.at(-1) || { legend: [], series: [] }; },
        resize() {},
        dispose() {},
        on(name, handler) { handlers[name] = handler; if (name === 'legendselectchanged') legendBindings++; },
        off() {},
        dispatchAction() {}
    };
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
    Object.assign(windowTarget, { devicePixelRatio: 2, echarts: { init: () => instance } });

    globalThis.document = documentTarget;
    globalThis.window = windowTarget;
    globalThis.localStorage = { getItem: () => 'light' };
    globalThis.performance = { now: () => 1000 };
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
    assert.equal(options.at(-1).series[0].data.length, 3);
    assert.deepEqual([options.at(-1).xAxis[0].min, options.at(-1).xAxis[0].max], [0, 3 / 0.93]);

    const visibleRenderCount = options.length;
    documentTarget.visibilityState = 'hidden';
    chart.updateChart(start, frame(4), 4);
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.equal(options.length, visibleRenderCount);

    documentTarget.visibilityState = 'visible';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => setTimeout(resolve, 120));
    assert.equal(options.at(-1).series[0].data.length, 4);

    chart.finalizeLiveChart();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(options.at(-1).animation, false);
    assert.ok(options.at(-1).xAxis[0].max > 4);

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
});
