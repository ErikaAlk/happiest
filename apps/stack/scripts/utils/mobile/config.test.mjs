import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveMobileExpoConfig } from './config.mjs';

test('resolveMobileExpoConfig defaults dev-client scheme to happier-dev', () => {
  const cfg = resolveMobileExpoConfig({ env: {} });
  assert.equal(cfg.scheme, 'happier-dev');
});

test('resolveMobileExpoConfig leaves the Android package to the app variant unless one is given', () => {
  assert.equal(resolveMobileExpoConfig({ env: { APP_ENV: 'preview' } }).androidPackage, '');
  assert.equal(
    resolveMobileExpoConfig({ env: { APP_ENV: 'preview', EXPO_ANDROID_PACKAGE: 'com.example.app' } }).androidPackage,
    'com.example.app',
  );
  assert.equal(
    resolveMobileExpoConfig({
      env: { HAPPIER_STACK_ANDROID_PACKAGE: 'com.example.stack', EXPO_ANDROID_PACKAGE: 'com.example.app' },
    }).androidPackage,
    'com.example.stack',
  );
});
