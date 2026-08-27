import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync('src/modules/api.js', 'utf8');
const match = source.match(/export async function connectScaleDevice\(\) \{[\s\S]*?\n\}/);

test('scale connection preserves the original fetch failure', async () => {
    assert.ok(match);
    const failure = new Error('offline');
    const connect = new Function('fetch', 'API_BASE_URL', 'logger', `${match[0].replace('export ', '')}; return connectScaleDevice;`)(
        async () => { throw failure; },
        'http://localhost',
        { info() {}, error() {} },
    );
    await assert.rejects(connect(), error => error === failure);
});
