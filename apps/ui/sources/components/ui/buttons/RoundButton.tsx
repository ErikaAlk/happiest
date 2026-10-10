import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { iOSUIKit } from 'react-native-typography';
import { Typography } from '@/constants/Typography';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Text } from '@/components/ui/text/Text';
import { GradientSurface, type SurfaceGradient } from '@/components/ui/surfaces/GradientSurface';
import { ActivitySpinner } from '@/components/ui/feedback/ActivitySpinner';
import { FocusRing, WEB_FOCUS_OUTLINE_RESET } from '@/components/ui/interaction/FocusRing';
import { useIsKeyboardModality } from '@/components/ui/interaction/inputModalityStore';

import { useRoundButtonPress, useRoundButtonSize, type RoundButtonDisplay, type RoundButtonProps, type RoundButtonSize } from './roundButtonModel';

export { RoundButtonSizeScope, type RoundButtonDisplay, type RoundButtonProps, type RoundButtonSize } from './roundButtonModel';

const sizes: { [key in RoundButtonSize]: { fontSize: number, hitSlop: number, pad: number } } = {
    large: { fontSize: 21, hitSlop: 0, pad: Platform.OS == 'ios' ? 0 : -1 },
    normal: { fontSize: 16, hitSlop: 8, pad: Platform.OS == 'ios' ? 1 : -2 },
    small: { fontSize: 14, hitSlop: 12, pad: Platform.OS == 'ios' ? -1 : -1 }
}

const stylesheet = StyleSheet.create((theme) => ({
    loadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 9999,
    },
    // Applied only when a mark is present, so a title-only button keeps the exact
    // single-child layout it has always had.
    contentContainerWithMark: {
        flexDirection: 'row',
        // The seam between the words and the mark. The mark stands in for a word,
        // so this reads as the space between two words rather than as the wider
        // icon-to-label gutter a toolbar button would use.
        gap: 5,
    },
    // The row already centres this slot on the label's own band, so the mark
    // needs no nudge of its own. Measured on an iPhone 17 Pro (iOS 26.3) against
    // the cap midline of the words beside it: 0.03pt with the slot centred as-is,
    // against 0.31pt once the label's legacy `size.pad` lift is mirrored onto the
    // mark — mirroring it double-counts a nudge the text has already spent.
    markSlot: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        ...Typography.default('semiBold'),
        fontWeight: '600',
        includeFontPadding: false,
    },
}));

export const RoundButton = React.memo(function RoundButton(props: RoundButtonProps) {
    const { theme } = useUnistyles();
    const resolvedSize = useRoundButtonSize(props.size);
    const styles = stylesheet;
    const { loading: doLoading, press: doAction } = useRoundButtonPress(props);
    const displays: { [key in RoundButtonDisplay]: {
        textColor: string,
        backgroundColor: string,
        borderColor: string,
        gradient?: SurfaceGradient,
    } } = {
        default: {
            backgroundColor: theme.colors.button.primary.background,
            gradient: theme.colors.button.primary.gradient,
            borderColor: 'transparent',
            textColor: theme.colors.button.primary.tint
        },
        inverted: {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            textColor: theme.colors.text.primary,
        }
    }

    const size = sizes[resolvedSize];
    const display = displays[props.display || 'default'];

    // React Native has no `:focus-visible`, so the ring is gated on keyboard modality by the
    // canonical input-modality store; a ring that flashed on every tap would be worse than none.
    // The ring is mounted only once focus has been possible, because `FocusRing` runs a Reanimated
    // animated style and this primitive is on nearly every screen.
    const keyboardModality = useIsKeyboardModality();
    const [focused, setFocused] = React.useState(false);
    const handleFocus = React.useCallback(() => setFocused(true), []);
    const handleBlur = React.useCallback(() => setFocused(false), []);
    const disabled = doLoading || props.disabled === true;
    const ringVisible = focused && keyboardModality && !disabled;

    return (
        <Pressable
            testID={props.testID}
            accessibilityRole="button"
            accessibilityLabel={props.accessibilityLabel}
            accessibilityHint={props.accessibilityHint}
            disabled={disabled}
            hitSlop={size.hitSlop}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={(p) => ([
                {
                    borderWidth: 1,
                    borderRadius: 10,
                    backgroundColor: display.gradient ? 'transparent' : display.backgroundColor,
                    borderColor: display.borderColor,
                    opacity: props.disabled ? 0.35 : (p.pressed ? 0.9 : 1),
                    overflow: 'hidden',
                },
                Platform.OS === 'web' ? WEB_FOCUS_OUTLINE_RESET : null,
                props.style])}
            onPress={doAction}
        >
            <View
                style={[
                    styles.contentContainer,
                    props.leading || props.trailing ? styles.contentContainerWithMark : null,
                ]}
            >
                {display.gradient ? (
                    <GradientSurface
                        fallbackColor={display.backgroundColor}
                        gradient={display.gradient}
                        borderRadius={10}
                        style={StyleSheet.absoluteFillObject}
                    />
                ) : null}
                {doLoading && (
                    <View style={styles.loadingContainer}>
                        <ActivitySpinner color={display.textColor} size='small' />
                    </View>
                )}
                {props.leading ? (
                    <View style={[styles.markSlot, { opacity: doLoading ? 0 : 1 }]}>
                        {props.leading}
                    </View>
                ) : null}
                <Text
                    style={[
                        iOSUIKit.title3,
                        styles.text,
                        {
                            marginTop: size.pad,
                            opacity: doLoading ? 0 : 1,
                            color: display.textColor,
                            fontSize: size.fontSize,
                        },
                        props.textStyle
                    ]}
                    numberOfLines={1}
                >
                    {props.title}
                </Text>
                {props.trailing ? (
                    <View style={[styles.markSlot, { opacity: doLoading ? 0 : 1 }]}>
                        {props.trailing}
                    </View>
                ) : null}
            </View>
            {keyboardModality || focused ? (
                <FocusRing
                    testID={props.testID === undefined ? undefined : `${props.testID}-focus-ring`}
                    visible={ringVisible}
                    // The pill clips its gradient with `overflow: hidden`, so an outside ring would
                    // be cut off exactly where it needs to be seen.
                    placement="inside"
                    radius={10}
                />
            ) : null}
        </Pressable>
    )
});

RoundButton.displayName = 'RoundButton';
