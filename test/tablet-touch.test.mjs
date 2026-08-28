import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('long press uses pointer events without blocking touch start', () => {
    const ui = read('src/modules/ui.js');
    const helper = ui.slice(ui.indexOf('export function setupPressAndHold'), ui.indexOf('export function flashElement'));
    const startPress = helper.slice(helper.indexOf('const startPress'), helper.indexOf('const movePress'));
    assert.match(helper, /addEventListener\('pointerdown'/);
    assert.match(helper, /addEventListener\('pointermove'/);
    assert.match(helper, /addEventListener\('pointercancel'/);
    assert.match(helper, /Math\.hypot\([\s\S]*movementThreshold/);
    assert.doesNotMatch(helper, /touchstart|mousedown/);
    assert.doesNotMatch(startPress, /preventDefault/);
    assert.match(helper, /stopImmediatePropagation/);
});

test('tablet menus use larger rows, bottom sheets and focus restoration', () => {
    const menu = read('src/modules/context-menu.js');
    const css = read('src/css/context-menu.css');
    assert.match(menu, /actionCount >= 4/);
    assert.match(menu, /anchor\.focus\(\{ preventScroll: true \}\)/);
    assert.match(css, /@media \(pointer: coarse\)[\s\S]*min-height: 60px/);
    assert.match(css, /context-menu--bottom-sheet/);
    assert.match(css, /#sub-categories-separator::after[\s\S]*width: 48px/);
});

test('profile cards scroll vertically and expose a visible action button', () => {
    const profiles = read('src/modules/profile_selector.js');
    assert.match(profiles, /profile-context-trigger w-\[56px\] h-\[56px\]/);
    assert.match(profiles, /setupPressAndHold\(div,[\s\S]*touchAction: 'pan-y'/);
});
