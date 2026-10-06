import * as React from 'react';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { clampMeterFill, MeterBarCaption, meterBarAccessibilityProps, type MeterBarProps } from './meterBarModel';

export type { MeterBarProps, MeterTone } from './meterBarModel';

const DEFAULT_TRACK_HEIGHT_PX = 6;

const stylesheet = StyleSheet.create(() => ({
    track: {
        width: '100%',
        borderRadius: 999,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: 999,
    },
}));

export const MeterBar = React.memo<MeterBarProps>((props) => {
    const { theme } = useUnistyles();
    const styles = stylesheet;

    const height = props.height ?? DEFAULT_TRACK_HEIGHT_PX;
    const fill = clampMeterFill(props.fillFraction);
    // Read the token directly — never apply a runtime opacity/rgba transform to a
    // theme token (web var-ification turns such transforms into silent no-ops).
    const fillColor = theme.colors.state[props.tone].foreground;
    const trackColor = props.trackColor ?? theme.colors.surface.pressedOverlay;

    return (
        <View
            testID={props.testID}
            style={props.style}
            {...meterBarAccessibilityProps(props.progressAccessibilityLabel, fill)}
        >
            <View
                testID={props.testID ? `${props.testID}:track` : undefined}
                style={[styles.track, { height, backgroundColor: trackColor }]}
            >
                <View
                    testID={props.testID ? `${props.testID}:fill` : undefined}
                    style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: fillColor }]}
                />
            </View>
            {props.caption != null ? <MeterBarCaption caption={props.caption} testID={props.testID} /> : null}
        </View>
    );
});

MeterBar.displayName = 'MeterBar';
