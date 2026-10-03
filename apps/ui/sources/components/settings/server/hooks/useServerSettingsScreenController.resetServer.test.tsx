import * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderScreen } from '@/dev/testkit';
import { installServerSettingsHooksCommonModuleMocks } from './serverSettingsHooksTestHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const storageState: Record<string, unknown> = {
    serverSelectionGroups: [],
    serverSelectionActiveTargetKind: 'server',
    serverSelectionActiveTargetId: 'server-b',
};
const useSettingMutableMock = ((key: string) => [
    storageState[key],
    (value: unknown) => {
        storageState[key] = value;
    },
]) as typeof import('@/sync/domains/state/storage')['useSettingMutable'];

const modalConfirmMock = vi.fn(async () => true);
const setActiveServerIdMock = vi.fn();
let resetServerId = '';

installServerSettingsHooksCommonModuleMocks({
    modal: async () => {
        const { createModalModuleMock } = await import('@/dev/testkit/mocks/modal');
        return createModalModuleMock({ spies: { confirm: modalConfirmMock } }).module;
    },
    text: async () => {
        const { createTextModuleMock } = await import('@/dev/testkit/mocks/text');
        return createTextModuleMock({ translate: (key) => key });
    },
    storage: async () => {
        const { createStorageModuleStub } = await import('@/dev/testkit/mocks/storage');
        return createStorageModuleStub({ useSettingMutable: useSettingMutableMock });
    },
});

vi.mock('@/auth/context/AuthContext', () => ({
    useAuth: () => ({ refreshFromActiveServer: vi.fn(async () => {}) }),
}));

vi.mock('@/sync/runtime/orchestration/connectionManager', () => ({
    switchConnectionToActiveServer: vi.fn(async () => {}),
}));

vi.mock('@/sync/domains/server/serverProfiles', async (importOriginal) => {
    const { createServerProfilesModuleMock } = await import('@/dev/testkit/mocks/serverProfiles');
    return createServerProfilesModuleMock({
        importOriginal,
        overrides: {
            getActiveServerSnapshot: () => ({ serverId: 'server-b', serverUrl: 'https://server-b.example.test', generation: 1 }),
            subscribeActiveServer: () => () => {},
            listServerProfiles: () => [
                { id: 'server-a', name: 'A', serverUrl: 'https://a.example.test', createdAt: 1, updatedAt: 1, lastUsedAt: 0 },
                { id: 'server-b', name: 'B', serverUrl: 'https://b.example.test', createdAt: 1, updatedAt: 1, lastUsedAt: 0 },
            ],
            getActiveServerId: () => 'server-b',
            getDeviceDefaultServerId: () => 'server-b',
            getResetToDefaultServerId: () => resetServerId,
            setActiveServerId: setActiveServerIdMock,
        },
    });
});

vi.mock('@/sync/domains/server/serverConfig', () => ({
    validateServerUrl: () => ({ valid: true, error: null }),
}));

vi.mock('@/sync/domains/server/selection/serverSelectionMutations', () => ({
    normalizeStoredServerSelectionGroups: (raw: unknown) => (Array.isArray(raw) ? raw : []),
    filterServerSelectionGroupsToAvailableServers: (profiles: any) => profiles,
}));

vi.mock('@/components/settings/server/hooks/useServerAuthStatusByServerId', () => ({
    useServerAuthStatusByServerId: () => ({}),
}));

vi.mock('@/components/settings/server/hooks/useServerAutoAddFromRoute', () => ({
    useServerAutoAddFromRoute: () => {},
}));

vi.mock('@/components/settings/server/hooks/useServerSettingsServerProfileActions', () => ({
    useServerSettingsServerProfileActions: () => ({
        onSwitchServer: vi.fn(async () => {}),
        onRenameServer: vi.fn(async () => {}),
        onRemoveServer: vi.fn(async () => {}),
    }),
}));

vi.mock('@/components/settings/server/hooks/useServerSettingsGroupActions', () => ({
    useServerSettingsGroupActions: () => ({
        onSwitchGroup: vi.fn(async () => {}),
        onRenameGroup: vi.fn(async () => {}),
        onRemoveGroup: vi.fn(async () => {}),
        onCreateServerGroup: vi.fn(async () => false),
    }),
}));

vi.mock('@/components/settings/server/hooks/useServerSettingsConcurrentActions', () => ({
    useServerSettingsConcurrentActions: () => ({
        onTogglePresentation: vi.fn(),
        onToggleConcurrentServer: vi.fn(),
    }),
}));

async function renderController() {
    const { useServerSettingsScreenController } = await import('./useServerSettingsScreenController');
    let value: any = null;
    function Probe() {
        value = useServerSettingsScreenController();
        return null;
    }
    await renderScreen(React.createElement(Probe));
    return () => value;
}

describe('useServerSettingsScreenController reset to default', () => {
    beforeEach(() => {
        resetServerId = '';
        modalConfirmMock.mockClear();
        setActiveServerIdMock.mockClear();
    });

    it('offers no reset when no server is configured at runtime', async () => {
        const controller = await renderController();

        expect(controller().onResetServer).toBeNull();
    });

    it('resets to the runtime-configured server after confirmation', async () => {
        resetServerId = 'server-a';
        const controller = await renderController();

        await controller().onResetServer();

        expect(modalConfirmMock).toHaveBeenCalledTimes(1);
        expect(setActiveServerIdMock).toHaveBeenCalledWith('server-a', { scope: 'device' });
    });
});
