import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('src/modules/router.js', 'utf8');

test('popstate renders without writing another history entry', () => {
    assert.match(source, /loadPage\(event\.state\.pageUrl, \{ history: 'none' \}\)/);
    assert.match(source, /showMainPage\(\{ history: 'none' \}\)/);
});

test('direct routes replace while user navigation pushes by default', () => {
    assert.match(source, /loadPage\(pageUrl, \{ history: 'replace' \}\)/);
    assert.match(source, /loadPage\(pageUrl, \{ history = 'push' \} = \{\}\)/);
});
