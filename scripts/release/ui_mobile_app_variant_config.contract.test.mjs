import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const { APP_ENVIRONMENT_CONFIGS, getAppEnvironmentConfig, normalizeAppEnvironmentId } = require(
  path.join(repoRoot, 'apps', 'ui', 'appVariantConfig.cjs'),
);
const { getReleaseRingCatalogEntry } = require(
  path.join(repoRoot, 'packages', 'release-runtime', 'releaseRings.cjs'),
);

test('appVariantConfig normalizes legacy mobile environment aliases into the new internal/public ring ids', () => {
  assert.equal(normalizeAppEnvironmentId('development'), 'internaldev');
  assert.equal(normalizeAppEnvironmentId('dev'), 'publicdev');
  assert.equal(normalizeAppEnvironmentId('canary'), 'internalpreview');
  assert.equal(normalizeAppEnvironmentId('stable'), 'production');
});

test('appVariantConfig treats publicdev as a preview-like public ring with its own native identity', () => {
  const publicdev = getAppEnvironmentConfig('publicdev');

  assert.equal(publicdev.id, 'publicdev');
  assert.equal(publicdev.logicalVariant, 'preview');
  assert.equal(publicdev.name, `${productIdentity.productName} (dev)`);
  assert.equal(publicdev.iosBundleId, 'dev.happier.app.publicdev');
  assert.equal(publicdev.scheme, 'happier-dev');
  assert.equal(publicdev.scheme, getReleaseRingCatalogEntry('publicdev').appScheme);
  // User-facing OTA channel should be "dev" (internal lane is "publicdev").
  assert.equal(publicdev.updatesChannel, 'dev');
  assert.equal(publicdev.featurePolicyEnv, 'preview');
});

test('appVariantConfig installs every variant under the product Android application id', () => {
  // The stable app uses the product id itself; every other variant appends its own id, so all of
  // them coexist with each other and with upstream Happier on one phone.
  for (const [id, config] of Object.entries(APP_ENVIRONMENT_CONFIGS)) {
    const expected = id === 'production' ? productIdentity.androidPackage : `${productIdentity.androidPackage}.${id}`;
    assert.equal(config.androidPackage, expected, id);
  }
});
