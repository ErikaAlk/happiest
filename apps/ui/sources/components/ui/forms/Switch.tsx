import { Switch as RNSwitch, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { Deferred } from './Deferred';
import type { AppSwitchProps } from './Switch.types';

export type { AppSwitchProps } from './Switch.types';

const COMPACT_SCALE = 0.78;

export const Switch = ({ value, onValueChange, disabled, compact, accessibilityLabel, testID, style }: AppSwitchProps) => {
    const { theme } = useUnistyles();
    const inner = (
        <Deferred>
            <RNSwitch
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
                accessibilityLabel={accessibilityLabel}
                testID={testID}
                style={compact ? undefined : style}
                trackColor={{ false: theme.colors.switch.track.inactive, true: theme.colors.switch.track.active }}
                ios_backgroundColor={theme.colors.switch.track.inactive}
                thumbColor={theme.colors.switch.thumb.active}
                {...{
                    activeThumbColor: theme.colors.switch.thumb.active,
                }}
            />
        </Deferred>
    );

    if (!compact) return inner;

    return (
        <View style={[{ transform: [{ scale: COMPACT_SCALE }] }, style]}>
            {inner}
        </View>
    );
}
