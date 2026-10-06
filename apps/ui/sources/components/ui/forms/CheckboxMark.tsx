import * as React from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/ui/icons/Icon';
import { motionTokens } from '@/components/ui/motion/motionTokens';
import { useReducedMotionPreference } from '@/hooks/ui/useReducedMotionPreference';

import type { CheckboxMarkProps } from './CheckboxMark.types';

export type { CheckboxMarkProps } from './CheckboxMark.types';

const RING_SIZE = 18;
const RING_BORDER_WIDTH = 2;
// The checked fill covers exactly the ring's inner circle, so checking reads as the ring filling in.
const RING_FILL_SIZE = RING_SIZE - RING_BORDER_WIDTH * 2;

const styles = StyleSheet.create((theme) => ({
    chip: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 32,
        minWidth: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.surface.base,
    },
    chipChecked: {
        backgroundColor: theme.colors.state.active.background,
    },
    chipPressed: {
        backgroundColor: theme.colors.state.neutral.background,
    },
    ring: {
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        borderWidth: RING_BORDER_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background.canvas,
    },
    ringUnchecked: {
        borderColor: theme.colors.border.default,
        opacity: 0.86,
    },
    ringChecked: {
        borderColor: 'transparent',
        opacity: 1,
    },
    ringFill: {
        width: RING_FILL_SIZE,
        height: RING_FILL_SIZE,
        borderRadius: RING_FILL_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.state.active.foreground,
    },
}));

export function CheckboxMark(props: CheckboxMarkProps): React.ReactElement {
    const { theme } = useUnistyles();
    const reducedMotion = useReducedMotionPreference();

    if (props.appearance === 'chip') {
        return (
            <View
                testID={props.testID}
                style={[styles.chip, props.checked ? styles.chipChecked : null, props.pressed ? styles.chipPressed : null]}
            >
                <Icon
                    name={props.checked ? 'check-square' : 'square'}
                    size={16}
                    color={props.checked ? theme.colors.state.active.foreground : theme.colors.text.secondary}
                />
            </View>
        );
    }

    const transitionStyle = Platform.OS === 'web'
        ? {
            transitionProperty: 'background-color, border-color, opacity, transform',
            transitionDuration: `${reducedMotion ? motionTokens.durationMs.instant : motionTokens.durationMs.fast}ms`,
        } as unknown as ViewStyle
        : null;

    return (
        <View testID={props.testID} style={[styles.ring, props.checked ? styles.ringChecked : styles.ringUnchecked, transitionStyle]}>
            {props.checked ? (
                <View testID={props.testID === undefined ? undefined : `${props.testID}-fill`} style={styles.ringFill}>
                    <Icon name="check" size={10} color={theme.colors.overlay.foreground} />
                </View>
            ) : null}
        </View>
    );
}
