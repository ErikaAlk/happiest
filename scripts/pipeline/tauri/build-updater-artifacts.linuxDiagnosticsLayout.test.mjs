import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { resolveLinuxAppImageDiagnosticsLayout } from './build-updater-artifacts.mjs';

test('resolveLinuxAppImageDiagnosticsLayout returns consistent AppDir relative paths', () => {
  const layout = resolveLinuxAppImageDiagnosticsLayout({ environment: 'dev' });
  assert.equal(layout.productName, 'HappiestDev');
  assert.equal(layout.appRelativePath, path.join('usr', 'bin', 'app'));
  assert.equal(layout.legacyHsetupRelativePath, path.join('usr', 'bin', 'hsetup'));
  assert.equal(layout.resourceHsetupDirRelativePath, path.join('usr', 'lib', 'HappiestDev', 'binaries'));
  assert.equal(layout.resourceHsetupPrefix, 'hsetup-');
});

test('resolveLinuxAppImageDiagnosticsLayout uses the stable product name for production', () => {
  const layout = resolveLinuxAppImageDiagnosticsLayout({ environment: 'production' });
  assert.equal(layout.productName, 'Happiest');
  assert.equal(layout.resourceHsetupDirRelativePath, path.join('usr', 'lib', 'Happiest', 'binaries'));
});
