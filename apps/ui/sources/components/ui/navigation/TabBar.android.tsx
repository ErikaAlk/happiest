import * as React from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { ColorOsSlot } from '@/components/ui/coloros/ColorOsSlot';
import { CoNavigationBarNative, type CoNavigationItem } from '@/components/ui/coloros/colorOsNativeViews';
import { useColorOsHostEnvironment } from '@/components/ui/coloros/useColorOsHostEnvironment';
import { Icon, type IconName, type IconWeight } from '@/components/ui/icons/Icon';
import { useSetting } from '@/sync/domains/state/storage';

import { resolveTabBarMetrics } from './tabBarMetrics';
import { useTabBarTabs, type TabBarProps } from './tabBarModel';

export type { TabBarAccessory, TabBarProps, TabType } from './tabBarModel';

function HostedIcon(props: Readonly<{ name: IconName; size: number; color: string; weight: IconWeight }>) {
    return (
        <ColorOsSlot>
            <Icon name={props.name} size={props.size} color={props.color} weight={props.weight} />
        </ColorOsSlot>
    );
}

/**
 * Android: the ColorOS floating navigation bar. It keeps itself clear of the system navigation bar,
 * shows the selected tab with the filled glyph, and draws the accessory as its end button.
 */
export const TabBar = React.memo(function TabBar({ activeTab, onTabPress, trailingAccessory }: TabBarProps) {
    const environment = useColorOsHostEnvironment();
    const { theme } = useUnistyles();
    const tabs = useTabBarTabs();
    const size = useSetting('tabBarSize');
    const showLabels = useSetting('tabBarShowLabels');
    const { iconSize } = resolveTabBarMetrics(size, showLabels);

    const items = React.useMemo(() => tabs.map((tab): CoNavigationItem => ({
        label: tab.label,
        enabled: true,
        badgeCount: tab.badge?.kind === 'count' ? tab.badge.value : undefined,
        badgeDot: tab.badge?.kind === 'dot',
    })), [tabs]);
    const handleSelect = React.useCallback((event: NativeSyntheticEvent<{ index: number }>) => {
        onTabPress(tabs[event.nativeEvent.index]!.key);
    }, [onTabPress, tabs]);
    // The bar raises this event only while it draws the end button, which it does only for an accessory.
    const handleEndAccessory = React.useCallback(() => {
        trailingAccessory!.onPress();
    }, [trailingAccessory]);

    return (
        <CoNavigationBarNative
            {...environment}
            items={items}
            selectedIndex={tabs.findIndex((tab) => tab.key === activeTab)}
            showLabels={showLabels}
            size={size}
            endAccessoryDescription={trailingAccessory?.accessibilityLabel}
            onItemSelect={handleSelect}
            onEndAccessory={handleEndAccessory}
        >
            {tabs.flatMap((tab) => [
                <HostedIcon key={`${tab.key}-outline`} name={tab.icon} size={iconSize} color={theme.colors.text.primary} weight="regular" />,
                <HostedIcon key={`${tab.key}-filled`} name={tab.icon} size={iconSize} color={theme.colors.text.primary} weight="fill" />,
            ])}
            {trailingAccessory ? (
                <HostedIcon name={trailingAccessory.icon} size={iconSize} color={theme.colors.text.primary} weight="regular" />
            ) : null}
        </CoNavigationBarNative>
    );
});
