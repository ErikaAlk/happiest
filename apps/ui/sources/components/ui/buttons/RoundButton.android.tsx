import * as React from 'react';
import { StyleSheet } from 'react-native';

import { ColorOsSlot } from '@/components/ui/coloros/ColorOsSlot';
import { CoButtonNative } from '@/components/ui/coloros/colorOsNativeViews';
import { useColorOsHostEnvironment } from '@/components/ui/coloros/useColorOsHostEnvironment';
import { t } from '@/text';

import { useRoundButtonPress, useRoundButtonSize, type RoundButtonProps } from './roundButtonModel';

export { RoundButtonSizeScope, type RoundButtonDisplay, type RoundButtonProps, type RoundButtonSize } from './roundButtonModel';

/** Android: the ColorOS UI kit button. The kit keeps taking presses while loading; `useRoundButtonPress` drops them. */
export const RoundButton = React.memo(function RoundButton(props: RoundButtonProps) {
    const environment = useColorOsHostEnvironment();
    const size = useRoundButtonSize(props.size);
    const { loading, press } = useRoundButtonPress(props);
    const layout = StyleSheet.flatten(props.style) ?? {};
    const textColor = StyleSheet.flatten(props.textStyle)?.color;
    const label = props.accessibilityLabel ?? props.title;
    const accessibilityText = props.accessibilityHint ? [label, props.accessibilityHint].filter(Boolean).join(', ') : props.accessibilityLabel;

    return (
        <CoButtonNative
            {...environment}
            testID={props.testID}
            style={props.style}
            text={props.title ?? ''}
            buttonType={props.display === 'inverted' ? 'text' : 'primary'}
            size={size === 'small' ? 'small' : 'large'}
            enabled={props.disabled !== true}
            loading={loading}
            loadingDescription={t('common.loading')}
            textColor={textColor}
            fillWidth={layout.width !== undefined || layout.flex !== undefined}
            hasLeading={props.leading != null}
            hasTrailing={props.trailing != null}
            onPress={press}
            accessibilityText={accessibilityText}
        >
            {props.leading != null ? <ColorOsSlot>{props.leading}</ColorOsSlot> : null}
            {props.trailing != null ? <ColorOsSlot>{props.trailing}</ColorOsSlot> : null}
        </CoButtonNative>
    );
});

RoundButton.displayName = 'RoundButton';
