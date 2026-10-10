import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { findKitWebDir, readSyncedBody, renderSyncedFile } from './syncColorOsTokens.mjs';

test('finds the design kit next to any ancestor directory', () => {
    const root = resolve('/work');
    const kitTokens = join(root, 'coloros-ui-kit', 'web', 'tokens.g.ts');
    const found = findKitWebDir(join(root, 'Happiest', '.dev', 'worktree', 'app', 'apps', 'ui'), (path) => path === kitTokens);
    assert.equal(found, join(root, 'coloros-ui-kit', 'web'));
    assert.equal(findKitWebDir(join(root, 'elsewhere'), () => false), null);
});

test('a synced file compares equal to the kit source only through its body', () => {
    const source = 'export const CoTokens = {} as const;\n';
    const synced = renderSyncedFile('tokens.g.ts', source, 'abc1234');
    assert.equal(readSyncedBody(synced), source);
    assert.equal(readSyncedBody(source), null);
});
