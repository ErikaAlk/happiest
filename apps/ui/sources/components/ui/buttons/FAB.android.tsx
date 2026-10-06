import * as React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorOsHostEnvironment } from '@/components/ui/coloros/useColorOsHostEnvironment';
import { CoFloatingButtonNative } from '@/components/ui/coloros/colorOsNativeViews';
import { t } from '@/text';

import type { FABProps } from './FAB.types';

export type { FABProps } from './FAB.types';

/** Android: the ColorOS UI kit floating button with its own plus glyph. */
export const FAB = React.memo((props: FABProps) => {
    const environment = useColorOsHostEnvironment();
    const safeArea = useSafeAreaInsets();
    const { onPress } = props;
    const handlePress = React.useCallback(() => onPress(), [onPress]);

    return (
        <CoFloatingButtonNative
            {...environment}
            enabled
            hasIcon={false}
            onPress={handlePress}
            accessibilityText={props.accessibilityLabel ?? t('common.add')}
            style={{ position: 'absolute', right: 16, bottom: safeArea.bottom + 16 }}
        />
    );
});
