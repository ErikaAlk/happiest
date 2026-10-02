const path = require('node:path');

// Keep this module dependency-free so it can run in GitHub Actions before `yarn install`.
// We load the canonical release ring catalog and product identity from their checked-in CJS entrypoints.
const releaseRuntimeDir = path.resolve(__dirname, '..', '..', 'packages', 'release-runtime');
const { getReleaseRingCatalogEntry, normalizeReleaseRingId } = require(path.join(releaseRuntimeDir, 'releaseRings.cjs'));
const { productIdentity } = require(path.join(releaseRuntimeDir, 'productIdentity.cjs'));

function resolveLogicalVariantFromRing(ring) {
    if (ring.expoAppEnv === 'production') return 'production';
    if (ring.expoAppEnv === 'development') return 'development';
    return 'preview';
}

function buildRingBackedConfig(ringId, overrides) {
    const ring = getReleaseRingCatalogEntry(ringId);
    return {
        id: ringId,
        logicalVariant: resolveLogicalVariantFromRing(ring),
        name: overrides.name,
        iosBundleId: overrides.iosBundleId,
        androidPackage: `${productIdentity.androidPackage}.${ringId}`,
        scheme: ring.appScheme,
        updatesChannel: ring.expoUpdatesChannel,
        featurePolicyEnv: ring.embeddedPolicyEnv,
        enableAssociatedDomains: overrides.enableAssociatedDomains,
    };
}

function buildProductionConfig(overrides) {
    const ring = getReleaseRingCatalogEntry('stable');
    return {
        id: 'production',
        logicalVariant: 'production',
        name: overrides.name,
        iosBundleId: overrides.iosBundleId,
        androidPackage: productIdentity.androidPackage,
        scheme: ring.appScheme,
        updatesChannel: ring.expoUpdatesChannel,
        featurePolicyEnv: ring.embeddedPolicyEnv,
        enableAssociatedDomains: overrides.enableAssociatedDomains,
    };
}

const APP_ENVIRONMENT_CONFIGS = {
    internaldev: buildRingBackedConfig('internaldev', {
        name: 'Happiest (internal dev)',
        iosBundleId: 'dev.happier.app.dev.internal',
        enableAssociatedDomains: false,
    }),
    internalpreview: buildRingBackedConfig('internalpreview', {
        name: 'Happiest (internal preview)',
        iosBundleId: 'dev.happier.app.internalpreview',
        enableAssociatedDomains: false,
    }),
    publicdev: buildRingBackedConfig('publicdev', {
        name: 'Happiest (dev)',
        iosBundleId: 'dev.happier.app.publicdev',
        enableAssociatedDomains: false,
    }),
    preview: buildRingBackedConfig('preview', {
        name: 'Happiest (preview)',
        iosBundleId: 'dev.happier.app.preview',
        enableAssociatedDomains: false,
    }),
    production: buildProductionConfig({
        name: 'Happiest',
        iosBundleId: 'dev.happier.app',
        enableAssociatedDomains: true,
    }),
};

function normalizeAppEnvironmentId(raw) {
    const value = String(raw ?? '').trim().toLowerCase();
    if (!value) return '';
    if (Object.prototype.hasOwnProperty.call(APP_ENVIRONMENT_CONFIGS, value)) {
        return value;
    }

    const ring = normalizeReleaseRingId(value);
    if (!ring) return '';
    return ring === 'stable' ? 'production' : ring;
}

function getAppEnvironmentConfig(raw) {
    const normalized = normalizeAppEnvironmentId(raw) || 'internaldev';
    return APP_ENVIRONMENT_CONFIGS[normalized];
}

module.exports = {
    APP_ENVIRONMENT_CONFIGS,
    getAppEnvironmentConfig,
    normalizeAppEnvironmentId,
};
