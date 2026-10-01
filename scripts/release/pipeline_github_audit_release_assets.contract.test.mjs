import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const scriptPath = resolve(repoRoot, 'scripts', 'pipeline', 'github', 'audit-release-assets.mjs');

function run(args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

test('audit-release-assets fails when expected assets are missing', async () => {
  const res = run([
    '--tag',
    'cli-preview',
    '--kind',
    'cli',
    '--version',
    '1.2.3-preview.123.2',
    '--targets',
    'linux-x64,linux-arm64',
    '--assets-json',
    JSON.stringify([
      'happiest-v1.2.3-preview.123.2-linux-x64.tar.gz',
      'checksums-happiest-v1.2.3-preview.123.2.txt',
      'checksums-happiest-v1.2.3-preview.123.2.txt.minisig',
    ]),
  ]);

  assert.notEqual(res.status, 0);
  const output = String(res.stdout ?? '') + String(res.stderr ?? '');
  assert.match(output, /missing/i);
  assert.match(output, /linux-arm64/);
});

for (const [kind, product] of [['cli', 'happiest'], ['stack', 'hstack'], ['server', 'happiest-server']]) {
  test(`audit-release-assets expects the ${product} archives and checksum envelope for ${kind} releases`, async () => {
    const res = run([
      '--tag',
      `${kind}-preview`,
      '--kind',
      kind,
      '--version',
      '1.2.3-preview.123.2',
      '--targets',
      'linux-x64',
      '--assets-json',
      JSON.stringify([]),
    ]);

    assert.notEqual(res.status, 0);
    const output = String(res.stdout ?? '') + String(res.stderr ?? '');
    assert.match(output, new RegExp(`- ${product}-v1\\.2\\.3-preview\\.123\\.2-linux-x64\\.tar\\.gz`));
    assert.match(output, new RegExp(`- checksums-${product}-v1\\.2\\.3-preview\\.123\\.2\\.txt\\.minisig`));
  });
}

test('audit-release-assets rejects macOS targets', async () => {
  const res = run([
    '--tag',
    'cli-preview',
    '--kind',
    'cli',
    '--version',
    '1.2.3-preview.123.2',
    '--targets',
    'darwin-arm64',
    '--assets-json',
    JSON.stringify([]),
  ]);

  assert.notEqual(res.status, 0);
  assert.match(String(res.stdout ?? '') + String(res.stderr ?? ''), /unknown target/i);
});

test('audit-release-assets succeeds when all expected assets are present', async () => {
  const res = run([
    '--tag',
    'cli-preview',
    '--kind',
    'cli',
    '--version',
    '1.2.3-preview.123.2',
    '--targets',
    'linux-x64,linux-arm64',
    '--assets-json',
    JSON.stringify([
      'happiest-v1.2.3-preview.123.2-linux-x64.tar.gz',
      'happiest-v1.2.3-preview.123.2-linux-arm64.tar.gz',
      'checksums-happiest-v1.2.3-preview.123.2.txt',
      'checksums-happiest-v1.2.3-preview.123.2.txt.minisig',
    ]),
  ]);

  assert.equal(res.status, 0, `expected exit 0, got ${res.status} stderr=${res.stderr}`);
});

