import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installNavigationCommonModuleMocks } from '@/components/ui/navigation/navigationTestHelpers';
import { renderScreen, resetBrowserSessionDraftPersistenceForTest, standardCleanup } from '@/dev/testkit';
import { createExpoRouterMock } from '@/dev/testkit/mocks/router';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const ordinaryEntryScope = {
    serverId: 'tabbar-ordinary-entry-server',
    accountId: 'tabbar-ordinary-entry-account',
} as const;
const ordinaryEntryDraftId = '00000000-0000-4000-8000-000000000701';

installNavigationCommonModuleMocks({
    reactNative: async () => {
        const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
        return createReactNativeWebMock({
            View: ({ children, ...props }: any) => React.createElement('View', props, children),
            Pressable: ({ children, ...props }: any) => React.createElement('Pressable', props, children),
        });
    },
    storage: async (importOriginal) => {
        const actual = await importOriginal<typeof import('@/sync/domains/state/storage')>();
        return {
            ...actual,
            useSetting: ((key: string) => {
                if (key === 'newSessionDraftEntryMode') return 'resumePrevious';
                return undefined;
            }) as typeof import('@/sync/domains/state/storage').useSetting,
            useActiveServerAccountScope: () => ordinaryEntryScope,
        };
    },
});

const expoRouterMock = createExpoRouterMock();

vi.mock('expo-router', () => expoRouterMock.module);

vi.mock('react-native-reanimated', async () => {
    const { createReanimatedModuleMock } = await import('@/dev/testkit/mocks/reanimated');
    return createReanimatedModuleMock();
});

vi.mock('expo-blur', () => ({
    BlurView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
        React.createElement('BlurView', props, children),
}));

// Keep the production module load outside each test's timeout while retaining the installed mocks.
await Promise.all([
    import('@/sync/ops/sessionDrafts/sessionDraftRepository'),
    import('./useNewSessionTabBarAccessory'),
    import('@/components/ui/navigation/TabBarAccessoryCapsule'),
    import('@/keyboard/runtime'),
]);

/** The accessory as the tab bar draws it on iOS, web and desktop. */
async function renderNewSessionAccessory() {
    const { useNewSessionTabBarAccessory } = await import('./useNewSessionTabBarAccessory');
    const { TabBarAccessoryCapsule } = await import('@/components/ui/navigation/TabBarAccessoryCapsule');
    function NewSessionAccessory() {
        return <TabBarAccessoryCapsule accessory={useNewSessionTabBarAccessory()} iconSize={24} />;
    }
    return await renderScreen(<NewSessionAccessory />);
}

describe('useNewSessionTabBarAccessory', () => {
    beforeEach(async () => {
        await resetBrowserSessionDraftPersistenceForTest();
    });

    afterEach(() => {
        standardCleanup();
        expoRouterMock.spies.push.mockReset();
    });

    it('resumes the origin-owned ordinary-entry draft with explicit route params', async () => {
        const { setOrdinaryEntryDraftId, writeNewSessionDraft } = await import('@/sync/ops/sessionDrafts/sessionDraftRepository');
        writeNewSessionDraft({
            scope: ordinaryEntryScope,
            draftId: ordinaryEntryDraftId,
            patch: { text: 'Resume this draft' },
            materializationIntent: 'userEdit',
        });
        expect(setOrdinaryEntryDraftId(ordinaryEntryScope, ordinaryEntryDraftId)).toBe(true);

        const screen = await renderNewSessionAccessory();
        screen.pressByTestId('tabbar-start-new-session');

        expect(expoRouterMock.spies.push).toHaveBeenCalledWith({
            pathname: '/new',
            params: {
                draftId: ordinaryEntryDraftId,
                draftOrigin: 'ordinary',
            },
        });
    });

    it('forces a fresh ordinary-entry identity on the platform modifier-click', async () => {
        const { setOrdinaryEntryDraftId, writeNewSessionDraft } = await import('@/sync/ops/sessionDrafts/sessionDraftRepository');
        writeNewSessionDraft({
            scope: ordinaryEntryScope,
            draftId: ordinaryEntryDraftId,
            patch: { text: 'Keep this saved draft' },
            materializationIntent: 'userEdit',
        });
        expect(setOrdinaryEntryDraftId(ordinaryEntryScope, ordinaryEntryDraftId)).toBe(true);
        const { resolveKeyboardPlatform } = await import('@/keyboard/runtime');

        const screen = await renderNewSessionAccessory();
        const platform = resolveKeyboardPlatform();
        screen.findByTestId('tabbar-start-new-session')?.props.onPress({
            nativeEvent: platform === 'macos' ? { metaKey: true } : { ctrlKey: true },
        });

        expect(expoRouterMock.spies.push).toHaveBeenCalledWith({
            pathname: '/new',
            params: {
                draftId: expect.not.stringMatching(ordinaryEntryDraftId),
                draftOrigin: 'ordinary',
            },
        });
    });

    it('exposes the new-session action to assistive technology', async () => {
        const screen = await renderNewSessionAccessory();
        const button = screen.findByTestId('tabbar-start-new-session');

        expect(button?.props.accessibilityRole).toBe('button');
        expect(button?.props.accessibilityLabel).toBe('newSession.title');
    });
});
