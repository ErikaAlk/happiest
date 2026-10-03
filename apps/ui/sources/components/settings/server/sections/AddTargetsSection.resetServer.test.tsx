import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderScreen } from '@/dev/testkit';
import { installSettingsViewCommonModuleMocks } from '../../settingsViewTestHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

installSettingsViewCommonModuleMocks({
    reactNative: async () => {
        const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
        return createReactNativeWebMock({ Platform: { OS: 'ios' } });
    },
    text: async () => {
        const { createTextModuleMock } = await import('@/dev/testkit/mocks/text');
        return createTextModuleMock({ translate: (key) => key });
    },
    unistyles: async () => {
        const { createUnistylesMock } = await import('@/dev/testkit/mocks/unistyles');
        return createUnistylesMock({ theme: { colors: { textSecondary: '#999999' } } });
    },
});

vi.mock('@/components/ui/lists/ItemGroup', () => ({
    ItemGroup: ({ children, title }: any) => React.createElement('ItemGroup', { title }, children),
}));

vi.mock('@/components/ui/lists/Item', () => ({
    Item: (props: any) => React.createElement('Item', props),
}));

vi.mock('@/components/ui/buttons/RoundButton', () => ({
    RoundButton: (props: any) => React.createElement('RoundButton', props),
}));

async function renderAddTargetsSection(onResetServer: (() => void) | null) {
    const { AddTargetsSection } = await import('./AddTargetsSection');
    return await renderScreen(React.createElement(AddTargetsSection, {
        autoMode: false,
        inputUrl: '',
        inputName: '',
        error: null,
        isValidating: false,
        onChangeUrl: vi.fn(),
        onChangeName: vi.fn(),
        onResetServer,
        onAddServer: vi.fn(),
        defaultExpanded: 'server',
        servers: [],
        activeServerId: '',
        onCreateServerGroup: vi.fn(async () => false),
    }));
}

describe('AddTargetsSection reset to default', () => {
    it('shows only the add action when no server is configured at runtime', async () => {
        const screen = await renderAddTargetsSection(null);

        expect(screen.findByTestId('server-settings-add-confirm')).not.toBeNull();
        expect(screen.findByTestId('server-settings-add-reset')).toBeNull();
    });

    it('shows the reset action when a server is configured at runtime', async () => {
        const screen = await renderAddTargetsSection(vi.fn());

        expect(screen.findByTestId('server-settings-add-confirm')).not.toBeNull();
        expect(screen.findByTestId('server-settings-add-reset')).not.toBeNull();
    });
});
