import * as React from 'react';
import type { AccessibilityProps, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from '@/components/ui/text/Text';

export type MeterTone = 'success' | 'warning' | 'danger' | 'neutral';

/**
 * The MeterBar contract shared by `MeterBar.tsx` (iOS, web, desktop) and `MeterBar.android.tsx`
 * (the ColorOS UI kit progress bar, drawn natively).
 */
export interface MeterBarProps {
    tone: MeterTone;
    /**
     * Fill fraction in 0..1 (clamped). Canonical semantic: fill = consumed / progress — the bar
     * GROWS as work happens (tokens consumed, agents completed). Pass the progress ratio directly;
     * do not invert it.
     */
    fillFraction: number;
    caption?: React.ReactNode;
    /** Track height in px (default 6; the ColorOS bar defaults to COUI's height). */
    height?: number;
    /** Web and desktop only: the ColorOS bar keeps COUI's track colour. */
    trackColor?: string;
    /**
     * When the bar reports progress (not a capacity), its accessible name. The bar then exposes
     * `progressbar` semantics with the fill as a 0–100 value.
     */
    progressAccessibilityLabel?: string;
    testID?: string;
    style?: StyleProp<ViewStyle>;
}

export function clampMeterFill(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
}

export function meterBarAccessibilityProps(label: string | undefined, fill: number): AccessibilityProps | null {
    if (!label) return null;
    return {
        accessible: true,
        accessibilityRole: 'progressbar',
        accessibilityLabel: label,
        accessibilityValue: { min: 0, max: 100, now: Math.round(fill * 100) },
    };
}

const styles = StyleSheet.create((theme) => ({
    caption: {
        color: theme.colors.text.secondary,
        marginTop: 4,
        fontSize: 12,
        lineHeight: 16,
    },
}));

export function MeterBarCaption(props: Readonly<{ caption: React.ReactNode; testID?: string }>): React.ReactNode {
    if (typeof props.caption === 'string' || typeof props.caption === 'number') {
        return (
            <Text testID={props.testID ? `${props.testID}:caption` : undefined} style={styles.caption}>
                {props.caption}
            </Text>
        );
    }
    return props.caption;
}
