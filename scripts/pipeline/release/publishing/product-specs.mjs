// @ts-check

// This module is loaded before workspace dependencies are installed (release version allocation and
// the credentialed finalizer), so it cannot import `@happier-dev/*` packages. Its product names,
// titles and targets repeat the values owned by the first-party component catalog
// (`releaseProductName`), `productIdentity.productName` and cli-common's `CLI_BINARY_TARGETS` /
// `SERVER_BINARY_TARGETS`; scripts/release/publish_binary_product_specs.contract.test.mjs checks
// every one of them against those owners.

/**
 * @typedef {{
 *   id: 'cli' | 'hstack' | 'server';
 *   pipelineLabel: string;
 *   publishSurfaceLabel: string;
 *   minisignRequirementLabel: string;
 *   packageJsonPath: string;
 *   patchPackageVersionOnRolling: boolean;
 *   buildScriptPath: string;
 *   artifactsDir: string;
 *   manifestProduct: string;
 *   manifestOutDir: string;
 *   checksumProductStem: string;
 *   rollingTagPrefix: string;
 *   versionTagPrefix: string;
 *   releaseTitleBase: string;
 *   rollingNotesSubject: string;
 *   versionNotesSubject: string;
 *   artifactTargets: ReadonlyArray<Readonly<{ os: string; arch: string }>>;
 *   optionalComponentProducts?: readonly string[];
 *   repoAssetPaths: readonly string[];
 * }} BinaryPublishProductSpec
 */

/** @type {ReadonlyArray<BinaryPublishProductSpec['id']>} */
export const BINARY_PUBLISH_PRODUCT_IDS = Object.freeze(['cli', 'hstack', 'server']);

/**
 * CLI components built into their own archives next to the base CLI archive: the component id
 * drives the build, the product name names the archive and its checksum envelope.
 */
export const CLI_OPTIONAL_COMPONENTS = Object.freeze([
  Object.freeze({ componentId: 'happier-memory-runtime', product: 'happiest-memory-runtime' }),
  Object.freeze({ componentId: 'happier-difftastic', product: 'happiest-difftastic' }),
]);

export const CLI_OPTIONAL_COMPONENT_PRODUCTS = Object.freeze(CLI_OPTIONAL_COMPONENTS.map(({ product }) => product));

const PUBLISH_TARGETS = Object.freeze([
  Object.freeze({ os: 'linux', arch: 'x64' }),
  Object.freeze({ os: 'linux', arch: 'arm64' }),
  Object.freeze({ os: 'windows', arch: 'x64' }),
]);

/** Installer scripts and the signing public key, published verbatim with every CLI release. */
const CLI_REPO_ASSET_PATHS = Object.freeze([
  'scripts/release/installers/install.sh',
  'scripts/release/installers/install.ps1',
  'scripts/release/installers/install-server.sh',
  'scripts/release/installers/happier-release.pub',
]);

/** @type {Readonly<Record<BinaryPublishProductSpec['id'], Readonly<BinaryPublishProductSpec>>>} */
const PRODUCT_SPECS = Object.freeze({
  cli: Object.freeze({
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
    artifactTargets: PUBLISH_TARGETS,
    optionalComponentProducts: CLI_OPTIONAL_COMPONENT_PRODUCTS,
    repoAssetPaths: CLI_REPO_ASSET_PATHS,
  }),
  hstack: Object.freeze({
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
    artifactTargets: PUBLISH_TARGETS,
    repoAssetPaths: Object.freeze([]),
  }),
  server: Object.freeze({
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
    artifactTargets: PUBLISH_TARGETS,
    repoAssetPaths: Object.freeze([]),
  }),
});

/**
 * @param {string} productId
 * @returns {Readonly<BinaryPublishProductSpec>}
 */
export function getBinaryPublishProductSpec(productId) {
  const spec = PRODUCT_SPECS[/** @type {BinaryPublishProductSpec['id']} */ (productId)];
  if (!spec) {
    throw new Error(`Unknown binary publish product: ${productId}`);
  }
  return spec;
}
