import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SETTINGS_TREE } from '../src/settings/settings-tree.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('settings route swaps after the shell is initialized', () => {
    const router = read('src/modules/router.js');
    const shellInit = router.indexOf('await initializeSettingsShell()');
    const mainHide = router.indexOf("mainPage.style.display = 'none'", shellInit);

    assert.ok(shellInit > 0);
    assert.ok(mainHide > shellInit);
    assert.doesNotMatch(router, /import\('\.\.\/settings\/settings\.js'\)/);
});

test('settings shell keeps quick adjustments out of the legacy module', () => {
    const shell = read('src/settings/settings-shell.js');
    const quick = read('src/settings/categories/quick-adjustments.js');
    const maintenance = read('src/settings/categories/maintenance.js');
    const app = read('src/modules/app.js');

    assert.match(shell, /quickadjustments:\s*\(\) => import\('\.\/categories\/quick-adjustments\.js'\)/);
    assert.match(shell, /bluetooth:\s*\(\) => import\('\.\/categories\/legacy-category\.js'\)/);
    assert.match(shell, /maintenance:\s*\(\) => import\('\.\/categories\/maintenance\.js'\)/);
    assert.match(shell, /getElementById\('settings-body'\)\?\.parentElement/);
    assert.doesNotMatch(quick, /settings\.js/);
    assert.doesNotMatch(maintenance, /settings\.js/);
    assert.match(maintenance, /action !== 'descale' && action !== 'confirm-air-purge'/);
    assert.match(maintenance, /setMachineState\(action === 'descale' \? 'descaling' : 'airPurge'\)/);
    assert.match(app, /addEventListener\('pointerdown',[\s\S]*prefetchSettingsPage/);
});

test('the shell nav tree and the legacy nav tree share one source, so they cannot drift', () => {
    const shell = read('src/settings/settings-shell.js');
    const legacy = read('src/settings/settings.js');

    assert.match(shell, /import\s*\{\s*SETTINGS_TREE as CANONICAL_SETTINGS_TREE\s*\}\s*from\s*'\.\/settings-tree\.js'/);
    assert.match(legacy, /import\s*\{\s*SETTINGS_TREE as settingsTree\s*\}\s*from\s*'\.\/settings-tree\.js'/);
    // Guards against a hand-authored duplicate creeping back into the shell,
    // like the one that dropped calib_sensors and split Skin's two entries
    // into one before the tree was unified.
    assert.doesNotMatch(shell, /quickadjustments:\s*Object\.freeze\(\[/);
    assert.doesNotMatch(legacy, /'quickadjustments':\s*\{/);

    // Every main category in the canonical tree must have a loader or be the
    // one (quickadjustments) already covered by its own dedicated loader test.
    const mainCategories = Object.keys(SETTINGS_TREE);
    for (const category of mainCategories) {
        assert.match(shell, new RegExp(`${category}:\\s*\\(\\)\\s*=>\\s*import\\(`), `${category} has no CATEGORY_LOADERS entry in the shell`);
    }

    // calib_sensors and the split Skin entries (theme + appearance) are the
    // exact spots that had drifted; assert they still round-trip.
    assert.ok(SETTINGS_TREE.calibration.subcategories.some(sub => sub.settingsCategory === 'calib_sensors'));
    assert.deepEqual(SETTINGS_TREE.skin.subcategories.map(sub => sub.settingsCategory), ['theme', 'appearance']);
});
