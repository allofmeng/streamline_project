import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SUPPORTED_LANGUAGES, parseTranslationColumn } from '../src/modules/i18n-parser.js';

test('the cheap language list matches the translation sheet header', () => {
    const csv = readFileSync(new URL('../src/ui/de1 gui translation - Sheet1.csv', import.meta.url), 'utf8');
    const header = csv.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].split(',').map(value => value.trim());
    assert.deepEqual(SUPPORTED_LANGUAGES, header);
});

test('the parser retains only the requested column and handles quoted CSV values', () => {
    const csv = '\uFEFFen,de,fr\nHello,Hallo,Bonjour\n"With, comma","Mit, Komma","Avec, virgule"\n"Quote ""here""","Zitat ""hier""","Citation"\nFallback,,Repli';
    const { table, keyIndex } = parseTranslationColumn(csv, 'de');
    assert.deepEqual(table, {
        Hello: 'Hallo',
        'With, comma': 'Mit, Komma',
        'Quote "here"': 'Zitat "hier"',
        Fallback: 'Fallback',
    });
    assert.equal(keyIndex['with, comma'], 'With, comma');
    assert.equal(JSON.stringify(table).includes('Bonjour'), false);
});

test('selecting English does not request the translation sheet', async () => {
    const fetchCalls = [];
    globalThis.fetch = (...args) => {
        fetchCalls.push(args);
        throw new Error('English must not fetch translations');
    };
    globalThis.localStorage = { setItem() {} };
    globalThis.CustomEvent ??= class CustomEvent {
        constructor(type, options) {
            this.type = type;
            this.detail = options?.detail;
        }
    };
    globalThis.document = {
        body: { appendChild() {} },
        fonts: { status: 'loaded' },
        createElement: () => ({ style: {} }),
        querySelectorAll: () => [],
        getElementById: () => null,
        addEventListener() {},
        dispatchEvent() {},
    };

    const { setLanguage } = await import(`../src/modules/i18n.js?english-fast-path=${Date.now()}`);
    assert.equal(await setLanguage('en'), 'en');
    assert.equal(fetchCalls.length, 0);
});
