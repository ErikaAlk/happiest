import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  finalizePreparedBinaryArtifacts,
  prepareBinaryAssetsMain,
  prepareBinaryReleaseAssets,
} from './prepare-binary-assets.mjs';
import { parsePublishBinaryReleaseArgs } from './publish-binary-release.mjs';
import { getBinaryPublishProductSpec as getCompleteBinaryPublishProductSpec } from './product-specs.mjs';
import { writeChecksumsFile } from '../lib/release-files.mjs';
import { inspectImmutableReleaseCandidate } from '../lib/immutable-release-candidate.mjs';

const CLI_TARGETS = [
  ['linux', 'x64'],
  ['linux', 'arm64'],
  ['windows', 'x64'],
];

const REPO_ASSET_NAMES = ['install.sh', 'install.ps1', 'install-server.sh', 'happier-release.pub'];

// Existing generic envelope cases use only the base product; the complete CLI matrix is exercised below.
function getBinaryPublishProductSpec(product) {
  return { ...getCompleteBinaryPublishProductSpec(product), optionalComponentProducts: [] };
}

async function createRepoRoot() {
  const repoRoot = await mkdtemp(join(tmpdir(), 'happiest-prebuilt-repo-'));
  const installersDir = join(repoRoot, 'scripts', 'release', 'installers');
  await mkdir(installersDir, { recursive: true });
  for (const name of REPO_ASSET_NAMES) {
    await writeFile(join(installersDir, name), `repository source of ${name}\n`, 'utf8');
  }
  return repoRoot;
}

async function writeCliArchives(artifactsDir, version, targets = CLI_TARGETS) {
  for (const [os, arch] of targets) {
    const name = `happiest-v${version}-${os}-${arch}.tar.gz`;
    await writeFile(join(artifactsDir, name), `${os}-${arch}\n`, 'utf8');
  }
}

