import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

class Element {
    constructor(parent = null) {
        this.parent = parent;
        this.listeners = new Map();
    }

    addEventListener(type, listener) {
        this.listeners.set(type, [...(this.listeners.get(type) || []), listener]);
    }

    emit(type, event) {
        for (const listener of this.listeners.get(type) || []) listener(event);
        if (!event.stopped) this.parent?.emit(type, event);
    }

    tap() {
        for (const type of ['pointerdown', 'click']) {
            this.emit(type, {
                target: this,
                clientX: 20,
                clientY: 20,
                stopped: false,
                stopPropagation() { this.stopped = true; }
            });
        }
    }
}

test('tapping the expanded ECharts canvas does not close the overlay', () => {
    const app = readFileSync(new URL('../src/modules/app.js', import.meta.url), 'utf8');
    const start = app.indexOf('function wireExpandedChart()');
    const end = app.indexOf("document.addEventListener('DOMContentLoaded'", start);
    const overlay = new Element();
    const canvas = new Element(overlay);
    const back = new Element(overlay);
    const expand = new Element();
    const mainChart = new Element();
    const documentTarget = new Element();
    documentTarget.getElementById = id => ({
        'chart-expand-btn': expand,
        'plotly-chart': mainChart,
        'expanded-chart-back': back,
        'expanded-chart-overlay': overlay
    })[id] || null;
    let closes = 0;
    const chart = {
        openExpandedChart() {},
        closeExpandedChart() { closes += 1; },
        isExpandedChartOpen: () => true
    };
    const wireExpandedChart = new Function(
        'chart',
        'document',
        'console',
        `${app.slice(start, end)}\nreturn wireExpandedChart;`
    )(chart, documentTarget, console);

    wireExpandedChart();
    canvas.tap();
    assert.equal(closes, 0);
    back.tap();
    assert.equal(closes, 1);
});
