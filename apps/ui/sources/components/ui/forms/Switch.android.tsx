import * as React from 'react';
import type { NativeSyntheticEvent } from 'react-native';

import { useColorOsHostEnvironment } from '@/components/ui/coloros/useColorOsHostEnvironment';
import { CoSwitchNative } from '@/components/ui/coloros/colorOsNativeViews';
import { t } from '@/text';

import type { AppSwitchProps } from './Switch.types';

export type { AppSwitchProps } from './Switch.types';

export const Switch = ({ value, onValueChange, disabled, accessibilityLabel, testID, style }: AppSwitchProps) => {
    const environment = useColorOsHostEnvironment();
    const handleCheckedChange = React.useCallback(
        (event: NativeSyntheticEvent<{ checked: boolean }>) => onValueChange?.(event.nativeEvent.checked),
        [onValueChange],
    );

    return (
        <CoSwitchNative
            {...environment}
            checked={value}
            enabled={disabled !== true}
            interactive={onValueChange !== undefined}
            onStateDescription={t('common.on')}
            offStateDescription={t('common.off')}
            onCheckedChange={handleCheckedChange}
            accessibilityText={accessibilityLabel}
            testID={testID}
            style={style}
        />
    );
};
