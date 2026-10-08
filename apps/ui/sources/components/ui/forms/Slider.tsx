import * as React from 'react';
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { SliderProps } from './Slider.types';

export type { SliderProps } from './Slider.types';

function readLocationX(event: GestureResponderEvent): number | null {
    const locationX = event.nativeEvent.locationX;
    return typeof locationX === 'number' && Number.isFinite(locationX) ? locationX : null;
}

/** The track takes the touch; the fill and thumb follow `value`. */
export function Slider(props: SliderProps): React.ReactElement {
    const [trackWidth, setTrackWidth] = React.useState(0);
    const { onValueChange } = props;
    const percent = `${Math.round(props.value * 100)}%` as const;

    const updateFromEvent = React.useCallback((event: GestureResponderEvent) => {
        const locationX = readLocationX(event);
        if (locationX == null) return;
        onValueChange(Math.min(1, Math.max(0, locationX / trackWidth)));
    }, [onValueChange, trackWidth]);

    const handleTrackLayout = React.useCallback((event: LayoutChangeEvent) => {
        setTrackWidth(event.nativeEvent.layout.width);
    }, []);

    return (
        <View
            testID={props.testID}
            accessibilityRole="adjustable"
            accessibilityLabel={props.accessibilityLabel}
            accessibilityValue={{
                min: 0,
                max: props.steps,
                now: Math.round(props.value * props.steps),
                text: props.accessibilityValueText,
            }}
            onLayout={handleTrackLayout}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={updateFromEvent}
            onResponderMove={updateFromEvent}
            style={styles.hitbox}
        >
            <View style={styles.track}>
                <View testID={props.testID === undefined ? undefined : `${props.testID}-fill`} style={[styles.fill, { width: percent }]} />
                <View testID={props.testID === undefined ? undefined : `${props.testID}-thumb`} style={[styles.thumb, { left: percent }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    hitbox: {
        height: 40,
        justifyContent: 'center',
    },
    track: {
        borderRadius: 999,
        height: 6,
        overflow: 'visible',
        position: 'relative',
        backgroundColor: theme.colors.border.default,
    },
    fill: {
        borderRadius: 999,
        height: 6,
        backgroundColor: theme.colors.button.primary.background,
    },
    thumb: {
        borderRadius: 12,
        borderWidth: 3,
        height: 24,
        marginLeft: -12,
        marginTop: -9,
        position: 'absolute',
        top: 0,
        width: 24,
        backgroundColor: theme.colors.button.primary.background,
        borderColor: theme.colors.surface.base,
    },
}));
