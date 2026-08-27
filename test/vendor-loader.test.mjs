import assert from 'node:assert/strict';
import { test } from 'node:test';

test('deferred vendor loads are shared across concurrent callers', async () => {
    const appended = [];
    globalThis.window = {};
    globalThis.document = {
        createElement(tagName) {
            return { tagName, remove() {} };
        },
        head: {
            appendChild(element) {
                appended.push(element);
                queueMicrotask(() => {
                    if (element.src?.includes('easymde')) window.EasyMDE = function EasyMDE() {};
                    if (element.src?.includes('iro.min')) window.iro = {};
                    element.onload();
                });
            },
        },
    };

    const { loadEasyMDE, loadIro } = await import('../src/modules/vendor-loader.js');
    const [firstEditor, secondEditor] = await Promise.all([loadEasyMDE(), loadEasyMDE()]);
    const [firstIro, secondIro] = await Promise.all([loadIro(), loadIro()]);
    assert.equal(firstEditor, secondEditor);
    assert.equal(firstIro, secondIro);
    assert.equal(appended.filter(element => element.src?.includes('easymde')).length, 1);
    assert.equal(appended.filter(element => element.href?.includes('easymde')).length, 1);
    assert.equal(appended.filter(element => element.src?.includes('iro.min')).length, 1);
});
