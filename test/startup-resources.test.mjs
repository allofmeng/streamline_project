import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('route-only vendors and pages are absent from the startup preload list', () => {
    const index = read('index.html');
    assert.doesNotMatch(index, /rel="preload"/);
    assert.doesNotMatch(index, /<script[^>]+(?:easymde|iro\.min)/);
    assert.doesNotMatch(index, /<link[^>]+easymde\.min\.css/);
});

test('font faces use WOFF2 with swap and no browser TTF references', () => {
    const css = read('src/css/main.css');
    assert.doesNotMatch(css, /url\([^)]*\.ttf/);
    assert.equal((css.match(/font-display: swap/g) || []).length, 11);
    for (const name of ['Inter-Regular', 'Inter-SemiBold', 'Inter-Bold', 'NotoSansMono-SemiBold']) {
        assert.equal(existsSync(new URL(`src/ui/${name}.woff2`, root)), true);
    }
});

test('process-lifetime chart and profile listeners use stable identities', () => {
    const chart = read('src/modules/chart.js');
    const profiles = read('src/modules/profile_selector.js');
    const settings = read('src/settings/settings.js');
    assert.match(chart, /window\.addEventListener\('resize', handleChartWindowResize\)/);
    assert.match(chart, /document\.addEventListener\('streamline:languagechange', handleChartLanguageChange\)/);
    assert.match(profiles, /new WeakSet\(\)/);
    assert.match(profiles, /document\.addEventListener\('profiles-updated', handleProfilesUpdated\)/);
    assert.doesNotMatch(profiles, /document\.addEventListener\('profiles-updated', \(\) =>/);
    assert.match(settings, /if \(!settingsLanguageListenerInstalled\)/);
    assert.match(settings, /document\.addEventListener\('streamline:languagechange', handleSettingsLanguageChange\)/);
});

test('notes confirmation reads the plain textarea when EasyMDE is unavailable', () => {
    const notes = read('src/modules/notes-modal.js');
    assert.match(notes, /easyMDE\?\.value\(\) \?\?/);
    assert.match(notes, /loadEasyMDE\(\)/);
});

test('startup settings prefetch reuses the workflow loaded for the dashboard', () => {
    const app = read('src/modules/app.js');
    assert.match(app, /const workflow = await loadInitialData\(\);/);
    assert.match(app, /prefetchSettingsToIDB\(initialWorkflow\)/);
    assert.match(app, /workflow \? Promise\.resolve\(workflow\) : getWorkflow\(\)/);
});

test('noncritical styles and duplicate module entries do not block startup', () => {
    const index = read('index.html');
    for (const asset of ['numpad-modal.css', 'time-picker-modal.css', 'notes-modal.css', 'context-menu.css', 'help-overlay.css']) {
        assert.doesNotMatch(index, new RegExp(`<link[^>]+${asset.replace('.', '\\.')}[^>]*>`));
    }
    assert.doesNotMatch(index, /<script[^>]+router\.js/);
    assert.doesNotMatch(index, /<script[^>]+helpOverlay\.js/);
});

test('help implementation and route resources are deferred and cleaned up', () => {
    const app = read('src/modules/app.js');
    const ui = read('src/modules/ui.js');
    const launcher = read('src/modules/help-launcher.js');
    const router = read('src/modules/router.js');
    const chart = read('src/modules/chart.js');
    assert.match(app, /requestAnimationFrame\(\(\) => requestAnimationFrame/);
    assert.doesNotMatch(app, /^import .*numpad-modal\.js/m);
    assert.doesNotMatch(app, /^import .*time-picker-modal\.js/m);
    assert.doesNotMatch(ui, /^import .*numpad-modal\.js/m);
    assert.match(app, /import\('\.\/numpad-modal\.js'\)/);
    assert.match(app, /import\('\.\/time-picker-modal\.js'\)/);
    assert.match(launcher, /import\('\.\/helpOverlay\.js'\)/);
    assert.match(router, /await cleanupSubpage\(\)/);
    assert.match(chart, /export function cleanupSubpageChart/);
});

test('production startup logging is disabled', () => {
    const app = read('src/modules/app.js');
    const chart = read('src/modules/chart.js');
    const logger = read('src/modules/logger.js');
    assert.doesNotMatch(app, /setDebug\(true\)/);
    assert.doesNotMatch(chart, /console\.log\('initChart/);
    assert.match(logger, /info: noop/);
});

test('startup scales and reveals before asynchronous preference reconciliation', () => {
    const app = read('src/modules/app.js');
    const scaling = read('src/modules/scaling.js');
    const css = read('src/css/main.css');
    assert.ok(app.indexOf('initScaling();') < app.indexOf('await Promise.all([i18nReady, unitsReady])'));
    assert.match(scaling, /updateScale\(\);[\s\S]*requestAnimationFrame\(\(\) => content\.classList\.add\('scaled'\)\)/);
    assert.match(scaling, /setTimeout\(updateScale, 250\)/);
    assert.doesNotMatch(scaling, /\}, 300\);\s*\}, 100\);/);
    assert.doesNotMatch(css.match(/#scaled-content \{[\s\S]*?\}/)?.[0] || '', /opacity|transition/);
});

test('startup preferences use local storage before IndexedDB and translations are version cached', () => {
    const i18n = read('src/modules/i18n.js');
    const units = read('src/modules/units.js');
    assert.ok(i18n.indexOf("localStorage.getItem('language')") < i18n.indexOf("getSetting('language')"));
    assert.ok(units.indexOf('localStorage.getItem(TEMP_UNIT_KEY)') < units.indexOf('getSetting(TEMP_UNIT_KEY)'));
    assert.match(i18n, /`translations:\$\{APP_VERSION\}:\$\{language\}`/);
    assert.match(i18n, /parsed = await getSetting\(cacheKey\)/);
    assert.match(i18n, /setSetting\(cacheKey, parsed\)/);
});
