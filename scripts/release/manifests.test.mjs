import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertValidProduct,
  buildManifestRecord,
  isBinaryReleaseArtifactFilename,
  parseArtifactFilename,
} from '../pipeline/release/lib/manifests.mjs';

test('parseArtifactFilename parses expected artifact format', () => {
  const parsed = parseArtifactFilename('happiest-v1.2.3-linux-x64.tar.gz');
  assert.deepEqual(parsed, {
    product: 'happiest',
    version: '1.2.3',
    os: 'linux',
    arch: 'x64',
    filename: 'happiest-v1.2.3-linux-x64.tar.gz',
  });
});

test('parseArtifactFilename accepts prerelease versions containing hyphens', () => {
  const parsed = parseArtifactFilename('happiest-v0.1.0-preview.71.1-linux-x64.tar.gz');
  assert.deepEqual(parsed, {
    product: 'happiest',
    version: '0.1.0-preview.71.1',
    os: 'linux',
    arch: 'x64',
    filename: 'happiest-v0.1.0-preview.71.1-linux-x64.tar.gz',
  });
});

test('parseArtifactFilename recognizes every Happiest release product', () => {
  for (const product of ['happiest', 'happiest-server', 'hstack', 'happiest-memory-runtime', 'happiest-difftastic']) {
    assert.equal(parseArtifactFilename(`${product}-v1.2.3-windows-x64.tar.gz`)?.product, product);
  }
});

test('parseArtifactFilename rejects invalid names and the upstream product names', () => {
  assert.equal(parseArtifactFilename('happiest-linux-x64.tar.gz'), null);
  assert.equal(parseArtifactFilename('happiest-v1.2.3-linux-ppc.tar.gz'), null);
  for (const product of ['happier', 'happier-server', 'happier-memory-runtime', 'happier-difftastic']) {
    assert.equal(parseArtifactFilename(`${product}-v1.2.3-linux-x64.tar.gz`), null);
  }
});

test('assertValidProduct accepts only the Happiest release products', () => {
  assert.equal(assertValidProduct('happiest'), 'happiest');
  assert.equal(assertValidProduct('happiest-server'), 'happiest-server');
  assert.equal(assertValidProduct('hstack'), 'hstack');
  assert.throws(() => assertValidProduct('happier'), /invalid product "happier"/);
  assert.throws(() => assertValidProduct('happier-server'), /invalid product "happier-server"/);
});

test('release metadata filenames cover the Linux and Windows manifests and no macOS evidence', () => {
  for (const name of ['latest.json', 'linux-x64.json', 'linux-arm64.json', 'windows-x64.json']) {
    assert.equal(isBinaryReleaseArtifactFilename(name), true, name);
  }
  for (const name of ['darwin-arm64.json', 'darwin-x64.json', 'darwin-arm64.cli.json', 'darwin-x64.happiest-memory-runtime.json']) {
    assert.equal(isBinaryReleaseArtifactFilename(name), false, name);
  }
});

test('buildManifestRecord includes required fields and defaults', () => {
  const record = buildManifestRecord({
    product: 'hstack',
    channel: 'stable',
    version: '0.1.0',
    os: 'linux',
    arch: 'arm64',
    url: 'https://example.com/hstack-v0.1.0-linux-arm64.tar.gz',
    sha256: 'abc123',
  });
  assert.equal(record.product, 'hstack');
  assert.equal(record.channel, 'stable');
  assert.equal(record.rolloutPercent, 100);
  assert.equal(record.critical, false);
  assert.equal(typeof record.publishedAt, 'string');
});

test('buildManifestRecord accepts publicdev as a rolling prerelease channel', () => {
  const record = buildManifestRecord({
    product: 'happiest',
    channel: 'publicdev',
    version: '0.1.0-publicdev.1',
    os: 'linux',
    arch: 'x64',
    url: 'https://example.com/happiest-v0.1.0-publicdev.1-linux-x64.tar.gz',
    sha256: 'def456',
  });

  assert.equal(record.channel, 'publicdev');
});
