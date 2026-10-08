import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installNavigationCommonModuleMocks } from './navigationTestHelpers';
import { renderScreen } from '@/dev/testkit';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const tabState = vi.hoisted(() => ({
    friendRequestCount: 0,
    inboxHasContent: false,
}));

installNavigationCommonModuleMocks({
    reactNative: async () => {
        const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
        return createReactNativeWebMock({
            Platform: { OS: 'android', select: (options: any) => options.android ?? options.default },
            View: ({ children, ...props }: any) => React.createElement('View', props, children),
        });
    },
    storage: async (importOriginal) => {
        const actual = await importOriginal<typeof import('@/sync/domains/state/storage')>();
        return {
            ...actual,
            useFriendRequestCount: (() => tabState.friendRequestCount) as typeof import('@/sync/domains/state/storage').useFriendRequestCount,
            useSetting: ((key: string) => {
                if (key === 'tabBarFriendsBadgeEnabled') return true;
                if (key === 'tabBarInboxBadgeEnabled') return true;
                if (key === 'tabBarShowLabels') return false;
                if (key === 'tabBarSize') return 'large';
                return undefined;
            }) as typeof import('@/sync/domains/state/storage').useSetting,
        };
    },
});

// The Expo native views are the system boundary: the ColorOS navigation bar reports the pressed
// item by index and the end accessory by its own event.
vi.mock('@/components/ui/coloros/colorOsNativeViews', () => ({
    CoNavigationBarNative: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
        React.createElement('CoNavigationBarNative', props, children),
}));

vi.mock('@expo/ui/jetpack-compose', () => ({
    RNHostView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
        React.createElement('RNHostView', props, children),
}));

vi.mock('@/components/ui/coloros/useColorOsHostEnvironment', () => ({
    useColorOsHostEnvironment: () => ({ dark: false, fontScale: 1, reduceMotion: false }),
}));

vi.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@/hooks/inbox/useInboxHasContent', () => ({
    useInboxHasContent: () => tabState.inboxHasContent,
}));

vi.mock('@/hooks/inbox/useInboxAvailable', () => ({
    useInboxAvailable: () => true,
}));

vi.mock('@/hooks/server/useFriendsEnabled', () => ({
    useFriendsEnabled: () => true,
}));

// Metro resolves `./TabBar` to the `.android` file on Android.
vi.mock('./TabBar', async () => await import('./TabBar.android'));

async function renderBar(props: Partial<React.ComponentProps<typeof import('./TabBar.android').TabBar>> = {}) {
    const { TabBar } = await import('./TabBar');
    const onTabPress = vi.fn();
    const screen = await renderScreen(<TabBar activeTab="friends" onTabPress={onTabPress} {...props} />);
    const bar = screen.tree.findByType('CoNavigationBarNative' as never);
    return { bar, onTabPress };
}

describe('TabBar on Android', () => {
    beforeEach(() => {
        tabState.friendRequestCount = 0;
        tabState.inboxHasContent = false;
    });

    it('hands the ColorOS bar the tabs in order with their badges and the selected tab', async () => {
        tabState.friendRequestCount = 3;
        tabState.inboxHasContent = true;

        const { bar } = await renderBar();

        expect(bar.props.items).toEqual([
            { label: 'tabs.inbox', enabled: true, badgeCount: undefined, badgeDot: true },
            { label: 'tabs.sessions', enabled: true, badgeCount: undefined, badgeDot: false },
            { label: 'tabs.friends', enabled: true, badgeCount: 3, badgeDot: false },
            { label: 'tabs.settings', enabled: true, badgeCount: undefined, badgeDot: false },
        ]);
        expect(bar.props.selectedIndex).toBe(2);
        expect(bar.props.showLabels).toBe(false);
        expect(bar.props.size).toBe('large');
    });

    it('turns a pressed item back into its tab, including the tab already shown', async () => {
        const { bar, onTabPress } = await renderBar();

        bar.props.onItemSelect({ nativeEvent: { index: 3 } });
        bar.props.onItemSelect({ nativeEvent: { index: 2 } });

        expect(onTabPress.mock.calls).toEqual([['settings'], ['friends']]);
    });

    it('offers the accessory as the bar\'s end button', async () => {
        const onPress = vi.fn();
        const { bar } = await renderBar({
            trailingAccessory: { testID: 'accessory', accessibilityLabel: 'newSession.title', icon: 'plus', onPress },
        });

        expect(bar.props.endAccessoryDescription).toBe('newSession.title');
        bar.props.onEndAccessory({ nativeEvent: {} });
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('draws no end button without an accessory', async () => {
        const { bar } = await renderBar();

        expect(bar.props.endAccessoryDescription).toBeUndefined();
    });
});
