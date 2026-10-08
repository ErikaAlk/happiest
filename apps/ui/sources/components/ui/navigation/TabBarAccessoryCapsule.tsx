import * as React from 'react';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { GlassPanel } from '@/components/ui/glass/GlassPanel';
import { Icon } from '@/components/ui/icons/Icon';
import { PressableSurface } from '@/components/ui/interaction/PressableSurface';

import type { TabBarAccessory } from './tabBarModel';

/**
 * The capsule a `TabBarAccessory` is drawn in beside the floating tab bar — the iOS 26 shape, where
 * the search button is its own capsule next to the bar. `FloatingTabBarSurface` stretches it to the
 * bar's exact height, so this component only has to be square (`aspectRatio`) and let `GlassPanel`
 * paint the same material, rim and cast shadow as the bar.
 */

/** Matches the bar's capsule; both clamp to a full pill at any height. */
const CAPSULE_RADIUS = 999;

const styles = StyleSheet.create({
    capsule: {
        // Height comes from the row (stretch); `aspectRatio` turns it into a circle
        // rather than hardcoding a size the tab-bar size setting would drift from.
        // `alignSelf` rather than `flex: 1`: in the row this now sits in, a flex weight
        // would let the capsule GROW horizontally into the leftover space instead of
        // staying square at the far right.
        alignSelf: 'stretch',
        aspectRatio: 1,
    },
    press: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: CAPSULE_RADIUS,
    },
});

export const TabBarAccessoryCapsule = React.memo(function TabBarAccessoryCapsule(props: Readonly<{
    accessory: TabBarAccessory;
    iconSize: number;
}>) {
    const { theme } = useUnistyles();

    return (
        <GlassPanel radius={CAPSULE_RADIUS} style={styles.capsule}>
            <PressableSurface
                testID={props.accessory.testID}
                accessibilityRole="button"
                accessibilityLabel={props.accessory.accessibilityLabel}
                onPress={props.accessory.onPress}
                // Keep this capsule's hit area out of the neighbouring tab's expanded press area.
                focusRingRadius={CAPSULE_RADIUS}
                style={styles.press}
            >
                <Icon name={props.accessory.icon} size={props.iconSize} color={theme.colors.text.primary} />
            </PressableSurface>
        </GlassPanel>
    );
});
