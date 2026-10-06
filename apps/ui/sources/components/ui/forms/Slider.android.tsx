import * as React from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import { CoSeekBarNative } from '@/components/ui/coloros/colorOsNativeViews';
import { useColorOsHostEnvironment } from '@/components/ui/coloros/useColorOsHostEnvironment';

import type { SliderProps } from './Slider.types';

export type { SliderProps } from './Slider.types';

/** Android: the ColorOS UI kit seek bar. */
export function Slider(props: SliderProps): React.ReactElement {
    const environment = useColorOsHostEnvironment();
    const { onValueChange } = props;
    const handleValueChange = React.useCallback((event: NativeSyntheticEvent<{ value: number }>) => {
        onValueChange(event.nativeEvent.value);
    }, [onValueChange]);

    return (
        <CoSeekBarNative
            {...environment}
            testID={props.testID}
            value={props.value}
            steps={props.steps}
            enabled
            valueText={props.accessibilityValueText}
            accessibilityText={props.accessibilityLabel}
            onValueChange={handleValueChange}
        />
    );
}
