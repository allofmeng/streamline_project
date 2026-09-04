# AI Chart Notes

Read this when changing live shot rendering, historical plots, autoscale, legends, annotations, target lines, expanded charts, chart lifecycle, or the ECharts bundle.

## Current Pipeline

The app-facing chart model retains some Plotly-shaped trace/layout objects and legacy DOM names, but the runtime renderer is ECharts.

```text
machine/history data
  -> src/modules/chart.js
  -> Plotly-shaped traces and layout
  -> src/modules/echarts-renderer.js
  -> ECharts instance
  -> canvas
```

Supporting files:

- `src/modules/chart-autoscale.js`: pure range/autoscale policy.
- `src/modules/historical-gflow.js`: historical flow calculation.
- `src/modules/echarts-loader.js`: lazy, promise-cached bundle import.
- `scripts/echarts-streamline-entry.js`: registered ECharts charts/components/renderers.
- `src/modules/echarts-streamline.min.js`: generated tree-shaken bundle.
- `src/modules/router.js`: subpage chart cleanup and main-page repaint timing.

Do not “correct” the `plotly-chart` element ID or trace shape as an isolated cleanup. They are compatibility surfaces used across pages and tests.

## Render Modes

`echarts-renderer.js` keeps one chart state per DOM element in a `WeakMap`.

A live update is eligible when the render mode is `live` and the trace count is stable. It updates axes and series data with merge semantics and `lazyUpdate: true`.

A full render rebuilds the complete option and uses `replaceMerge` for series, grids, axes, and legends. Use it for structural changes, history/profile plots, first render, or trace-count changes—not every telemetry frame.

Rules:

- Keep each trace's `x` and `y` arrays exactly aligned.
- Keep stable trace ordering and IDs during a live shot.
- Do not allocate a new chart instance for every update.
- Preserve legend selection across full renders.
- Update markers/axes when the layout signature changes.
- Destroy chart instances and associated hover DOM when a routed chart is removed.
- Avoid DOM measurements while the element is hidden; resize after it becomes visible.
- Keep per-frame logging and expensive derived calculations out of the hot path.

## ECharts Bundle

The minified bundle is generated from `scripts/echarts-streamline-entry.js`.

When a renderer option requires a new ECharts component:

1. Import and register the component in the entry file.
2. Run `npm run build:echarts`.
3. Commit the entry change and regenerated `src/modules/echarts-streamline.min.js`.
4. Exercise the feature at runtime. A missing registration can fail only when `setOption()` reaches that feature.

Never patch the minified bundle directly. Keep ECharts lazy-loaded so direct subpage boot and initial app paint do not pay for it unnecessarily.

## Chart Ownership

`chart.js` owns product-level policy:

- live shot series;
- target vs actual data;
- shot start/end transitions;
- historical and profile rendering;
- expanded chart;
- autoscale and view state.

`echarts-renderer.js` owns translation to ECharts and instance lifecycle. Do not put espresso-domain decisions into the renderer or ECharts details into unrelated UI handlers.

Prefer extracting new math or policy into a DOM-free helper. This keeps tests fast and prevents Node from importing `chart.js` with browser globals.

## Common Failure Modes

| Symptom | Likely cause |
| --- | --- |
| Chart freezes or becomes progressively slower during a shot | Full render or new chart instance on every frame |
| A line connects wrong points | Unequal or reordered `x`/`y` arrays |
| New annotation/feature is absent | Required ECharts component not registered in the generated bundle |
| Legend choices reset | Full render discarded selection |
| Old profile chart flashes on main-page return | Router/main-page clear and history repaint ordering |
| Canvas remains after leaving a subpage | Missing chart cleanup/dispose |
| Expanded chart closes on canvas interaction | Event propagation/overlay interaction regression |
| Hidden-route chart is 1×1 or mis-scaled | Measured while hidden and not resized later |

## Focused Checks

```sh
npm run build:echarts
node --test test/chart-autoscale.test.mjs
node --test test/chart-lifecycle.test.mjs
node --test test/chart-live-render.test.mjs
node --test test/chart-render-policy.test.mjs
node --test test/echarts-renderer.test.mjs
node --test test/expanded-chart-interaction.test.mjs
```

Also run a live-shot or representative replay smoke test. Unit tests cannot reproduce browser canvas sizing, sustained telemetry rate, touch interaction, or WebView performance.
