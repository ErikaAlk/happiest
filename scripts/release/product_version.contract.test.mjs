import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listProductVersionFiles, readProductVersion } from '../pipeline/release/lib/product-version.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

test('every product component in the repository carries the single product version', () => {
  assert.ok(listProductVersionFiles(repoRoot).includes('apps/ui/src-tauri/tauri.conf.json'));
  assert.match(readProductVersion(repoRoot), /^\d+\.\d+\.\d+$/);
});
