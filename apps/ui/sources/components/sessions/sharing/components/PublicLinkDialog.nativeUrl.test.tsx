import React from 'react';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderScreen } from '@/dev/testkit';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
};

const clipboardMocks = vi.hoisted(() => ({
    setStringAsync: vi.fn(async (_text: string) => {}),
}));

vi.mock('expo-clipboard', () => clipboardMocks);

vi.mock('react-native', async () => {
    const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
    return createReactNativeWebMock({
        Platform: {
            OS: 'ios',
            select: (options: Record<string, unknown>) => options?.ios ?? options?.default,
        },
        Linking: {
            openURL: vi.fn(async () => undefined),
        },
    });
});

vi.mock('react-native-unistyles', async () => {
    const { createUnistylesMock } = await import('@/dev/testkit/mocks/unistyles');
    return createUnistylesMock();
});

vi.mock('@expo/vector-icons', async () => {
    const { createExpoVectorIconsMock } = await import('@/dev/testkit/mocks/icons');
    return createExpoVectorIconsMock();
});

vi.mock('@/text', async () => {
    const { createTextModuleMock } = await import('@/dev/testkit/mocks/text');
    return createTextModuleMock({ translate: (key: string) => key });
});

vi.mock('@/modal', async () => {
    const { createModalModuleMock } = await import('@/dev/testkit/mocks/modal');
    return createModalModuleMock().module;
});

vi.mock('@/sync/domains/server/serverProfiles', async (importOriginal) => {
    const { createServerProfilesModuleMock } = await import('@/dev/testkit/mocks/serverProfiles');
    return createServerProfilesModuleMock({
        importOriginal,
        overrides: {
            getActiveServerSnapshot: () => ({
                serverId: 'relay-1',
                serverUrl: 'https://relay.example.test/api',
                generation: 1,
            }),
            subscribeActiveServer: () => () => {},
        },
    });
});

vi.mock('@/components/qr', () => ({
    QRCode: (props: Record<string, unknown>) => React.createElement('QRCode', props),
}));

vi.mock('@/components/ui/buttons/RoundButton', () => ({
    RoundButton: (props: Record<string, unknown>) => React.createElement('RoundButton', props),
}));

vi.mock('@/components/ui/lists/ItemGroup', () => ({
    ItemGroup: ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) =>
        React.createElement('ItemGroup', { title }, children),
}));

vi.mock('@/components/ui/lists/Item', () => ({
    Item: (props: Record<string, unknown>) => React.createElement('Item', props),
}));

vi.mock('@/components/ui/text/Text', () => ({
    Text: (props: Record<string, unknown> & { children?: React.ReactNode }) =>
        React.createElement('Text', props, props.children),
}));

async function copyPublicLink(): Promise<string | undefined> {
    clipboardMocks.setStringAsync.mockClear();
    const { PublicLinkDialog } = await import('./PublicLinkDialog');
    const screen = await renderScreen(
        <PublicLinkDialog
            publicShare={{
                id: 'share-1',
                sessionId: 'session-1',
                token: 'public-token',
                expiresAt: null,
                maxUses: null,
                useCount: 0,
                isConsentRequired: true,
                createdAt: 0,
                updatedAt: 0,
            }}
            onCreate={vi.fn()}
            onDelete={vi.fn()}
            onClose={vi.fn()}
            setChrome={vi.fn()}
        />,
    );
    const copyItem = screen.findAllByType('Item' as any)
        .find((node: any) => node.props.title === 'common.copy');
    await act(async () => {
        await copyItem?.props.onPress();
    });
    return clipboardMocks.setStringAsync.mock.calls[0]?.[0] as string | undefined;
}

describe('PublicLinkDialog public link on native', () => {
    const previousWebAppUrl = process.env.EXPO_PUBLIC_HAPPY_WEBAPP_URL;

    afterEach(() => {
        if (previousWebAppUrl === undefined) delete process.env.EXPO_PUBLIC_HAPPY_WEBAPP_URL;
        else process.env.EXPO_PUBLIC_HAPPY_WEBAPP_URL = previousWebAppUrl;
    });

    it('builds the link from the web app address of the active server', async () => {
        delete process.env.EXPO_PUBLIC_HAPPY_WEBAPP_URL;

        expect(await copyPublicLink()).toBe('https://relay.example.test/share/public-token');
    });

    it('prefers the configured web app address', async () => {
        process.env.EXPO_PUBLIC_HAPPY_WEBAPP_URL = 'https://app.example.test';

        expect(await copyPublicLink()).toBe('https://app.example.test/share/public-token');
    });
});
