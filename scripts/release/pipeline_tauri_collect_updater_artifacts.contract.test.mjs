import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const collectScript = resolve(repoRoot, 'scripts', 'pipeline', 'tauri', 'collect-updater-artifacts.mjs');

for (const [environment, artifactBase] of [
  ['preview', 'happier-ui-desktop-preview-linux-x86_64'],
  ['dev', 'happier-ui-desktop-dev-linux-x86_64'],
]) {
  test(`tauri collect-updater-artifacts script supports ${environment} dry-run`, async () => {
    const out = execFileSync(
      process.execPath,
      [
        collectScript,
        '--environment',
        environment,
        '--platform-key',
        'linux-x86_64',
        '--ui-version',
        '1.2.3',
        '--dry-run',
      ],
      {
        cwd: repoRoot,
        env: { ...process.env },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
      },
    );

    assert.match(out, /dist[\\/]tauri[\\/]updates[\\/]linux-x86_64/);
    assert.match(out, new RegExp(artifactBase));
  });
}

test('tauri collect-updater-artifacts script rejects macOS platform keys', () => {
  const result = spawnSync(
    process.execPath,
    [collectScript, '--environment', 'dev', '--platform-key', 'darwin-aarch64', '--ui-version', '1.2.3', '--dry-run'],
    { cwd: repoRoot, env: { ...process.env }, encoding: 'utf8', timeout: 30_000 },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown platform key: darwin-aarch64/);
});
