import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

test('bump-versions-dev script bumps the single product version and prints git steps in dry-run', async () => {
  const out = execFileSync(
    process.execPath,
    [
      resolve(repoRoot, 'scripts', 'pipeline', 'release', 'bump-versions-dev.mjs'),
      '--bump-product',
      'patch',
      '--bump-website',
      'none',
      '--dry-run',
    ],
    { cwd: repoRoot, env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 },
  );

  assert.match(out, /scripts[\\/]pipeline[\\/]release[\\/]bump-version\.mjs --component product --bump patch/);
  assert.doesNotMatch(out, /--component (app|cli|server|stack)\b/);
  assert.match(out, /\bgit config user\.name\b/);
  assert.match(out, /\bgit add\b/);
  assert.match(out, /\bgit commit -m\b/);
  assert.match(out, /\bgit push origin HEAD:dev\b/);
});
