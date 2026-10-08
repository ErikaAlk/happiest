import * as React from 'react';

import { useColorOsHostEnvironment } from '@/components/ui/coloros/useColorOsHostEnvironment';
import { CoRedDotNative } from '@/components/ui/coloros/colorOsNativeViews';

import { ComposedTabBadge, tabBadgeAnchorStyles, type TabBadgeProps } from './TabBadgeComposed';

export type { TabBadgeCountTone, TabBadgeProps } from './TabBadgeComposed';

/**
 * Android: the dot and alert counts are the ColorOS UI kit red dot (COUI size and count formatting);
 * neutral counts and git diff chips stay app-composed tags.
 */
export function TabBadge(props: TabBadgeProps): React.ReactElement {
    const environment = useColorOsHostEnvironment();

    if (props.variant === 'dot') {
        return <CoRedDotNative {...environment} testID={props.testID} style={[tabBadgeAnchorStyles.dot, props.style]} />;
    }

    if (props.variant === 'count' && props.tone !== 'neutral') {
        return (
            <CoRedDotNative
                {...environment}
                count={props.value}
                testID={props.testID}
                style={[tabBadgeAnchorStyles.count, props.size === 'compact' ? tabBadgeAnchorStyles.countCompact : null, props.style]}
            />
        );
    }

    return <ComposedTabBadge {...props} />;
}
