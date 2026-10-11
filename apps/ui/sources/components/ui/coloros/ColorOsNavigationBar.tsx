import * as React from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useSetting } from '@/sync/domains/state/storage';
import { resolveTabBarMetrics } from '@/components/ui/navigation/tabBarMetrics';
import { Icon } from '@/components/ui/icons/Icon';
import type { TabBarAccessory } from '@/components/ui/navigation/tabBarModel';
import { ColorOsSlot } from './ColorOsSlot';
import { CoNavigationBarNative, type CoNavigationItem } from './colorOsNativeViews';
import { useColorOsHostEnvironment } from './useColorOsHostEnvironment';

export type ColorOsNavigationTab<T extends string> = CoNavigationItem & Readonly<{
    id: T;
    renderIcon: (options: Readonly<{ size: number; tintColor: string; active: boolean }>) => React.ReactNode;
}>;

export function ColorOsNavigationBar<T extends string>(props: Readonly<{
    tabs: readonly ColorOsNavigationTab<T>[];
    activeTab: T;
    onTabPress: (tab: T) => void;
    trailingAccessory?: TabBarAccessory;
    reserveAccessorySpace?: boolean;
    testID?: string;
    accessibilityActions?: ReadonlyArray<Readonly<{ name: string; label: string }>>;
    onAccessibilityAction?: (actionName: string) => void;
}>) {
    const environment = useColorOsHostEnvironment();
    const { theme } = useUnistyles();
    const size = useSetting('tabBarSize');
    const showLabels = useSetting('tabBarShowLabels');
    const { iconSize } = resolveTabBarMetrics(size, showLabels);
    const items = React.useMemo(() => props.tabs.map(({ renderIcon, id, ...item }) => item), [props.tabs]);
    const handleSelect = React.useCallback((event: NativeSyntheticEvent<{ index: number }>) => {
        props.onTabPress(props.tabs[event.nativeEvent.index]!.id);
    }, [props.onTabPress, props.tabs]);
    const handleAccessory = React.useCallback(() => props.trailingAccessory!.onPress(), [props.trailingAccessory]);
    const handleAccessibilityAction = React.useCallback((event: NativeSyntheticEvent<{ actionName: string }>) => {
        props.onAccessibilityAction?.(event.nativeEvent.actionName);
    }, [props.onAccessibilityAction]);

    return (
        <CoNavigationBarNative {...environment} testID={props.testID} items={items}
            selectedIndex={props.tabs.findIndex(tab => tab.id === props.activeTab)} showLabels={showLabels} size={size}
            reserveAccessorySpace={props.reserveAccessorySpace === true}
            endAccessoryDescription={props.trailingAccessory?.accessibilityLabel} onItemSelect={handleSelect}
            onEndAccessory={handleAccessory} accessibilityActions={props.accessibilityActions}
            onAccessibilityAction={handleAccessibilityAction}>
            {props.tabs.flatMap(tab => [false, true].map(active => (
                <ColorOsSlot key={`${tab.id}-${active}`}>
                    {tab.renderIcon({ size: iconSize, tintColor: theme.colors.text.primary, active })}
                </ColorOsSlot>
            )))}
            {props.trailingAccessory ? (
                <ColorOsSlot><Icon name={props.trailingAccessory.icon} size={iconSize} color={theme.colors.text.primary} /></ColorOsSlot>
            ) : null}
        </CoNavigationBarNative>
    );
}
