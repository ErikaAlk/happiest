import React from 'react';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createWelcomeFeaturesResponse,
    renderWelcomeScreen,
    waitForWelcomeTestId,
} from './index.testHelpers';
import { flushHookEffects, standardCleanup } from '@/dev/testkit';
import type { ServerFeaturesSnapshot } from '@/sync/api/capabilities/serverFeaturesClient';

type ReactActEnvironmentGlobal = typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
};
(globalThis as ReactActEnvironmentGlobal).IS_REACT_ACT_ENVIRONMENT = true;

const routerMocks = vi.hoisted(() => ({
    push: vi.fn(),
}));

vi.mock('expo-router', async () => {
    const { createExpoRouterMock } = await import('@/dev/testkit/mocks/router');
    return createExpoRouterMock({ router: { push: routerMocks.push } }).module;
});
vi.mock('react-native-reanimated', async () => {
    const { createReanimatedModuleMock } = await import('@/dev/testkit/mocks/reanimated');
    return createReanimatedModuleMock();
});
vi.mock('react-native-typography', () => ({ iOSUIKit: { title3: {} } }));
vi.mock('@/components/navigation/shell/HomeHeader', () => ({ HomeHeaderNotAuth: () => null }));
vi.mock('@/components/navigation/shell/MainView', () => ({ MainView: () => null }));
vi.mock('@shopify/react-native-skia', () => ({}));

vi.mock('@/components/onboarding/unauthShell', async () => {
    const React = await import('react');
    return {
        UnauthenticatedSplitShell: (props: { children?: React.ReactNode }) =>
            React.createElement('UnauthenticatedSplitShell', null, props.children),
        useApplyBrandHeroSeen: () => vi.fn(),
    };
});
vi.mock('@/encryption/libsodium.lib', () => ({
    default: {
        crypto_sign_seed_keypair: () => ({
            publicKey: new Uint8Array(),
            privateKey: new Uint8Array(),
        }),
    },
}));
vi.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@/auth/context/AuthContext', () => ({
    useAuth: () => ({
        isAuthenticated: false,
        credentials: null,
        login: vi.fn(async () => {}),
        logout: vi.fn(async () => {}),
    }),
}));

vi.mock('@/sync/domains/pending/pendingTerminalConnect', () => ({
    getPendingTerminalConnect: () => null,
    setPendingTerminalConnect: vi.fn(),
    clearPendingTerminalConnect: vi.fn(),
}));

vi.mock('@/sync/api/capabilities/getReadyServerFeatures', () => ({
    getReadyServerFeatures: vi.fn(async () => null),
}));

const getServerFeaturesSnapshotMock = vi.fn(async (_params?: unknown): Promise<ServerFeaturesSnapshot> => ({
    status: 'ready',
    features: createWelcomeFeaturesResponse(),
}));

vi.mock('@/sync/api/capabilities/serverFeaturesClient', () => ({
    getServerFeaturesSnapshot: getServerFeaturesSnapshotMock,
}));

function clearConfiguredServerEnv(): void {
    delete process.env.EXPO_PUBLIC_HAPPIER_SERVER_URL;
    delete process.env.EXPO_PUBLIC_HAPPY_SERVER_URL;
    delete process.env.EXPO_PUBLIC_SERVER_URL;
    delete process.env.EXPO_PUBLIC_HAPPY_PRECONFIGURED_SERVERS;
    delete process.env.EXPO_PUBLIC_HAPPY_SERVER_CONTEXT;
}

describe('/ (welcome) without a configured Relay', () => {
    beforeEach(() => {
        vi.resetModules();
        clearConfiguredServerEnv();
        process.env.EXPO_PUBLIC_HAPPY_STORAGE_SCOPE = `test_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        routerMocks.push.mockReset();
        getServerFeaturesSnapshotMock.mockClear();
    });
    afterEach(() => {
        standardCleanup();
        delete process.env.EXPO_PUBLIC_HAPPY_STORAGE_SCOPE;
    });

    it('offers adding a Relay and issues no features probe', async () => {
        const screen = await renderWelcomeScreen({ configuredServerUrl: null });

        expect(screen.findByTestId('welcome-relay-not-configured')).not.toBeNull();
        expect(screen.findAllByTestId('welcome-primary-start')).toHaveLength(0);
        expect(screen.findAllByTestId('welcome-server-unavailable')).toHaveLength(0);
        expect(getServerFeaturesSnapshotMock).not.toHaveBeenCalled();

        await screen.pressByTestIdAsync('welcome-add-relay');
        expect(routerMocks.push).toHaveBeenCalledWith('/setup?openCustom=1');
    });

    it('probes the Relay and offers sign-in once a Relay is added', async () => {
        const screen = await renderWelcomeScreen({ configuredServerUrl: null });
        expect(getServerFeaturesSnapshotMock).not.toHaveBeenCalled();

        const { upsertAndActivateServer } = await import('@/sync/domains/server/serverRuntime');
        await act(async () => {
            upsertAndActivateServer({ serverUrl: 'https://relay.example.test', scope: 'device' });
            await flushHookEffects();
        });

        expect(await waitForWelcomeTestId(screen, 'welcome-primary-start')).toBeGreaterThan(0);
        expect(screen.findByTestId('welcome-relay-not-configured')).toBeNull();
        expect(getServerFeaturesSnapshotMock).toHaveBeenCalledWith({ timeoutMs: 6000, force: false });
    });
});
