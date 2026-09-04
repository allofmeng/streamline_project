# AI Runtime Notes

Read this when changing startup, global state, main-page behavior, routing, page lifecycle, deferred loading, timers, or WebView integration.

## Runtime Shape

Streamline is a static browser application built from native ES modules. `index.html` provides one persistent document containing the main page and a `subpage-host`; settings and profile pages are fetched and injected rather than loaded as full documents.

The important startup order is:

1. The inline theme script applies a stored theme before first paint.
2. `src/modules/settingsSync.js` starts before `src/modules/app.js`.
3. `app.js` awaits `settingsReady` before initializing code that reads synchronized preferences.
4. Scaling, optional assets, i18n, units, chart state, and shared UI are initialized.
5. `src/modules/router.js` handles a direct subpage URL or establishes the main route.
6. `initMainPageOnce()` lazily initializes history, profiles, initial workflow data, device state, and the long-lived socket set.

Do not reorder these stages casually. A preference read before hydration, a duplicate main-page initialization, or a large import moved into initial boot can create regressions that appear only after an app update or direct subpage launch.

`src/modules/reconnecting-websocket.js` is the one exception to the ES-module rule. `index.html` loads it as a classic script and it defines a global; `src/modules/api.js` uses that global rather than importing it. Keep the tag ahead of the module entry point, and do not convert the file to a module or add an `import` for it without changing both sides together.

## Main-Page Initialization

`initMainPageOnce()` is intentionally idempotent and promise-coalesced. It may be called during normal boot or later when a direct settings/profile route returns to the main page.

It owns or starts:

- history and profile-manager initialization;
- initial workflow and machine identification;
- machine snapshot, scale, devices, water level, time-to-ready, shot state, display, and shot-settings streams;
- brightness restoration and gateway tracking;
- optional Visualizer initialization.

Keep the first useful paint independent from unrelated slow work. For example, returning from the profile selector repaints cached history without waiting for every device connection and socket.

## Router And Page Lifecycle

`src/modules/router.js` maps query-string routes to:

- `src/settings/settings.html`
- `src/profiles/profile_selector.html`
- `src/profiles/profile_editor.html`

It caches fetched HTML, injects `#scaled-content` into `#subpage-host`, initializes the matching module, and runs the previous page cleanup before replacement.

Rules for routed pages:

- A mount function must tolerate repeated calls.
- Return or expose cleanup for listeners, observers, timers, editors, charts, object URLs, and other resources.
- Do not depend only on `DOMContentLoaded`; injected pages arrive after that event.
- Scope DOM queries to the mounted page where practical.
- Guard asynchronous work so a late result cannot render into a newer route.
- Assume the main page can be `display:none` and later become visible. Measurements taken while hidden can be zero; refit or resize after visibility returns.
- Preserve browser history behavior. Use the router instead of assigning internal page URLs directly.

The main chart and profile pages retain some legacy element names, including `plotly-chart`, even though ECharts is now the renderer. Treat these identifiers as compatibility surfaces.

## State And Cross-Module Communication

`app.js` coordinates machine state and calls explicit UI/chart functions after state changes. There is no reactive framework.

- Extend an existing owner module instead of introducing another global state object.
- Prefer imports and callbacks. Add a `window.app` bridge only when injected HTML or an existing cross-page contract needs it.
- Keep connection state transitions in the established handlers; reconnecting sockets and device events can outlive a visible page.
- Timers and retries need a clear owner and cancellation path.
- Avoid per-frame allocations, logging, layout reads, and full renders in machine/scale hot paths.
- Preserve throttling and “latest task wins” behavior where it already exists.

## WebView Constraints

The in-app WebView is a primary runtime, not just a browser fallback.

- External HTTP links are deliberately converted to same-frame top-level navigation so the host can hand them to the operating-system browser. Do not replace this with `target="_blank"`.
- Fullscreen behavior differs between browsers and the host WebView. Preserve the host signal and existing fallbacks.
- Feature detection should lead; user-agent checks are fallbacks.
- Test touch, orientation, virtual-keyboard, hidden-page, and reconnect behavior for UI changes that depend on viewport or lifecycle.

## Troubleshooting

| Symptom | First places to inspect |
| --- | --- |
| Preferences flash back to defaults after an app update | `index.html` script order, `settingsSync.js`, and whether startup awaited `settingsReady` |
| Main page is static after opening a direct subpage URL | `router.js` return path and `initMainPageOnce()` |
| A handler fires twice after navigating | Page/category mount and cleanup; duplicated document listeners or timers |
| A subpage shows stale content after fast navigation | Async sequence or route-staleness guard |
| Text or chart sizing is wrong after returning | Work performed while the page was hidden; resize/refit after visibility |
| Machine data duplicates after reconnect | Socket slot/reconnect ownership in `api.js`; do not open a parallel socket |
| First paint becomes slow | New eager import, generated bundle, settings legacy module, or network request added to boot |

## Focused Checks

Run:

```sh
npm test
node --test test/expanded-chart-interaction.test.mjs
```

Then serve the repository and manually test:

- boot on `?page=index`;
- direct boot on each supported subpage;
- repeated main → subpage → main navigation;
- machine and scale reconnect;
- hidden-to-visible sizing;
- external-link behavior in the Decaid WebView when the change touches it.
