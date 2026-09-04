# AI Repository Map

Use this file for orientation. Read the smallest matching topic note, inspect the named source, and widen only when the task crosses a boundary. Do not preload all notes.

## Task Routing

| Work | Start with | Then read |
| --- | --- | --- |
| App boot, main-page state, lifecycle, navigation | `index.html`, `src/modules/app.js`, `src/modules/router.js` | `AI_RUNTIME_NOTES.md` |
| REST calls, WebSockets, devices, machine commands, firmware upload | `src/modules/api.js`, the relevant call site, `rest_v1.yml`, `websocket_v1.yml` | `AI_API_NOTES.md` |
| Main UI, scaling, modals, accessibility, themes | `index.html`, `src/modules/ui.js`, `src/modules/scaling.js`, relevant `src/css/*.css` | `AI_UI_NOTES.md` |
| Translation, units, text fitting | `src/modules/i18n.js`, `src/modules/i18n-parser.js`, `src/modules/units.js`, the translation CSV | `AI_UI_NOTES.md`, then `AI_BUILD_NOTES.md` |
| Settings navigation or a settings category | `src/settings/settings-tree.js`, `src/settings/settings-shell.js`, the target category module | `AI_SETTINGS_NOTES.md` |
| A non-extracted settings category | The target section of `src/settings/settings.js`; do not read the whole file first | `AI_SETTINGS_NOTES.md` |
| Live or historical charts, autoscale, legend, expanded chart | `src/modules/chart.js`, `src/modules/echarts-renderer.js`, the matching pure helper | `AI_CHART_NOTES.md` |
| Profiles, favorites, selector, editor, metadata | `src/modules/profileManager.js`, `src/modules/active-profile.js`, target selector/editor code | `AI_PROFILES_NOTES.md` |
| Shot history, paging, cache, IndexedDB schema | `src/modules/history.js`, `src/modules/history-pager.js`, `src/modules/idb.js` | `AI_STORAGE_NOTES.md` |
| Durable UI preferences and localStorage mirroring | `src/modules/settingsSync.js`, its caller, relevant settings UI | `AI_STORAGE_NOTES.md` |
| Machine-model gates, Bengle-only behavior, calibration | `src/modules/machine.js`, target policy module, `src/modules/api.js`, target settings category | `AI_API_NOTES.md` plus the owning topic note |
| Tailwind, ECharts bundle, dependencies, tests | `package.json`, `package-lock.json`, `tailwind.config.js`, relevant file in `scripts/` or `test/` | `AI_BUILD_NOTES.md` |
| Manifest, version, `dist`, tags, GitHub Actions, Pages | `.github/workflows/release.yml`, `.github/workflows/static.yml`, `skin-manifest.json`, `src/version.js` | `AI_RELEASE_NOTES.md` |
| Behavior parity with the old skin or rewrite archaeology | Current JS first, then a narrow search in `skin.tcl`, `tcl_rewrite_guide.md`, or `rewrite_roadmap.md` | `AI_LEGACY_NOTES.md` |
| User-facing behavior or troubleshooting docs | Current implementation and matching topic note, then `README.md` or `docs/*.md` | The owning topic note |
| DYE2, extensions, Home Assistant, or plugin UI | The target module and settings category; inspect its API calls | `AI_API_NOTES.md`, `AI_SETTINGS_NOTES.md`, or `AI_UI_NOTES.md` as needed |

## Production Entry Points

- `index.html`: application shell, first-paint theme, CSS, classic reconnecting socket script, and module entry order.
- `src/modules/settingsSync.js`: starts durable preference hydration before other modules read preferences.
- `src/modules/app.js`: main orchestrator, state, UI initialization, machine data handlers, and main-page initialization.
- `src/modules/api.js`: Decaid REST and WebSocket boundary.
- `src/modules/router.js`: query-string SPA routes and injected subpage lifecycle.
- `src/modules/ui.js`: shared DOM update and interaction behavior.
- `src/settings/settings-shell.js`: lightweight settings-page mount and category loader.
- `src/modules/profileManager.js`: profile records, favorites, active profile metadata, and migrations.
- `src/modules/history.js` and `src/modules/idb.js`: shot history and browser persistence.
- `src/modules/chart.js`: app-facing chart model and live/history chart policy.

## Read Late, Not First

These paths are useful only for specific tasks:

- `src/settings/settings.js`: large legacy settings implementation. Search for the target category or symbol.
- `src/modules/echarts-streamline.min.js`: generated bundle; inspect its source entry instead.
- `src/css/app.css`: generated Tailwind output; inspect HTML/JS classes and `src/input.css`.
- `skin.tcl`, `tcl_rewrite_guide.md`, `rewrite_roadmap.md`: historical intent, not current architecture.
- `settings_work/`, `figama_code/`, `dist/`, `shots/`, `shothistory/`, loose transcripts, response dumps, and experiments: not production authority unless the task explicitly names them.
- `README.md`: user manual, not the first implementation reference.
- `docs/DEVELOPMENT.md` and older agent files: useful background, but verify every implementation claim against current source.

## Source-of-Truth Order

1. Current production source and workflow files.
2. Local machine-readable contracts: `rest_v1.yml` and `websocket_v1.yml`.
3. Focused tests in `test/`.
4. Current user documentation.
5. Legacy Tcl, plans, experiments, and external references.

When sources disagree, describe the discrepancy and follow the higher item unless the task is specifically to reconcile documentation or restore legacy behavior.
