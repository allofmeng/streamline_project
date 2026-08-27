const charts = new WeakMap();
const DPR = 1.25;

function sizeOf(element) {
    return {
        width: Math.max(1, Math.round(element.clientWidth)),
        height: Math.max(1, Math.round(element.clientHeight))
    };
}

function dashType(dash) {
    if (dash === 'dot') return 'dotted';
    if (dash === 'dash' || dash === 'longdash') return 'dashed';
    return 'solid';
}

function axisOption(config = {}, font = {}, isX = false) {
    const ranged = config.autorange !== true && Array.isArray(config.range);
    const tickText = config.tickvals && config.ticktext
        ? new Map(config.tickvals.map((value, index) => [value, config.ticktext[index]]))
        : null;
    return {
        type: 'value',
        min: ranged ? config.range[0] : null,
        max: ranged ? config.range[1] : null,
        interval: config.dtick,
        scale: !isX,
        silent: true,
        axisLabel: {
            color: font.color,
            fontFamily: 'Inter, sans-serif',
            fontSize: font.size || 16,
            showMaxLabel: !isX,
            formatter: value => tickText?.get(value) ?? `${value}${config.ticksuffix || ''}`
        },
        axisLine: { show: true, lineStyle: { color: config.linecolor } },
        axisTick: { show: true, lineStyle: { color: config.tickcolor } },
        splitLine: { show: true, lineStyle: { color: config.gridcolor, width: 1 } },
        name: config.title?.text,
        nameLocation: 'middle',
        nameGap: config.title ? 28 : 0,
        nameTextStyle: { color: font.color, fontFamily: 'Inter, sans-serif', fontSize: config.title?.font?.size || 15 }
    };
}

function gridOptions(layout, size) {
    const margin = layout.margin || {};
    const left = margin.l ?? 50;
    const right = margin.r ?? 50;
    const top = margin.t ?? 20;
    const bottom = margin.b ?? 40;
    const innerHeight = Math.max(1, size.height - top - bottom);
    const domains = [layout.yaxis?.domain || [0, 1]];
    if (layout.yaxis2) domains.push(layout.yaxis2.domain || [0, 1]);
    return domains.map(domain => ({
        left,
        right,
        top: top + (1 - domain[1]) * innerHeight,
        height: (domain[1] - domain[0]) * innerHeight,
        containLabel: false
    }));
}

function markerData(layout, axisIndex) {
    const axisName = axisIndex ? 'x2' : 'x';
    const shapes = (layout.shapes || []).filter(shape => (shape.xref || 'x') === axisName);
    if (!shapes.length) return undefined;
    return {
        silent: true,
        symbol: ['none', 'none'],
        label: { show: false },
        data: shapes.map(shape => ({
            xAxis: shape.x0,
            lineStyle: {
                color: shape.line?.color,
                width: shape.line?.width || 1,
                type: dashType(shape.line?.dash)
            }
        }))
    };
}

function annotationFor(trace, layout) {
    const last = trace.x.length - 1;
    if (last < 0) return null;
    const annotations = layout.annotations || [];
    const color = trace.line?.color?.toLowerCase();
    const colorMatch = annotations.find(annotation => annotation.font?.color?.toLowerCase() === color);
    if (colorMatch) return colorMatch;
    const coordinateMatches = annotations.filter(annotation => annotation.x === trace.x[last] && annotation.y === trace.y[last]);
    return coordinateMatches.length === 1 ? coordinateMatches[0] : null;
}

function seriesOptions(traces, layout, interactive) {
    const markedAxes = new Set();
    return traces.map((trace, index) => {
        const axisIndex = trace.xaxis === 'x2' || trace.yaxis === 'y2' ? 1 : 0;
        const annotation = annotationFor(trace, layout);
        const markLine = markedAxes.has(axisIndex) ? undefined : markerData(layout, axisIndex);
        markedAxes.add(axisIndex);
        return {
            id: `trace-${index}`,
            name: trace.name,
            type: 'line',
            xAxisIndex: axisIndex,
            yAxisIndex: axisIndex,
            data: trace.x.map((x, pointIndex) => [x, trace.y[pointIndex]]),
            showSymbol: false,
            symbol: 'none',
            smooth: false,
            connectNulls: false,
            silent: !interactive,
            clip: true,
            lineStyle: {
                color: trace.line?.color,
                width: trace.line?.width || 2,
                type: dashType(trace.line?.dash)
            },
            emphasis: { disabled: !interactive },
            markLine,
            markPoint: annotation ? {
                silent: true,
                symbol: 'circle',
                symbolSize: 1,
                itemStyle: { color: 'transparent', borderWidth: 0 },
                label: {
                    show: true,
                    formatter: annotation.text,
                    position: 'right',
                    distance: annotation.xshift || 6,
                    offset: [0, -(annotation.yshift || 0)],
                    color: annotation.font?.color || trace.line?.color,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: annotation.font?.size || 16
                },
                data: [{ coord: [annotation.x, annotation.y] }]
            } : undefined
        };
    });
}

