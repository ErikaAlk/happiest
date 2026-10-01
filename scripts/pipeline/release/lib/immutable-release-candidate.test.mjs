import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildRollingAssetPlan } from '../../github/rolling-release-asset-plan.mjs';
import { inspectImmutableReleaseCandidate, resolveImmutableCandidateIdentity } from './immutable-release-candidate.mjs';

async function fixture({
  sourceTag = 'cli-v1.2.3-preview.4',
  checksumsName = 'checksums-happiest-v1.2.3-preview.4.txt',
  extraName = '',
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'immutable-release-candidate-'));
  await writeFile(join(directory, 'happiest-v1.2.3-preview.4-linux-x64.tar.gz'), 'archive');
  await writeFile(
    join(directory, checksumsName),
    `${'a'.repeat(64)}  happiest-v1.2.3-preview.4-linux-x64.tar.gz\n`,
  );
  await writeFile(join(directory, `${checksumsName}.minisig`), 'signature');
  if (extraName) await writeFile(join(directory, extraName), 'extra');
  return { directory, sourceTag };
}

test('binds the immutable tag, expected product/version, and complete signed envelope', async () => {
  const current = await fixture();
  try {
    const inspected = await inspectImmutableReleaseCandidate({
      directory: current.directory,
      sourceTag: current.sourceTag,
      expectedProduct: 'cli',
      expectedVersion: '1.2.3-preview.4',
    });
    assert.equal(inspected.product, 'cli');
    assert.equal(inspected.version, '1.2.3-preview.4');
    assert.equal(inspected.checksumsName, 'checksums-happiest-v1.2.3-preview.4.txt');
  } finally {
    await rm(current.directory, { recursive: true, force: true });
  }
});

test('resolves each binary product to its Happiest checksum envelope name', () => {
  assert.deepEqual(
    ['cli', 'hstack', 'server'].map((product) => resolveImmutableCandidateIdentity({ product, version: '1.2.3' }).checksumsName),
    ['checksums-happiest-v1.2.3.txt', 'checksums-hstack-v1.2.3.txt', 'checksums-happiest-server-v1.2.3.txt'],
  );
});

test('admits the signed desktop envelope through the same canonical inspector', async () => {
  const current = await fixture({
    sourceTag: 'ui-desktop-v1.2.3',
    checksumsName: 'checksums-happier-ui-desktop-v1.2.3.txt',
  });
  try {
    const inspected = await inspectImmutableReleaseCandidate({
      directory: current.directory,
      sourceTag: current.sourceTag,
      expectedProduct: 'ui-desktop',
      expectedVersion: '1.2.3',
    });
    assert.equal(inspected.product, 'ui-desktop');
    assert.equal(inspected.version, '1.2.3');
  } finally {
    await rm(current.directory, { recursive: true, force: true });
  }
});

test('admits exact CLI component checksum envelopes only when bound by the main envelope', async () => {
  const current = await fixture();
  const name = 'checksums-happiest-memory-runtime-v1.2.3-preview.4.txt';
  try {
    for (const asset of [name, `${name}.minisig`]) {
      await writeFile(join(current.directory, asset), 'component envelope');
      await appendFile(join(current.directory, 'checksums-happiest-v1.2.3-preview.4.txt'), `${'b'.repeat(64)}  ${asset}\n`);
    }
    const inspected = await inspectImmutableReleaseCandidate(current);
    assert.ok(inspected.assetNames.includes(name));
    await writeFile(join(current.directory, 'checksums-happiest-difftastic-v1.2.3-preview.4.txt'), 'unsigned');
    await assert.rejects(inspectImmutableReleaseCandidate(current), /unsigned|file set/);
  } finally {
    await rm(current.directory, { recursive: true, force: true });
  }
});

test('carries the CLI installers and public key only when the signed envelope covers them', async () => {
  const current = await fixture();
  const installers = ['install.sh', 'install.ps1', 'install-server.sh', 'happier-release.pub'];
  try {
    for (const asset of installers) {
      await writeFile(join(current.directory, asset), 'installer');
    }
    await assert.rejects(inspectImmutableReleaseCandidate(current), /unsigned assets: .*install\.sh/);
    for (const asset of installers) {
      await appendFile(join(current.directory, 'checksums-happiest-v1.2.3-preview.4.txt'), `${'c'.repeat(64)}  ${asset}\n`);
    }
    const inspected = await inspectImmutableReleaseCandidate(current);
    for (const asset of installers) {
      assert.ok(inspected.assetNames.includes(asset), `${asset} must be carried by the immutable release`);
    }
  } finally {
    await rm(current.directory, { recursive: true, force: true });
  }
});

test('the rolling cli-stable projection carries the installers and public key under their own names', async () => {
  const current = await fixture();
  const installers = ['install.sh', 'install.ps1', 'install-server.sh', 'happier-release.pub'];
  try {
    for (const asset of installers) {
      await writeFile(join(current.directory, asset), 'installer');
      await appendFile(join(current.directory, 'checksums-happiest-v1.2.3-preview.4.txt'), `${'c'.repeat(64)}  ${asset}\n`);
    }
    const inspected = await inspectImmutableReleaseCandidate(current);
    const plan = buildRollingAssetPlan({
      immutableNames: [...inspected.assetNames, inspected.checksumsName, inspected.signatureName],
      payloadNames: inspected.assetNames,
      version: inspected.version,
      rollingTag: 'cli-stable',
    });

    for (const asset of installers) {
      assert.deepEqual(plan.filter((entry) => entry.sourceName === asset), [{ name: asset, sourceName: asset }]);
    }
    assert.ok(plan.some((entry) => entry.name === 'happiest-linux-x64.tar.gz'
      && entry.sourceName === 'happiest-v1.2.3-preview.4-linux-x64.tar.gz'));
  } finally {
    await rm(current.directory, { recursive: true, force: true });
  }
});

test('rejects a mismatched product, version, checksum envelope, or unsigned extra asset', async () => {
  const wrongProduct = await fixture();
  const wrongVersion = await fixture();
  const wrongChecksums = await fixture({ checksumsName: 'checksums-hstack-v1.2.3-preview.4.txt' });
  const upstreamChecksums = await fixture({ checksumsName: 'checksums-happier-v1.2.3-preview.4.txt' });
  const extra = await fixture({ extraName: 'unbound.json' });
  try {
    await assert.rejects(
      inspectImmutableReleaseCandidate({ directory: wrongProduct.directory, sourceTag: wrongProduct.sourceTag, expectedProduct: 'server' }),
      /source tag.*product|expected product/i,
    );
    await assert.rejects(
      inspectImmutableReleaseCandidate({ directory: wrongVersion.directory, sourceTag: wrongVersion.sourceTag, expectedVersion: '1.2.4' }),
      /expected version/i,
    );
    await assert.rejects(
      inspectImmutableReleaseCandidate({ directory: wrongChecksums.directory, sourceTag: wrongChecksums.sourceTag }),
      /checksums/i,
    );
    await assert.rejects(
      inspectImmutableReleaseCandidate({ directory: upstreamChecksums.directory, sourceTag: upstreamChecksums.sourceTag }),
      /checksums/i,
    );
    await assert.rejects(
      inspectImmutableReleaseCandidate({ directory: extra.directory, sourceTag: extra.sourceTag }),
      /unsigned|unsupported|file set/i,
    );
  } finally {
    await Promise.all([wrongProduct, wrongVersion, wrongChecksums, upstreamChecksums, extra].map((entry) => (
      rm(entry.directory, { recursive: true, force: true })
    )));
  }
});
