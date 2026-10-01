import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

test('bump-version updates app package + tauri versions without requiring a literal expo.version in app.config.js', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'happiest-bump-app-'));
  const appDir = path.join(tmpRoot, 'apps', 'ui');
  const tauriDir = path.join(appDir, 'src-tauri');
  fs.mkdirSync(tauriDir, { recursive: true });
  for (const dir of ['apps/cli', 'apps/server', 'packages/relay-server', 'apps/stack']) {
    fs.mkdirSync(path.join(tmpRoot, dir), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, dir, 'package.json'), `${JSON.stringify({ name: dir, version: '0.1.2' }, null, 2)}\n`);
  }

  const packageJsonPath = path.join(appDir, 'package.json');
  const appConfigPath = path.join(appDir, 'app.config.js');
  const tauriConfigPath = path.join(tauriDir, 'tauri.conf.json');

  fs.writeFileSync(packageJsonPath, `${JSON.stringify({ name: 'ui', version: '0.1.2' }, null, 2)}\n`);
  const dynamicConfig = `const versionOverride = (process.env.EXPO_APP_VERSION || '').trim();
const packageJsonVersion = require('./package.json').version;

module.exports = {
    expo: {
        version: versionOverride || packageJsonVersion || "0.1.0"
    }
};
`;
  fs.writeFileSync(appConfigPath, dynamicConfig);
  fs.writeFileSync(tauriConfigPath, `${JSON.stringify({ version: '0.1.2' }, null, 2)}\n`);

  const nextVersion = execFileSync(
    process.execPath,
    [resolve(repoRoot, 'scripts', 'pipeline', 'release', 'bump-version.mjs'), '--component', 'product', '--bump', 'minor'],
    { cwd: tmpRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 },
  ).trim();

  assert.equal(nextVersion, '0.2.0');

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  assert.equal(pkg.version, '0.2.0');

  const tauri = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
  assert.equal(tauri.version, '0.2.0');

  const appConfigAfter = fs.readFileSync(appConfigPath, 'utf8');
  assert.equal(appConfigAfter, dynamicConfig, 'dynamic Expo config should stay source-of-truth free and untouched');
});
