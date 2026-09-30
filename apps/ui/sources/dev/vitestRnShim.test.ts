import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

describe('vitestRnShim', () => {
    it('resolves React peers from the app when a hoisted dependency carries a nested copy', () => {
        const appRequire = createRequire(import.meta.url);
        // Radix compose-refs is hoisted to the repository root with its own nested `react`
        // (root `nohoist`); the app's dismissable layer reaches it through a CJS require.
        const dismissableLayerRequire = createRequire(appRequire.resolve('@radix-ui/react-dismissable-layer'));
        const composeRefsRequire = createRequire(dismissableLayerRequire.resolve('@radix-ui/react-compose-refs'));

        expect(composeRefsRequire('react')).toBe(appRequire('react'));
        expect(composeRefsRequire('react/jsx-runtime')).toBe(appRequire('react/jsx-runtime'));
    });

    it('resolves aliased asset requires in Node test runtime', () => {
        const asset = (globalThis as any).require('@/assets/images/logo-black.png');
        expect(typeof asset).toBe('string');
        expect(asset).toContain('logo-black.png');
    });

    it('fails loudly for non-asset aliased requires outside the allowlist', () => {
        expect(() => (globalThis as any).require('@/sync/storageStore')).toThrow(
            /Unsupported alias require/i,
        );
    });
});
