import * as React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { ColorOsNavigationBar, type ColorOsNavigationTab } from '@/components/ui/coloros/ColorOsNavigationBar';
import { Icon } from '@/components/ui/icons/Icon';
import { TabBadge } from '@/components/ui/navigation/tabBadge/TabBadge';
import { resolveSessionLateralSwipeTabRowOpacity } from '../lateralSwipe/sessionLateralSwipeMotion';
import type { CockpitTabBarProps } from './CockpitTabBar';

export type { CockpitTabBadge, CockpitTabBarTabDefinition } from './CockpitTabBar';

export function CockpitTabBar<TSurface extends string>(props: CockpitTabBarProps<TSurface>) {
    const idleProgress = useSharedValue(0);
    const idleBrowseProgress = useSharedValue(0);
    const progress = props.swipeReadout?.progress ?? idleProgress;
    const browseProgress = props.swipeReadout?.browseProgress ?? idleBrowseProgress;
    const rowStyle = useAnimatedStyle(() => ({
        opacity: resolveSessionLateralSwipeTabRowOpacity(progress.value, browseProgress.value),
    }), [progress, browseProgress]);
    const tabs = React.useMemo(() => props.tabs.map((tab): ColorOsNavigationTab<TSurface> => ({
        id: tab.id, label: tab.label, enabled: true, testID: `${props.tabTestIdPrefix}${tab.id}`,
        badgeCount: tab.badge?.kind === 'count' ? tab.badge.value : undefined,
        badgeDot: false,
        renderIcon: options => (
            <View style={{ width: options.size, height: options.size }}>
                {typeof tab.icon === 'string'
                    ? <Icon name={tab.icon} size={options.size} color={options.tintColor} weight={options.active ? 'fill' : 'regular'} />
                    : tab.icon.render(options)}
                {tab.badge?.kind === 'diff' ? (
                    <TabBadge variant="diff" added={tab.badge.added} removed={tab.badge.removed}
                        modifiedCount={tab.badge.modifiedCount} testID={`${props.tabTestIdPrefix}${tab.id}-badge`} />
                ) : null}
            </View>
        ),
    })), [props.tabs, props.tabTestIdPrefix]);

    return (
        <View>
            <Animated.View style={rowStyle}>
                <ColorOsNavigationBar tabs={tabs} activeTab={props.activeSurface} onTabPress={props.onSurfacePress}
                    testID={props.barTestId} accessibilityActions={props.bandAccessibilityActions}
                    onAccessibilityAction={props.onBandAccessibilityAction} />
            </Animated.View>
            {props.swipeReadout?.node ?? null}
        </View>
    );
}
