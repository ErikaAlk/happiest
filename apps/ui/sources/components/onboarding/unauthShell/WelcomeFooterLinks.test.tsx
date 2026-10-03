import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderScreen } from '@/dev/testkit';

import { WelcomeFooterLinks } from './WelcomeFooterLinks';

const activeServer = vi.hoisted(() => ({ serverUrl: '' }));

vi.mock('react-native-unistyles', async () => {
    const { createUnistylesMock } = await import('@/dev/testkit/mocks/unistyles');
    return createUnistylesMock();
});

vi.mock('react-native', async () => {
    const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
    return createReactNativeWebMock({
        // The footer's relay link renders its content through Pressable's function children.
        Pressable: ({ children, ...props }: { children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode) }) =>
            React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children),
    });
});

vi.mock('@/sync/domains/server/serverProfiles', async (importOriginal) => {
    const { createServerProfilesModuleMock } = await import('@/dev/testkit/mocks/serverProfiles');
    return createServerProfilesModuleMock({
        importOriginal,
        overrides: {
            getActiveServerSnapshot: () => ({
                serverId: activeServer.serverUrl ? 'relay-1' : '',
                serverUrl: activeServer.serverUrl,
                generation: 1,
            }),
            subscribeActiveServer: () => () => {},
        },
    });
});

async function renderFooter() {
    return await renderScreen(
        <WelcomeFooterLinks variant="desktop" onOpenRelayCustomFlow={() => {}} />,
    );
}

describe('WelcomeFooterLinks relay entry', () => {
    it('shows the host of the configured relay with an edit affordance', async () => {
        activeServer.serverUrl = 'https://relay.example.test:8443';

        const screen = await renderFooter();

        expect(screen.findByTestId('welcome-footer-relay-host')).not.toBeNull();
        expect(screen.getTextContent()).toContain('relay.example.test:8443');
    });

    it('offers the plain add-relay link while no relay is configured', async () => {
        activeServer.serverUrl = '';

        const screen = await renderFooter();

        expect(screen.findByTestId('welcome-footer-relay-action')).not.toBeNull();
        expect(screen.findByTestId('welcome-footer-relay-host')).toBeNull();
    });
});