function legendOptions(layout, traces, size, selected) {
    if (!layout.showlegend) return [{ show: false }];
    const margin = layout.margin || {};
    const font = layout.font || {};
    const innerHeight = Math.max(1, size.height - (margin.t || 0) - (margin.b || 0));
    const makeLegend = (config, names) => ({
        show: true,
        data: names,
        selected,
        left: margin.l || 50,
        top: Math.max(0, (margin.t || 0) + (1 - config.y) * innerHeight - (config.yanchor === 'bottom' ? config.font?.size || 20 : 0)),
        orient: config.orientation === 'h' ? 'horizontal' : 'vertical',
        textStyle: { color: font.color, fontFamily: 'Inter, sans-serif', fontSize: config.font?.size || 20 }
    });
    const topNames = traces.filter(trace => trace.xaxis !== 'x2' && trace.yaxis !== 'y2').map(trace => trace.name);
    const legends = [makeLegend(layout.legend || { y: 1 }, topNames)];
    if (layout.legend2) {
        const lowerNames = traces.filter(trace => trace.xaxis === 'x2' || trace.yaxis === 'y2').map(trace => trace.name);
        legends.push(makeLegend(layout.legend2, lowerNames));
    }
    return legends;
}

function chartOption(traces, layout, interactive, size, selected) {
    const font = layout.font || {};
    let xAxes = [axisOption(layout.xaxis, font, true)];
    const yAxes = [axisOption(layout.yaxis, font, false)];
    if (layout.xaxis2) xAxes.push({ ...axisOption(layout.xaxis2, font, true), gridIndex: 1 });
    if (layout.yaxis2) yAxes.push({ ...axisOption(layout.yaxis2, font, false), gridIndex: 1 });
    if (layout.xaxis2?.matches === 'x' && layout.xaxis?.autorange && layout.xaxis2.autorange) {
        let min = Infinity;
        let max = -Infinity;
        for (const trace of traces) for (const value of trace.x) {
            if (!Number.isFinite(value)) continue;
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
        if (Number.isFinite(min)) xAxes = xAxes.map(axis => ({ ...axis, min, max }));
    }
    return {
        animation: false,
        backgroundColor: layout.paper_bgcolor || layout.plot_bgcolor || 'transparent',
        textStyle: { color: font.color, fontFamily: 'Inter, sans-serif', fontSize: font.size },
        grid: gridOptions(layout, size),
        legend: legendOptions(layout, traces, size, selected),
        xAxis: xAxes,
        yAxis: yAxes,
        series: seriesOptions(traces, layout, interactive)
    };
}

export function renderChart(echarts, element, traces, layout, interactive = false) {
    const size = sizeOf(element);
    let state = charts.get(element);
    element.style.background = layout.paper_bgcolor || layout.plot_bgcolor || 'transparent';
    if (!state) {
        element.replaceChildren();
        state = {
            chart: echarts.init(element, null, {
                renderer: 'canvas',
                devicePixelRatio: Math.min(window.devicePixelRatio || 1, DPR),
                ...size
            }),
            size
        };
        charts.set(element, state);
    } else if (size.width !== state.size.width || size.height !== state.size.height) {
        state.chart.resize({ ...size, silent: true });
        state = { ...state, size };
        charts.set(element, state);
    }
    const selected = Object.assign({}, ...(state.chart.getOption?.().legend || []).map(legend => legend.selected || {}));
    state.chart.setOption(chartOption(traces, layout, interactive, size, selected), {
        notMerge: false,
        replaceMerge: ['series', 'grid', 'xAxis', 'yAxis', 'legend'],
        lazyUpdate: false,
        silent: true
    });
}

export function resizeChart(element) {
    const state = charts.get(element);
    if (!state) return false;
    const size = sizeOf(element);
    state.chart.resize({ ...size, silent: true });
    charts.set(element, { ...state, size });
    return true;
}

export function destroyChart(element) {
    const state = charts.get(element);
    if (!state) return;
    state.chart.dispose();
    charts.delete(element);
}

export function hasChart(element) {
    return charts.has(element);
}

export function getSeriesVisibility(element, count) {
    const state = charts.get(element);
    if (!state) return undefined;
    const option = state.chart.getOption();
    const selected = Object.assign({}, ...option.legend.map(legend => legend.selected || {}));
    return option.series.slice(0, count).map(series => selected[series.name] !== false);
}

export function setYAxisRange(element, range) {
    charts.get(element)?.chart.setOption({ yAxis: [{ min: range[0], max: range[1] }] }, { lazyUpdate: true, silent: true });
}

export function onLegendChange(element, callback) {
    const state = charts.get(element);
    if (!state || state.legendCallback === callback) return;
    if (state.legendCallback) state.chart.off('legendselectchanged', state.legendCallback);
    state.chart.on('legendselectchanged', callback);
    charts.set(element, { ...state, legendCallback: callback });
}

export function selectSeries(element, names) {
    const chart = charts.get(element)?.chart;
    for (const name of names) chart?.dispatchAction({ type: 'legendSelect', name });
}
