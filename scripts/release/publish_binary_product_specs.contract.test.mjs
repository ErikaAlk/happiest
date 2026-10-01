import test from 'node:test';
import assert from 'node:assert/strict';

import { CLI_BINARY_TARGETS, SERVER_BINARY_TARGETS } from '@happier-dev/cli-common/componentArtifacts';
import { getFirstPartyComponentCatalogEntry } from '@happier-dev/cli-common/firstPartyRuntime';
import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

import * as productSpecs from '../pipeline/release/publishing/product-specs.mjs';

const {
  BINARY_PUBLISH_PRODUCT_IDS,
  CLI_OPTIONAL_COMPONENTS,
  CLI_OPTIONAL_COMPONENT_PRODUCTS,
  getBinaryPublishProductSpec,
} = productSpecs;

const publishTargets = (targets) => targets.map(({ os, arch }) => ({ os, arch }));

test('binary publish product specs expose the canonical per-product release metadata', () => {
  assert.deepEqual(BINARY_PUBLISH_PRODUCT_IDS, ['cli', 'hstack', 'server']);

  assert.deepEqual(getBinaryPublishProductSpec('cli'), {
    id: 'cli',
    pipelineLabel: 'cli-binaries',
    publishSurfaceLabel: 'CLI binary publishing',
    minisignRequirementLabel: 'CLI release artifacts',
    packageJsonPath: 'apps/cli/package.json',
    patchPackageVersionOnRolling: true,
    buildScriptPath: 'scripts/pipeline/release/build-cli-binaries.mjs',
    artifactsDir: 'dist/release-assets/cli',
    manifestProduct: 'happiest',
    manifestOutDir: 'dist/release-assets/cli/manifests',
    checksumProductStem: 'happiest',
    rollingTagPrefix: 'cli',
    versionTagPrefix: 'cli-v',
    releaseTitleBase: 'Happiest CLI',
    rollingNotesSubject: 'CLI binaries',
    versionNotesSubject: 'CLI',
    artifactTargets: publishTargets(CLI_BINARY_TARGETS),
    optionalComponentProducts: ['happiest-memory-runtime', 'happiest-difftastic'],
    repoAssetPaths: [
      'scripts/release/installers/install.sh',
      'scripts/release/installers/install.ps1',
      'scripts/release/installers/install-server.sh',
      'scripts/release/installers/happier-release.pub',
    ],
  });

  assert.deepEqual(getBinaryPublishProductSpec('hstack'), {
    id: 'hstack',
    pipelineLabel: 'hstack-binaries',
    publishSurfaceLabel: 'hstack binary publishing',
    minisignRequirementLabel: 'hstack release artifacts',
    packageJsonPath: 'apps/stack/package.json',
    patchPackageVersionOnRolling: true,
    buildScriptPath: 'scripts/pipeline/release/build-hstack-binaries.mjs',
    artifactsDir: 'dist/release-assets/stack',
    manifestProduct: 'hstack',
    manifestOutDir: 'dist/release-assets/stack/manifests',
    checksumProductStem: 'hstack',
    rollingTagPrefix: 'stack',
    versionTagPrefix: 'stack-v',
    releaseTitleBase: 'Happiest Stack',
    rollingNotesSubject: 'hstack binaries',
    versionNotesSubject: 'hstack',
    artifactTargets: publishTargets(CLI_BINARY_TARGETS),
    repoAssetPaths: [],
  });

  assert.deepEqual(getBinaryPublishProductSpec('server'), {
    id: 'server',
    pipelineLabel: 'server-runtime',
    publishSurfaceLabel: 'server runtime publishing',
    minisignRequirementLabel: 'server runtime release artifacts',
    packageJsonPath: 'apps/server/package.json',
    patchPackageVersionOnRolling: false,
    buildScriptPath: 'scripts/pipeline/release/build-server-binaries.mjs',
    artifactsDir: 'dist/release-assets/server',
    manifestProduct: 'happiest-server',
    manifestOutDir: 'dist/release-assets/server/manifests',
    checksumProductStem: 'happiest-server',
    rollingTagPrefix: 'server',
    versionTagPrefix: 'server-v',
    releaseTitleBase: 'Happiest Server',
    rollingNotesSubject: 'server runtime release',
    versionNotesSubject: 'Server runtime',
    artifactTargets: publishTargets(SERVER_BINARY_TARGETS),
    repoAssetPaths: [],
  });
});

test('binary publish product names and titles come from the component catalog and product identity', () => {
  const productOf = (componentId) => getFirstPartyComponentCatalogEntry(componentId).releaseProductName;

  assert.equal(getBinaryPublishProductSpec('cli').manifestProduct, productOf('happier-cli'));
  assert.equal(getBinaryPublishProductSpec('cli').checksumProductStem, productOf('happier-cli'));
  assert.equal(getBinaryPublishProductSpec('server').manifestProduct, productOf('happier-server'));
  assert.equal(getBinaryPublishProductSpec('server').checksumProductStem, productOf('happier-server'));
  assert.equal(getBinaryPublishProductSpec('hstack').manifestProduct, productOf('hstack'));
  assert.equal(getBinaryPublishProductSpec('hstack').checksumProductStem, productOf('hstack'));
  assert.equal(getBinaryPublishProductSpec('cli').releaseTitleBase, `${productIdentity.productName} CLI`);
  assert.equal(getBinaryPublishProductSpec('server').releaseTitleBase, `${productIdentity.productName} Server`);
  assert.equal(getBinaryPublishProductSpec('hstack').releaseTitleBase, `${productIdentity.productName} Stack`);
});

test('CLI optional components keep their build component ids and publish under the catalog product names', () => {
  assert.deepEqual(CLI_OPTIONAL_COMPONENTS, [
    { componentId: 'happier-memory-runtime', product: 'happiest-memory-runtime' },
    { componentId: 'happier-difftastic', product: 'happiest-difftastic' },
  ]);
  assert.deepEqual(CLI_OPTIONAL_COMPONENT_PRODUCTS, ['happiest-memory-runtime', 'happiest-difftastic']);
  for (const { componentId, product } of CLI_OPTIONAL_COMPONENTS) {
    assert.equal(getFirstPartyComponentCatalogEntry(componentId).releaseProductName, product);
  }
});

test('binary publish targets have one owner and exclude macOS', () => {
  assert.equal('BINARY_PUBLISH_TARGETS' in productSpecs, false);
  for (const id of BINARY_PUBLISH_PRODUCT_IDS) {
    const targets = getBinaryPublishProductSpec(id).artifactTargets.map(({ os, arch }) => `${os}-${arch}`);
    assert.deepEqual(targets, ['linux-x64', 'linux-arm64', 'windows-x64'], id);
  }
});

test('binary publish product specs carry no notarization evidence', () => {
  for (const id of BINARY_PUBLISH_PRODUCT_IDS) {
    assert.equal('notarizationEvidenceSuffix' in getBinaryPublishProductSpec(id), false, id);
  }
});

test('binary publish product specs reject unknown publish products', () => {
  assert.throws(() => getBinaryPublishProductSpec('unknown'), /Unknown binary publish product/i);
});
