// Which profile record a tile edit (dose / yield / grind / brew temp) gets
// saved onto. The bug this pins: the id was resolved only against the five
// favourite slots, so a loaded profile that sat in no slot resolved to nothing
// and the edit was silently dropped instead of stored in profile metadata.
// Run: node --test test/active-profile.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfileKeyByTitle } from '../src/modules/active-profile.js';

const profiles = {
    'profile:aaa': { profile: { title: 'Londonium' }, isDefault: true },
    'profile:bbb': { profile: { title: 'Blooming Espresso' }, isDefault: true },
    'profile:ccc': { profile: { title: 'Londonium' } },            // user fork
    'profile:ddd': { profile: { title: 'Café crème' }, isDefault: true },
};

test('resolves a profile that is on no favourite button', () => {
    assert.equal(resolveProfileKeyByTitle(profiles, 'Blooming Espresso'), 'profile:bbb');
});

test('prefers the user fork over the same-titled bundled default', () => {
    assert.equal(resolveProfileKeyByTitle(profiles, 'Londonium'), 'profile:ccc');
});

test('matches the translated title shown in #profile-name', () => {
    const translate = t => (t === 'Café crème' ? 'Milchkaffee' : t);
    assert.equal(resolveProfileKeyByTitle(profiles, 'Milchkaffee', translate), 'profile:ddd');
});

test('unknown / empty titles resolve to nothing rather than a wrong profile', () => {
    for (const bad of [null, undefined, '', '   ', 'Not A Profile']) {
        assert.equal(resolveProfileKeyByTitle(profiles, bad), null);
    }
});
