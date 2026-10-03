import * as React from 'react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderScreen, standardCleanup } from '@/dev/testkit';

(
    globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
    }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
    standardCleanup();
});

// Stable references: the view derives effects from the machine list identities.
const machineState = vi.hoisted(() => {
    const machine = {
        id: 'machine-1',
        active: false,
        activeAt: 0,
        metadata: { host: 'fresh-computer', platform: 'win32' },
    };
    return {
        machine,
        all: [machine],
        byServerId: { srv_1: [machine] },
        statusByServerId: { srv_1: 'idle' },
    };
});
const machine = machineState.machine;

vi.mock('react-native-mmkv', () => {
    class MMKV {
        #store = new Map<string, string>();

        public getString(key: string): string | undefined {
            return this.#store.get(key);
        }

        public set(key: string, value: string): void {
            this.#store.set(key, value);
        }

        public delete(key: string): void {
            this.#store.delete(key);
        }
    }

    return { MMKV };
});

vi.mock('react-native', async () => {
    const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
    return createReactNativeWebMock();
});

vi.mock('react-native-unistyles', async () => {
    const { createUnistylesMock } = await import('@/dev/testkit/mocks/unistyles');
    return createUnistylesMock();
});

vi.mock('@expo/vector-icons', async () => (await import('@/dev/testkit/mocks/icons')).createExpoVectorIconsMock());

vi.mock('expo-router', async () => {
    const { createExpoRouterMock } = await import('@/dev/testkit/mocks/router');
    return createExpoRouterMock({ router: { push: vi.fn(), back: vi.fn(), replace: vi.fn(), setParams: vi.fn() } }).module;
});

vi.mock('@/text', async () => {
    const { createTextModuleMock } = await import('@/dev/testkit/mocks/text');
    return createTextModuleMock({
        translate: (key: string) => key,
        translateLoose: (key: string) => key,
    });
});

vi.mock('@/modal', async () => {
    const { createModalModuleMock } = await import('@/dev/testkit/mocks/modal');
    return createModalModuleMock().module;
});

vi.mock('expo-constants', () => ({
    default: { expoConfig: { version: '0.0.0-test' }, deviceName: 'test-device' },
}));

vi.mock('expo-application', () => ({
    nativeApplicationVersion: '0.0.0-test',
    nativeBuildVersion: '1',
    applicationId: 'dev.happier.test',
}));

vi.mock('expo-updates', () => ({
    updateId: 'embedded-update-id',
    createdAt: new Date('2026-04-07T08:00:00.000Z'),
    channel: 'preview',
    runtimeVersion: '0.0.0-test',
    isEmbeddedLaunch: true,
}));

vi.mock('expo-clipboard', () => ({
    setStringAsync: vi.fn(async () => {}),
}));

vi.mock('@/constants/Typography', () => ({
    Typography: {
        default: () => ({}),
        mono: () => ({}),
        eyebrow: () => ({}),
        keyHint: () => ({}),
    },
}));

vi.mock('@/sync/domains/server/serverRuntime', () => ({
    getActiveServerSnapshot: () => ({ generation: 1, serverId: 'srv_1', serverUrl: 'https://relay.example.test' }),
}));

vi.mock('@/sync/domains/server/serverProfiles', () => ({
    listServerProfiles: () => [],
}));

vi.mock('@/hooks/inbox/useUpdates', () => ({
    useUpdates: () => ({
        otaUpdatesEnabled: false,
        updateAvailable: false,
        isChecking: false,
        isDownloading: false,
        isRestarting: false,
        isUpdatePending: false,
        downloadProgress: undefined,
        lastCheckForUpdateTimeSinceRestart: undefined,
        checkForUpdates: vi.fn(),
        reloadApp: vi.fn(),
    }),
}));

vi.mock('@/hooks/ui/useNativeUpdate', () => ({
    useNativeUpdate: () => null,
}));

vi.mock('@/sync/ops/machines', () => ({
    machineCollectBugReportDiagnostics: async () => ({}),
}));

vi.mock('@/sync/domains/state/storage', async () => {
    const { createStorageModuleStub } = await import('@/dev/testkit/mocks/storage');
    return createStorageModuleStub({
        useProfile: () => ({ id: 'prof_1', username: 'u1', connectedServices: [] }),
        useIsDataReady: () => true,
        useRealtimeStatus: () => 'connected',
        useSocketStatus: () => ({ status: 'connected', lastError: null, lastErrorAt: null }),
        useEndpointConnectivity: () => ({
            status: 'online',
            reason: null,
            attempt: 0,
            nextRetryAt: null,
            lastConnectedAt: null,
            lastDisconnectedAt: null,
            lastErrorMessage: null,
        }),
        useLastSyncAt: () => null,
        useAllMachines: () => machineState.all,
        useMachineListByServerId: () => machineState.byServerId,
        useMachineListStatusByServerId: () => machineState.statusByServerId,
    });
});

describe('SystemStatusView (computer whose CLI has no relay yet)', () => {
    it('names the missing relay instead of a relay address when the cached doctor snapshot has no server', async () => {
        const { writeCachedMachineDoctorSnapshot } = await import('./cache/machineDoctorSnapshotCache');
        writeCachedMachineDoctorSnapshot({
            serverId: 'srv_1',
            machineId: machine.id,
            cachedAt: Date.now(),
            snapshot: {
                capturedAt: '2026-10-02T00:00:00.000Z',
                server: null,
                accountId: null,
                settings: { activeServerId: null, servers: [], knownAccountIds: [] },
            },
        });
        const { SystemStatusView } = await import('./SystemStatusView');

        const screen = await renderScreen(React.createElement(SystemStatusView));

        const text = screen.getTextContent();
        expect(text).toContain('systemStatus.machine.daemonAttributionNoRelay');
        expect(text).not.toContain('systemStatus.machine.daemonAttribution ');
        expect(text).not.toContain('systemStatus.mismatch');
    });
});
