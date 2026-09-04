# AI UI, Styling, And I18n Notes

Read this when changing HTML, shared DOM updates, responsive scaling, themes, accessibility, text fitting, translations, units, modals, help, or WebView-specific presentation.

## UI Layers

- `index.html`: persistent shell and main-page markup.
- `src/profiles/*.html` and `src/settings/settings.html`: router-injected subpages.
- `src/modules/ui.js` and feature modules: DOM updates and interactions.
- `src/modules/scaling.js`: fixed-layout scaling and orientation behavior.
- `src/css/main.css`, `src/css/dark-mode.css`, and feature CSS files: hand-maintained CSS.
- `src/input.css` plus `tailwind.config.js`: Tailwind input and scan configuration.
- `src/css/app.css`: generated Tailwind/daisyUI output.
- `DESIGN_SYSTEM.md`: design reference; current HTML and CSS variables remain the implementation authority.
- `src/ui/`: local fonts, icons, images, and translation CSV.

Prefer existing CSS variables, component shapes, and layout conventions. Avoid duplicating a literal color or size when a semantic variable already exists.

## Tailwind And CSS

Tailwind scans `index.html` and `src/**/*.{js,html}`. A class written in those files has no effect in the shipped app until `src/css/app.css` is rebuilt.

- Change HTML/JS classes or `src/input.css`, then run `npm run build:css`.
- Never hand-edit `src/css/app.css`.
- Keep custom CSS for behavior or selectors that utilities cannot express cleanly.
- Dynamic class names must still be statically discoverable by the Tailwind scan, or they need a deliberate alternative.
- Inspect both light and dark variable values before introducing a new semantic token.
- Remember that routed content can be hidden or absent when a global stylesheet loads.

Do not accept an older doc claim such as CDN Tailwind or Plotly without checking current source.

## Dynamic DOM And Lifecycle

Router-injected pages do not receive a new `DOMContentLoaded`.

- Initialize through the page/category mount function.
- Clean up document/window listeners, observers, timers, editors, and temporary nodes.
- Prefer event delegation for dynamic lists.
- Use `textContent` for remote or user-controlled strings. If rich HTML is required, use the project's established sanitizer and keep the allowed surface narrow.
- Preserve focus, keyboard, touch, and accessible-name behavior.
- Do not rely on duplicate IDs across simultaneously visible roots.
- Hidden elements report zero dimensions. Re-measure after route visibility, font readiness, resize, or content changes.

The app includes long labels in many languages and fixed-size tablet controls. Use the existing `data-fit-text`, `fitTextToWidth`, `fitTextToBox`, and telemetry-fitting paths rather than adding one-off shrink logic.

## Translation And Units

Translations are loaded from:

`src/ui/de1 gui translation - Sheet1.csv`

`src/modules/i18n-parser.js` owns parsing and supported-language policy. `src/modules/i18n.js` owns loading, versioned caching, lookup, page translation, and text fitting. English falls back to the source key.

Rules:

- Mark static translatable text with `data-i18n-key`.
- Call `translatePage()` after injecting new routed or category markup.
- For runtime labels, call `getTranslation()` and then the relevant fit function.
- Do not change an English/source key casually; it is an identifier across code and the CSV.
- Keep temperature conversion in `src/modules/units.js`; machine/API values remain in their canonical units.
- Translation caches include `APP_VERSION`, so release-version work can affect cache invalidation.
- The release workflow may replace the committed CSV from a protected Google Sheets export. Do not expose or hardcode that URL.

Use `node scripts/i18n_audit.mjs` as an audit, not as an automatic rewrite. Review each candidate in context.

## WebView And Interaction

- The Decaid WebView is a primary target.
- Keep external-link navigation compatible with the host; `_blank` is not a reliable escape path.
- Preserve host fullscreen detection and browser fallbacks.
- Test touch and mouse paths for controls that support both.
- Avoid hover-only affordances.
- Consider virtual-keyboard viewport changes for editor and numeric-input work.
- Use semantic buttons and labels even when the visual design is custom.

## Visual Change Checklist

1. Identify the owning markup, module, and CSS layer.
2. Reuse a design variable or document a new one in the appropriate source.
3. Add translation keys and runtime fitting where needed.
4. Rebuild Tailwind output if any scanned class changes.
5. Test light/dark, English plus one long-label language, main/subpage navigation, and target viewport sizes.
6. Test keyboard focus and touch behavior.
7. Inspect the diff for accidental generated-file or broad formatting churn.

## Focused Checks

```sh
npm run build:css
node scripts/i18n_audit.mjs
npm test
```

The audit can report existing debt. Separate pre-existing findings from regressions introduced by the change.