test('CLI publication requires complete optional matrices and seals each beneath the CLI envelope', async () => {
  const artifactsDir = await mkdtemp(join(tmpdir(), 'happiest-optional-publication-'));
  const repoRoot = await createRepoRoot();
  const version = '1.2.3-preview.4';
  const products = ['happiest-memory-runtime', 'happiest-difftastic'];
  const writes = [];
  const finalize = (extra = {}) => finalizePreparedBinaryArtifacts({
    artifactsDir, repoRoot, version, channel: 'preview', productSpec: getCompleteBinaryPublishProductSpec('cli'),
    writeChecksums: async (input) => {
      writes.push(input);
      return writeChecksumsFile(input);
    },
    signFile: async ({ path }) => {
      await writeFile(`${path}.minisig`, 'signature');
      return `${path}.minisig`;
    },
    ...extra,
  });
  try {
    await writeCliArchives(artifactsDir, version);
    for (const product of products) {
      for (const [os, arch] of CLI_TARGETS) {
        await writeFile(join(artifactsDir, `${product}-v${version}-${os}-${arch}.tar.gz`), 'component');
      }
    }
    const missing = join(artifactsDir, `happiest-difftastic-v${version}-windows-x64.tar.gz`);
    await rm(missing);
    await assert.rejects(finalize(), /missing prepared artifact.*happiest-difftastic/);
    assert.equal(writes.length, 0);
    await writeFile(missing, 'component');
    const result = await finalize();
    assert.deepEqual(writes.map(({ product }) => product), [...products, 'happiest']);
    for (const product of products) {
      const component = writes.find((entry) => entry.product === product);
      assert.equal(component.artifacts.length, CLI_TARGETS.length);
      for (const suffix of ['', '.minisig']) {
        assert.ok(result.artifacts.some(({ name }) => name === `checksums-${product}-v${version}.txt${suffix}`));
      }
    }
    // 9 archives, 4 repository assets, and 2 envelope files for each of the 2 optional components.
    assert.equal(result.artifacts.length, 9 + REPO_ASSET_NAMES.length + 4);
    const candidate = await inspectImmutableReleaseCandidate({ directory: artifactsDir, sourceTag: `cli-v${version}` });
    assert.equal(candidate.assetNames.length, 9 + REPO_ASSET_NAMES.length + 4);
    for (const name of REPO_ASSET_NAMES) {
      assert.ok(candidate.assetNames.includes(name), `${name} must be covered by the signed CLI envelope`);
    }

    const manifestsRoot = join(artifactsDir, 'manifests');
    const manifestsDir = join(manifestsRoot, 'v1', 'happiest', 'preview');
    await mkdir(manifestsDir, { recursive: true });
    for (const name of [...CLI_TARGETS.map(([os, arch]) => `${os}-${arch}.json`), 'latest.json']) {
      await writeFile(join(manifestsDir, name), '{}');
    }
    const withManifests = await finalize({ manifestsRoot, manifestsDir });
    assert.equal(withManifests.artifacts.length, 9 + REPO_ASSET_NAMES.length + 4 + CLI_TARGETS.length + 1);
    const finalized = await inspectImmutableReleaseCandidate({ directory: artifactsDir, sourceTag: `cli-v${version}` });
    assert.equal(finalized.assetNames.length, 9 + REPO_ASSET_NAMES.length + 4 + CLI_TARGETS.length + 1);
  } finally {
    await rm(artifactsDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('finalizePreparedBinaryArtifacts signs one complete native CLI artifact matrix with the installer assets', async () => {
  const artifactsDir = await mkdtemp(join(tmpdir(), 'happiest-prebuilt-cli-'));
  const repoRoot = await createRepoRoot();
  const version = '1.2.3-preview.4';
  try {
    await writeCliArchives(artifactsDir, version);
    const writes = [];
    const signs = [];

    const result = await finalizePreparedBinaryArtifacts({
      artifactsDir,
      repoRoot,
      productSpec: getBinaryPublishProductSpec('cli'),
      channel: 'preview',
      version,
      writeChecksums: async (input) => {
        writes.push(input);
        return join(artifactsDir, `checksums-happiest-v${version}.txt`);
      },
      signFile: async (input) => {
        signs.push(input);
        return `${input.path}.minisig`;
      },
    });

    assert.deepEqual(
      writes[0].artifacts.map((artifact) => artifact.name),
      [
        ...CLI_TARGETS.map(([os, arch]) => `happiest-v${version}-${os}-${arch}.tar.gz`),
        ...REPO_ASSET_NAMES,
      ],
    );
    assert.deepEqual(signs, [{
      path: join(artifactsDir, `checksums-happiest-v${version}.txt`),
      trustedComment: `happiest ${version} preview`,
    }]);
    assert.equal(result.artifacts.length, CLI_TARGETS.length + REPO_ASSET_NAMES.length);
    assert.equal(result.signaturePath, join(artifactsDir, `checksums-happiest-v${version}.txt.minisig`));
    for (const name of REPO_ASSET_NAMES) {
      assert.equal(await readFile(join(artifactsDir, name), 'utf8'), `repository source of ${name}\n`);
    }
  } finally {
    await rm(artifactsDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('finalizePreparedBinaryArtifacts flattens generated channel manifests into the signed release envelope', async () => {
  const artifactsDir = await mkdtemp(join(tmpdir(), 'happiest-prebuilt-cli-manifests-'));
  const repoRoot = await createRepoRoot();
  const manifestsDir = join(artifactsDir, 'manifests', 'v1', 'happiest', 'preview');
  const version = '1.2.3-preview.4';
  try {
    await writeCliArchives(artifactsDir, version);
    await mkdir(manifestsDir, { recursive: true });
    const manifestNames = [
      ...CLI_TARGETS.map(([os, arch]) => `${os}-${arch}.json`),
      'latest.json',
    ];
    for (const name of manifestNames) {
      await writeFile(join(manifestsDir, name), `${JSON.stringify({ name })}\n`, 'utf8');
    }
    const writes = [];

    await finalizePreparedBinaryArtifacts({
      artifactsDir,
      repoRoot,
      manifestsDir,
      manifestsRoot: join(artifactsDir, 'manifests'),
      productSpec: getBinaryPublishProductSpec('cli'),
      channel: 'preview',
      version,
      writeChecksums: async (input) => {
        writes.push(input);
        return join(artifactsDir, `checksums-happiest-v${version}.txt`);
      },
      signFile: async ({ path }) => `${path}.minisig`,
    });

    assert.deepEqual(
      writes[0].artifacts.map((artifact) => artifact.name).sort(),
      [
        ...CLI_TARGETS.map(([os, arch]) => `happiest-v${version}-${os}-${arch}.tar.gz`),
        ...REPO_ASSET_NAMES,
        ...manifestNames,
      ].sort(),
    );
    assert.deepEqual(
      (await readdir(artifactsDir)).filter((name) => name.endsWith('.json')).sort(),
      [...manifestNames].sort(),
    );
    assert.equal((await readdir(artifactsDir)).includes('manifests'), false);
  } finally {
    await rm(artifactsDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('finalizePreparedBinaryArtifacts refuses publication when a repository installer source is missing', async () => {
  const artifactsDir = await mkdtemp(join(tmpdir(), 'happiest-prebuilt-cli-missing-installer-'));
  const repoRoot = await createRepoRoot();
  const version = '1.2.3-preview.4';
  try {
    await writeCliArchives(artifactsDir, version);
    await rm(join(repoRoot, 'scripts', 'release', 'installers', 'install.ps1'));
    await assert.rejects(
      finalizePreparedBinaryArtifacts({
        artifactsDir,
        repoRoot,
        productSpec: getBinaryPublishProductSpec('cli'),
        channel: 'preview',
        version,
        writeChecksums: async () => {
          throw new Error('must not checksum a release without its installers');
        },
        signFile: async () => {
          throw new Error('must not sign a release without its installers');
        },
      }),
      /install\.ps1/u,
    );
  } finally {
    await rm(artifactsDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('finalizePreparedBinaryArtifacts publishes the repository installer bytes instead of candidate-supplied files', async () => {
  const artifactsDir = await mkdtemp(join(tmpdir(), 'happiest-prebuilt-cli-tampered-installer-'));
  const repoRoot = await createRepoRoot();
  const version = '1.2.3-dev.4';
  try {
    await writeCliArchives(artifactsDir, version);
    await writeFile(join(artifactsDir, 'install.sh'), 'candidate-supplied installer\n', 'utf8');

    await finalizePreparedBinaryArtifacts({
      artifactsDir,
      repoRoot,
      productSpec: getBinaryPublishProductSpec('cli'),
      channel: 'dev',
      version,
      writeChecksums: async () => join(artifactsDir, `checksums-happiest-v${version}.txt`),
      signFile: async ({ path }) => `${path}.minisig`,
    });

    assert.equal(await readFile(join(artifactsDir, 'install.sh'), 'utf8'), 'repository source of install.sh\n');
  } finally {
    await rm(artifactsDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
});

for (const { productId, manifestProduct } of [
  { productId: 'hstack', manifestProduct: 'hstack' },
  { productId: 'server', manifestProduct: 'happiest-server' },
]) {
  test(`finalizePreparedBinaryArtifacts signs the complete ${productId} envelope without extra assets`, async () => {
    const artifactsDir = await mkdtemp(join(tmpdir(), `happiest-prebuilt-${productId}-`));
    const version = '1.2.3-dev.4';
    try {
      for (const [os, arch] of CLI_TARGETS) {
        await writeFile(
          join(artifactsDir, `${manifestProduct}-v${version}-${os}-${arch}.tar.gz`),
          `${os}-${arch}\n`,
          'utf8',
        );
      }
      const writes = [];

      await finalizePreparedBinaryArtifacts({
        artifactsDir,
        productSpec: getBinaryPublishProductSpec(productId),
        channel: 'dev',
        version,
        writeChecksums: async (input) => {
          writes.push(input);
          return join(artifactsDir, `checksums-${manifestProduct}-v${version}.txt`);
        },
        signFile: async ({ path }) => `${path}.minisig`,
      });

      assert.deepEqual(
        writes[0].artifacts.map((artifact) => artifact.name).sort(),
        CLI_TARGETS.map(([os, arch]) => `${manifestProduct}-v${version}-${os}-${arch}.tar.gz`).sort(),
      );
    } finally {
      await rm(artifactsDir, { recursive: true, force: true });
    }
  });
}

test('finalizePreparedBinaryArtifacts fails closed when one native CLI target is missing', async () => {
  const artifactsDir = await mkdtemp(join(tmpdir(), 'happiest-prebuilt-cli-missing-'));
  const repoRoot = await createRepoRoot();
  const version = '1.2.3-preview.4';
  try {
    await writeCliArchives(artifactsDir, version, CLI_TARGETS.slice(0, -1));

    await assert.rejects(
      finalizePreparedBinaryArtifacts({
        artifactsDir,
        repoRoot,
        productSpec: getBinaryPublishProductSpec('cli'),
        channel: 'preview',
        version,
        writeChecksums: async () => {
          throw new Error('must not write checksums for an incomplete matrix');
        },
        signFile: async () => {
          throw new Error('must not sign an incomplete matrix');
        },
      }),
      /missing prepared artifact.*windows-x64/iu,
    );
  } finally {
    await rm(artifactsDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('finalizePreparedBinaryArtifacts rejects a macOS archive because no macOS build is published', async () => {
  const artifactsDir = await mkdtemp(join(tmpdir(), 'happiest-prebuilt-cli-darwin-'));
  const repoRoot = await createRepoRoot();
  const version = '1.2.3-preview.4';
  try {
    await writeCliArchives(artifactsDir, version);
    await writeFile(join(artifactsDir, `happiest-v${version}-darwin-arm64.tar.gz`), 'darwin\n', 'utf8');

    await assert.rejects(
      finalizePreparedBinaryArtifacts({
        artifactsDir,
        repoRoot,
        productSpec: getBinaryPublishProductSpec('cli'),
        channel: 'preview',
        version,
        writeChecksums: async () => {
          throw new Error('must not write checksums when a macOS archive is present');
        },
        signFile: async () => {
          throw new Error('must not sign when a macOS archive is present');
        },
      }),
      /unexpected prepared artifact.*darwin-arm64/iu,
    );
  } finally {
    await rm(artifactsDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('finalizePreparedBinaryArtifacts rejects stale archives before signing', async () => {
  const artifactsDir = await mkdtemp(join(tmpdir(), 'happiest-prebuilt-cli-stale-'));
  const repoRoot = await createRepoRoot();
  const version = '1.2.3-preview.4';
  try {
    await writeCliArchives(artifactsDir, version);
    await writeFile(join(artifactsDir, 'happiest-v1.2.3-preview.3-linux-x64.tar.gz'), 'stale\n', 'utf8');

    await assert.rejects(
      finalizePreparedBinaryArtifacts({
        artifactsDir,
        repoRoot,
        productSpec: getBinaryPublishProductSpec('cli'),
        channel: 'preview',
        version,
        writeChecksums: async () => {
          throw new Error('must not write checksums when stale artifacts are present');
        },
        signFile: async () => {
          throw new Error('must not sign when stale artifacts are present');
        },
      }),
      /unexpected prepared artifact.*preview\.3/iu,
    );
  } finally {
    await rm(artifactsDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('finalizePreparedBinaryArtifacts rejects files outside the exact publication envelope', async () => {
  const artifactsDir = await mkdtemp(join(tmpdir(), 'happiest-prebuilt-cli-extra-'));
  const repoRoot = await createRepoRoot();
  const version = '1.2.3-preview.4';
  try {
    await writeCliArchives(artifactsDir, version);
    await writeFile(join(artifactsDir, 'unreviewed-release-note.txt'), 'unexpected\n', 'utf8');

    await assert.rejects(
      finalizePreparedBinaryArtifacts({
        artifactsDir,
        repoRoot,
        productSpec: getBinaryPublishProductSpec('cli'),
        channel: 'preview',
        version,
        writeChecksums: async () => {
          throw new Error('must not checksum files outside the admitted publication envelope');
        },
        signFile: async () => {
          throw new Error('must not sign files outside the admitted publication envelope');
        },
      }),
      /unexpected prepared file.*unreviewed-release-note\.txt/iu,
    );
  } finally {
    await rm(artifactsDir, { recursive: true, force: true });
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('prepareBinaryReleaseAssets consumes a prepared matrix without rebuilding it', async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'happiest-prepare-prebuilt-cli-'));
  const finalized = [];
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
  };
  try {
    await prepareBinaryReleaseAssets({
      repoRoot,
      productId: 'cli',
      channel: 'preview',
      version: '1.2.3-preview.4',
      assetsBaseUrl: 'https://example.test/cli-preview',
      commitSha: 'a'.repeat(40),
      preparedArtifacts: true,
      dryRun: true,
      finalizePrepared: async (params) => {
        finalized.push(params);
      },
    });

    assert.equal(finalized.length, 2, 'prepared releases are first sealed for manifest generation, then resealed with those manifests');
    assert.equal(finalized[0].version, '1.2.3-preview.4');
    assert.equal(finalized[0].channel, 'preview');
    assert.equal(finalized[0].manifestsDir, undefined);
    assert.match(finalized[1].manifestsDir, /manifests[/\\]v1[/\\]happiest[/\\]preview$/u);
    assert.equal(
      logs.some((line) => line.includes('build-cli-binaries.mjs')),
      false,
      'prepared artifact publishing must not invoke a second CLI build',
    );
  } finally {
    console.log = originalLog;
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('prepareBinaryReleaseAssets publishes an already-finalized candidate envelope without re-signing or rebuilding', async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'happiest-prepare-finalized-cli-'));
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => {
    logs.push(args.join(' '));
  };
  try {
    await prepareBinaryReleaseAssets({
      repoRoot,
      productId: 'cli',
      channel: 'preview',
      version: '1.2.3-preview.4',
      assetsBaseUrl: 'https://example.test/cli-preview',
      commitSha: 'a'.repeat(40),
      preparedArtifacts: true,
      finalizedArtifacts: true,
      dryRun: true,
      finalizePrepared: async () => {
        throw new Error('an authenticated candidate envelope must not be re-signed');
      },
    });

    assert.equal(logs.some((line) => line.includes('build-cli-binaries.mjs')), false);
    assert.equal(logs.some((line) => line.includes('would finalize prepared artifacts')), false);
    assert.equal(
      logs.some(
        (line) => line.includes('--require-all-artifacts-checksummed')
          && line.includes('--require-signature'),
      ),
      true,
      'finalized artifact publishing must re-admit the exact signed payload set without rewriting it',
    );
  } finally {
    console.log = originalLog;
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('prepare-binary-assets exposes the existing complete-matrix finalizer without publishing', async () => {
  const calls = [];
  await prepareBinaryAssetsMain({
    cwd: '/workspace/happiest',
    argv: [
      '--finalize-prepared-only',
      '--product',
      'cli',
      '--channel',
      'dev',
      '--version',
      '1.2.3-dev.4',
      '--artifacts-dir',
      'dist/candidate-native-matrix',
    ],
    finalizePrepared: async (params) => {
      calls.push(params);
      return {
        artifacts: [],
        checksumsPath:
          '/workspace/happiest/dist/candidate-native-matrix/checksums-happiest-v1.2.3-dev.4.txt',
        signaturePath:
          '/workspace/happiest/dist/candidate-native-matrix/checksums-happiest-v1.2.3-dev.4.txt.minisig',
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].artifactsDir, '/workspace/happiest/dist/candidate-native-matrix');
  assert.equal(calls[0].productSpec.id, 'cli');
  assert.equal(calls[0].channel, 'dev');
  assert.equal(calls[0].version, '1.2.3-dev.4');
});

test('binary publisher accepts the prepared-artifacts handoff explicitly', () => {
  const values = parsePublishBinaryReleaseArgs([
    '--product',
    'cli',
    '--channel',
    'preview',
    '--prepared-artifacts',
  ]);

  assert.equal(values['prepared-artifacts'], true);
});

test('binary publisher accepts an exact finalized-artifacts handoff explicitly', () => {
  const values = parsePublishBinaryReleaseArgs([
    '--product',
    'cli',
    '--channel',
    'dev',
    '--version',
    '1.2.3-dev.4',
    '--finalized-artifacts',
  ]);

  assert.equal(values['finalized-artifacts'], true);
});

test('binary publisher can resolve one version for all native build jobs', () => {
  const values = parsePublishBinaryReleaseArgs([
    '--product',
    'cli',
    '--channel',
    'preview',
    '--resolve-version-only',
    '--github-output',
    '/tmp/github-output',
  ]);

  assert.equal(values['resolve-version-only'], true);
  assert.equal(values['github-output'], '/tmp/github-output');
});
