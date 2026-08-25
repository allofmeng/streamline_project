import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// The Plugins settings page links each plugin to its own web UI. Decaid routes
// /api/v1/plugins/<id>/<endpoint> from the manifest's api declarations, so a link
// is only real when the manifest declares an http endpoint named "ui" -- anything
// else 404s. settings.js can't be imported under node (browser globals), so the
// function is lifted out of the source, as in settings-sync.test.mjs.

const source = readFileSync(new URL('../src/settings/settings.js', import.meta.url), 'utf8');
const match = source.match(/function pluginUiUrl\(plugin\) \{[\s\S]*?\r?\n {4}\}/);
assert.ok(match, 'pluginUiUrl not found in settings.js');
const pluginUiUrl = new Function('API_BASE_URL', `${match[0]}\nreturn pluginUiUrl;`)('http://x:8080/api/v1');

test('a plugin declaring a ui endpoint gets a link to it', () => {
    assert.equal(
        pluginUiUrl({ id: 'settings.reaplugin', api: [{ id: 'ui', type: 'http', data: {} }] }),
        'http://x:8080/api/v1/plugins/settings.reaplugin/ui',
    );
});

test('the link is built off the configured bridge host, not a literal localhost', () => {
    const url = pluginUiUrl({ id: 'dye2.reaplugin', api: [{ id: 'ui', type: 'http' }] });
    assert.ok(url.startsWith('http://x:8080/api/v1/'));
});

test('a plugin with no ui endpoint gets no link', () => {
    // dye2 declares a dozen http endpoints, none of them "ui" -- linking to one
    // of those would open a fragment, and guessing /ui would 404.
    const dye2ish = { id: 'dye2.reaplugin', api: [{ id: 'dashboard', type: 'http' }, { id: 'grinders', type: 'http' }] };
    assert.equal(pluginUiUrl(dye2ish), null);
    assert.equal(pluginUiUrl({ id: 'bare.reaplugin' }), null);
    assert.equal(pluginUiUrl(null), null);
});

test('a websocket endpoint named ui is not a web page', () => {
    const wsOnly = { id: 'time-to-ready.reaplugin', api: [{ id: 'ui', type: 'websocket' }] };
    assert.equal(pluginUiUrl(wsOnly), null);
});

test('an id needing escaping stays intact in the path', () => {
    // Decaid's id rule permits characters that are not URL-safe; the path segment
    // is encoded so the link still points at the plugin it names.
    const url = pluginUiUrl({ id: "odd id.reaplugin", api: [{ id: 'ui', type: 'http' }] });
    assert.equal(url, 'http://x:8080/api/v1/plugins/odd%20id.reaplugin/ui');
});

// ── Shot Uploader controls are built from the plugin's manifest ──────────────
//
// The page used to hand-write its labels and its control list, and drifted: it
// still offered an "Upload existing shot history" toggle writing DrainHistory,
// a setting shot-upload 0.2.1 removed (reconciliation follows AutoUpload now).
// Reading GET /api/v1/plugins' `settings` schema instead means the page can only
// ever show what the plugin declares.

const shotUpload = (() => {
    const lift = (re, name) => {
        const m = source.match(re);
        assert.ok(m, `${name} not found in settings.js`);
        return m[0].replace('export ', '');
    };
    const body = [
        lift(/function escapeHtml\(str\) \{[\s\S]*?\r?\n\}/, 'escapeHtml'),
        lift(/export function pluginSettingLabel\(key\) \{[\s\S]*?\r?\n\}/, 'pluginSettingLabel'),
        lift(/export function renderPluginSettingControl\(key, schema\) \{[\s\S]*?\r?\n\}/, 'renderPluginSettingControl'),
    ].join('\n');
    // getTranslation is identity here: untranslated strings fall back to the
    // source string, so the manifest text is what reaches the page.
    return new Function('getTranslation',
        `${body}\nreturn { renderPluginSettingControl, pluginSettingLabel };`)(k => k);
})();

// The manifest shot-upload 0.2.1 actually ships.
const shotUploadSchema = {
    AutoUpload: {
        type: 'boolean',
        description: 'Upload shots automatically when they finish (opt-in; off by default)',
        default: false,
    },
    LengthThreshold: {
        type: 'number',
        description: 'Only upload shots longer than this many seconds (skips flushes)',
        default: 5,
    },
};

test('every sentence on the page comes from the manifest, not from settings.js', () => {
    const html = Object.keys(shotUploadSchema)
        .map(k => shotUpload.renderPluginSettingControl(k, shotUploadSchema[k])).join('');
    for (const [key, schema] of Object.entries(shotUploadSchema)) {
        assert.ok(html.includes(schema.description), `manifest text for ${key} is not on the page`);
        assert.ok(html.includes(`data-setting-key="${key}"`), `${key} has no control`);
    }
});

test('a setting the manifest does not declare gets no control', () => {
    // DrainHistory is the one that rotted: removed in 0.2.1, still on the page.
    const html = Object.keys(shotUploadSchema)
        .map(k => shotUpload.renderPluginSettingControl(k, shotUploadSchema[k])).join('');
    assert.ok(!html.includes('DrainHistory'));
});

test('the label is derived from the key, never invented', () => {
    assert.equal(shotUpload.pluginSettingLabel('AutoUpload'), 'Auto Upload');
    assert.equal(shotUpload.pluginSettingLabel('LengthThreshold'), 'Length Threshold');
    assert.equal(shotUpload.pluginSettingLabel('drain_history'), 'drain history');
});

test('each declared type gets its own widget', () => {
    const bool = shotUpload.renderPluginSettingControl('AutoUpload', shotUploadSchema.AutoUpload);
    const num = shotUpload.renderPluginSettingControl('LengthThreshold', shotUploadSchema.LengthThreshold);
    assert.match(bool, /type="checkbox" id="shotupload-setting-AutoUpload"/);
    assert.match(num, /type="number" id="shotupload-setting-LengthThreshold"/);
});

test('a type with no widget renders nothing rather than a broken control', () => {
    // The caller logs this, which is the prompt to add the widget. A half-drawn
    // control that silently discards writes would be worse than an absent one.
    assert.equal(shotUpload.renderPluginSettingControl('Roast', { type: 'enum', values: ['Light'] }), '');
    assert.equal(shotUpload.renderPluginSettingControl('Odd', { type: 'string' }), '');
    assert.equal(shotUpload.renderPluginSettingControl('Missing', undefined), '');
});

test('manifest text is escaped, not injected', () => {
    // The manifest is a file on disk that a sideloaded plugin controls.
    const html = shotUpload.renderPluginSettingControl('X', {
        type: 'boolean',
        description: '<img src=x onerror=alert(1)>',
    });
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img'));
});
