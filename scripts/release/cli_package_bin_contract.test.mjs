import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

test('@happier-dev/cli package exposes the public command shims', () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'apps', 'cli', 'package.json'), 'utf8'));

  assert.deepEqual(pkg.bin, {
    happiest: './bin/happiest.mjs',
    'happiest-source': './bin/happiest-source.mjs',
    'happiest-mcp': './bin/happiest-mcp.mjs',
  });
});
