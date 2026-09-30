import { describe, expect, it } from 'vitest';
import { getFirstPartyComponentCatalogEntry, resolveFirstPartyComponentPublicReleaseVariant } from './componentCatalog.js';

describe('CLI command names', () => {
  it.each([
    ['stable', ['happiest']],
    ['preview', ['happiest-preview']],
    ['publicdev', ['happiest-dev']],
  ] as const)('installs the %s channel under the product command name', (channel, shims) => {
    for (const componentId of ['happier-cli', 'happier-daemon'] as const) {
      expect(resolveFirstPartyComponentPublicReleaseVariant({ componentId, channel }).installShims).toEqual(shims);
    }
  });
});

describe('optional CLI components', () => {
  it.each([
    ['happier-memory-runtime', 'happiest-memory-runtime'],
    ['happier-difftastic', 'happiest-difftastic'],
  ] as const)('%s shares CLI releases without exposing shims', (componentId, releaseProductName) => {
    expect(getFirstPartyComponentCatalogEntry(componentId).releaseProductName).toBe(releaseProductName);
    for (const channel of ['stable', 'preview', 'publicdev'] as const) {
      expect(resolveFirstPartyComponentPublicReleaseVariant({ componentId, channel }).installShims).toEqual([]);
    }
  });
});
