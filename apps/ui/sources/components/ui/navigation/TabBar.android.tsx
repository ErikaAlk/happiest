import * as React from 'react';
import { ColorOsNavigationBar, type ColorOsNavigationTab } from '@/components/ui/coloros/ColorOsNavigationBar';
import { Icon } from '@/components/ui/icons/Icon';
import { useTabBarTabs, type TabBarProps, type TabType } from './tabBarModel';

export type { TabBarAccessory, TabBarProps, TabType } from './tabBarModel';

/**
 * Android: the ColorOS floating navigation bar. It keeps itself clear of the system navigation bar,
 * shows the selected tab with the filled glyph, and draws the accessory as its end button.
 */
export const TabBar = React.memo(function TabBar({ activeTab, onTabPress, trailingAccessory }: TabBarProps) {
    const definitions = useTabBarTabs();
    const tabs = React.useMemo(() => definitions.map((tab): ColorOsNavigationTab<TabType> => ({
        id: tab.key,
        label: tab.label,
        enabled: true,
        badgeCount: tab.badge?.kind === 'count' ? tab.badge.value : undefined,
        badgeDot: tab.badge?.kind === 'dot',
        renderIcon: ({ size, tintColor, active }) => (
            <Icon name={tab.icon} size={size} color={tintColor} weight={active ? 'fill' : 'regular'} />
        ),
    })), [definitions]);

    return (
        <ColorOsNavigationBar tabs={tabs} activeTab={activeTab} onTabPress={onTabPress} trailingAccessory={trailingAccessory} reserveAccessorySpace />
    );
});
