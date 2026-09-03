// The DE1 tablets run an old Android System WebView (pre-Chromium 92 on some
// units). Anything newer than that silently throws at runtime and takes the
// live chart down with it -- see issue #72, where trace.x.at(-1) killed every
// snapshot frame. Keep app source free of those APIs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src', 'index.html'];
const SKIP = /\.min\.js$/;

// API -> first Chromium version that shipped it.
const BANNED = [
    [/\.at\(\s*-?\d/g, 'Array.prototype.at (Chromium 92)'],
    [/\bstructuredClone\s*\(/g, 'structuredClone (Chromium 98)'],
    [/\bObject\.hasOwn\s*\(/g, 'Object.hasOwn (Chromium 93)'],
    [/\.findLast(Index)?\s*\(/g, 'Array.prototype.findLast (Chromium 97)'],
    [/\.(toSorted|toReversed|toSpliced)\s*\(/g, 'Array change-by-copy (Chromium 110)'],
    [/\bObject\.groupBy\s*\(/g, 'Object.groupBy (Chromium 117)'],
];

function* walk(path) {
    if (statSync(path).isFile()) {
        if (/\.(js|mjs|html)$/.test(path) && !SKIP.test(path)) yield path;
        return;
    }
    for (const entry of readdirSync(path)) yield* walk(join(path, entry));
}

test('app source avoids APIs missing from old Android WebViews', () => {
    const hits = [];
    for (const root of ROOTS) {
        for (const file of walk(root)) {
            const source = readFileSync(file, 'utf8');
            for (const [pattern, label] of BANNED) {
                for (const match of source.matchAll(pattern)) {
                    const line = source.slice(0, match.index).split('\n').length;
                    hits.push(`${file}:${line} uses ${label} -- ${match[0]}`);
                }
            }
        }
    }
    assert.deepEqual(hits, [], `\n${hits.join('\n')}\n`);
});
