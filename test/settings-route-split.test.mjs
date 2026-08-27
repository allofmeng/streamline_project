import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
