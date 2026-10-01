import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

function run(args, env = {}) {
  return spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'pipeline', 'run.mjs'), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

for (const [environment, buildVersion] of [
  ['preview', '0.0.0-preview.1'],
  ['dev', '0.0.0-dev.1'],
]) {
  test(`pipeline run exposes tauri-build-updater-artifacts for ${environment} (dry-run)`, () => {
    const res = run(
      [
        'tauri-build-updater-artifacts',
        '--environment',
        environment,
        '--build-version',
        buildVersion,
        '--tauri-target',
        'x86_64-unknown-linux-gnu',
        '--ui-dir',
        'apps/ui',
        '--secrets-source',
        'keychain',
        '--dry-run',
      ],
      {
        TAURI_SIGNING_PRIVATE_KEY: '/tmp/tauri.signing.key',
      },
    );
    assert.equal(res.status, 0, `expected exit 0, got ${res.status} stderr=${res.stderr}`);
  });
}

test('pipeline run no longer offers tauri-notarize-macos-artifacts', () => {
  const res = run(['tauri-notarize-macos-artifacts', '--dry-run']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /Unsupported subcommand: tauri-notarize-macos-artifacts/);
});

for (const environment of ['preview', 'dev']) {
  test(`pipeline run exposes tauri-collect-updater-artifacts for ${environment} (dry-run)`, () => {
    const res = run(
      [
        'tauri-collect-updater-artifacts',
        '--environment',
        environment,
        '--platform-key',
        'linux-x86_64',
        '--ui-version',
        '0.0.0',
        '--tauri-target',
        'x86_64-unknown-linux-gnu',
        '--ui-dir',
        'apps/ui',
        '--dry-run',
      ],
    );
    assert.equal(res.status, 0, `expected exit 0, got ${res.status} stderr=${res.stderr}`);
  });
}
