import * as React from 'react';

import type { IconName } from '@/components/ui/icons/Icon';
import { useInboxAvailable } from '@/hooks/inbox/useInboxAvailable';
import { useInboxHasContent } from '@/hooks/inbox/useInboxHasContent';
import { useFriendsEnabled } from '@/hooks/server/useFriendsEnabled';
import { useFriendRequestCount, useSetting } from '@/sync/domains/state/storage';
import { t } from '@/text';

import { resolveTabBarTabs } from './resolveTabBarTabs';
import type { TabType } from './tabTypes';

export type { TabType };

/**
 * An action offered beside the bar, drawn as its own capsule. It is deliberately not a tab: the bar
 * stays a pure navigation control, it never takes the active-tab highlight, and the caller owns which
 * surfaces offer the action.
 */
export type TabBarAccessory = Readonly<{
    testID: string;
    accessibilityLabel: string;
    icon: IconName;
    /** Receives the press event where the platform has one (web and desktop read its modifier keys). */
    onPress: (event?: unknown) => void;
}>;

/** Shared by `TabBar.tsx` (iOS, web, desktop) and `TabBar.android.tsx` (the ColorOS floating navigation bar). */
export type TabBarProps = Readonly<{
    activeTab: TabType;
    onTabPress: (tab: TabType) => void;
    trailingAccessory?: TabBarAccessory;
}>;

export type TabBarBadge = Readonly<{ kind: 'dot' }> | Readonly<{ kind: 'count'; value: number }>;

export type TabBarTab = Readonly<{
    key: TabType;
    label: string;
    icon: IconName;
    badge: TabBarBadge | null;
}>;

// Match the app's cockpit-bar line icons (all Phosphor, same weight):
// mailbox for Inbox, chat for Sessions, sliders for Settings, people for Friends.
const TAB_ICONS: Record<TabType, IconName> = {
    inbox: 'mailbox',
    sessions: 'chats-circle',
    friends: 'users',
    settings: 'sliders-horizontal',
};

function tabLabel(key: TabType): string {
    switch (key) {
        case 'inbox':
            return t('tabs.inbox');
        case 'friends':
            return t('tabs.friends');
        case 'settings':
            return t('tabs.settings');
        case 'sessions':
            return t('tabs.sessions');
    }
}

/** The main tabs in bar order, each with the badge its settings allow. */
export function useTabBarTabs(): ReadonlyArray<TabBarTab> {
    const friendsEnabled = useFriendsEnabled();
    const friendRequestCount = useFriendRequestCount();
    const inboxEnabled = useInboxAvailable();
    const inboxHasContent = useInboxHasContent();
    const friendsBadgeEnabled = useSetting('tabBarFriendsBadgeEnabled');
    const inboxBadgeEnabled = useSetting('tabBarInboxBadgeEnabled');
    const friendsBadgeCount = friendsBadgeEnabled && friendRequestCount > 0 ? friendRequestCount : 0;
    const inboxDot = inboxBadgeEnabled && inboxHasContent;

    return React.useMemo(() => resolveTabBarTabs({ inboxEnabled, friendsEnabled }).map((key): TabBarTab => ({
        key,
        label: tabLabel(key),
        icon: TAB_ICONS[key],
        badge: key === 'friends' && friendsBadgeCount > 0
            ? { kind: 'count', value: friendsBadgeCount }
            : key === 'inbox' && inboxDot
                ? { kind: 'dot' }
                : null,
    })), [friendsBadgeCount, friendsEnabled, inboxDot, inboxEnabled]);
}
