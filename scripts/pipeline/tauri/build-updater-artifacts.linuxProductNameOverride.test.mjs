import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveLinuxProductNameOverride } from './build-updater-artifacts.mjs';

test('resolveLinuxProductNameOverride returns stable product names without spaces for preview-like lanes', () => {
  assert.equal(resolveLinuxProductNameOverride({ environment: 'dev' }), 'HappiestDev');
  assert.equal(resolveLinuxProductNameOverride({ environment: 'publicdev' }), 'HappiestDev');
  assert.equal(resolveLinuxProductNameOverride({ environment: 'preview' }), 'HappiestPreview');
  assert.equal(resolveLinuxProductNameOverride({ environment: 'production' }), null);
});
