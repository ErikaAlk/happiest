import * as React from 'react';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { useColorOsHostEnvironment } from '@/components/ui/coloros/useColorOsHostEnvironment';
import { CoProgressBarNative } from '@/components/ui/coloros/colorOsNativeViews';

import { clampMeterFill, MeterBarCaption, meterBarAccessibilityProps, type MeterBarProps } from './meterBarModel';

export type { MeterBarProps, MeterTone } from './meterBarModel';

export const MeterBar = React.memo<MeterBarProps>((props) => {
    const { theme } = useUnistyles();
    const environment = useColorOsHostEnvironment();
    const fill = clampMeterFill(props.fillFraction);

    return (
        <View
            testID={props.testID}
            style={props.style}
            {...meterBarAccessibilityProps(props.progressAccessibilityLabel, fill)}
        >
            <CoProgressBarNative
                {...environment}
                testID={props.testID ? `${props.testID}:track` : undefined}
                value={fill}
                barHeight={props.height}
                color={theme.colors.state[props.tone].foreground}
            />
            {props.caption != null ? <MeterBarCaption caption={props.caption} testID={props.testID} /> : null}
        </View>
    );
});

MeterBar.displayName = 'MeterBar';
