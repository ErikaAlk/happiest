import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { productIdentity } from '../dist/productIdentity.js';

test('config-time consumers receive the same product identity as runtime consumers', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.exports['./productIdentity'].require, './productIdentity.cjs');
  assert.ok(pkg.files.includes('productIdentity.cjs'));
  const require = createRequire(import.meta.url);
  assert.deepEqual(require('../productIdentity.cjs').productIdentity, productIdentity);
});
