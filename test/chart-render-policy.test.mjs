import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('the chart bundle is modular ECharts without Plotly assets', () => {
    const entry = read('scripts/echarts-streamline-entry.js');
    const asset = new URL('src/modules/echarts-streamline.min.js', root);
    for (const feature of ['LineChart', 'GridComponent', 'LegendComponent', 'MarkLineComponent', 'MarkPointComponent', 'CanvasRenderer']) {
        assert.match(entry, new RegExp(`\\b${feature}\\b`));
    }
    assert.equal(existsSync(new URL('src/modules/plotly-basic-3.1.0.min.js', root)), false);
    assert.ok(statSync(asset).size < 600_000);
});

test('main chart rendering uses the ECharts renderer without sampling', () => {
    const chart = read('src/modules/chart.js');
    const renderer = read('src/modules/echarts-renderer.js');
    assert.match(chart, /const CHART_REDRAW_INTERVAL_MS = 100/);
    assert.match(chart, /renderChart\(echarts, element, traces, layout, interactive, mode\)/);
    assert.match(renderer, /renderer: 'canvas'/);
    assert.match(renderer, /animation: false/);
    assert.doesNotMatch(renderer, /sampling:/);
    assert.doesNotMatch(chart + renderer, /Plotly\./);
});

test('live rendering stays paint-aligned and skips hidden charts', () => {
    const chart = read('src/modules/chart.js');
    assert.match(chart, /if \(document\.visibilityState === 'hidden'\) return false/);
    assert.match(chart, /redrawFrame = requestAnimationFrame\(\(\) => \{\s*redrawFrame = 0;\s*flushChart\(\)/);
    assert.match(chart, /document\.addEventListener\('visibilitychange', handleChartVisibilityChange\)/);
    assert.match(chart, /observedChartSize = \{ width: element\.clientWidth, height: element\.clientHeight \}/);
});

test('expanded mode uses one two-grid instance and preserves visibility autoscaling', () => {
    const chart = read('src/modules/chart.js');
    const index = read('index.html');
    assert.match(index, /id="expanded-chart"/);
    assert.doesNotMatch(index, /id="expanded-(flow|temp)-chart"/);
    assert.match(chart, /renderECharts\(element, \[\.\.\.expandedTopTraces\(\), \.\.\.expandedTempTraces\(\)\]/);
    assert.match(chart, /pickVisible\(expandedTopSeriesYs\(\), visibility\)/);
    assert.match(chart, /onLegendChange\(element/);
    assert.match(chart, /selectSeries\(element, topNames\)/);
});

test('hidden renders coalesce and teardown invalidates queued work before disposal', () => {
    const chart = read('src/modules/chart.js');
    assert.match(chart, /if \(!element \|\| element\.offsetParent === null \|\| expandedOpen\) \{\s*mainRenderDirty = true/);
    assert.match(chart, /if \(mainRenderDirty && latestMainRender && !expandedOpen\)/);
    assert.match(chart, /renderGenerations\.set\(element, generation\);[\s\S]*await enqueue\?\.dispose\(\);[\s\S]*destroyChart\(element\)/);
    assert.match(chart, /!element\.isConnected \|\| renderGenerations\.get\(element\) !== generation/g);
});
