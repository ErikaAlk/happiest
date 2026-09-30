import * as React from 'react';
import type { ScrollViewInstance, ScrollViewProps } from 'react-native';
import { Platform, ScrollView } from 'react-native';
import {
    KeyboardAwareScrollView as RNKCKeyboardAwareScrollView,
    type KeyboardAwareScrollViewProps as RNKCKeyboardAwareScrollViewProps,
    type KeyboardAwareScrollViewRef as RNKCKeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

import { DEFAULT_KEYBOARD_AWARE_SCREEN_MODE } from './keyboardAvoidanceDefaults';
import {
    resolveKeyboardAwareScrollViewDefaults,
    type KeyboardAvoidancePlatform,
    type KeyboardAwareScreenMode,
} from './keyboardAvoidanceGeometry';

export type KeyboardAwareScrollViewProps = ScrollViewProps
    & Pick<RNKCKeyboardAwareScrollViewProps, 'disableScrollOnKeyboardHide' | 'extraKeyboardSpace'>
    & Readonly<{
        mode?: Extract<KeyboardAwareScreenMode, 'scrollForm'>;
        keyboardVerticalOffset?: number;
        bottomOffset?: number;
        enabled?: boolean;
    }>;

export const KeyboardAwareScrollView = React.forwardRef<ScrollViewInstance, KeyboardAwareScrollViewProps>(
    function KeyboardAwareScrollView(
        {
            mode = 'scrollForm',
            keyboardVerticalOffset,
            bottomOffset,
            enabled,
            automaticallyAdjustKeyboardInsets,
            disableScrollOnKeyboardHide,
            extraKeyboardSpace,
            ...props
        },
        ref,
    ) {
        const defaults = resolveKeyboardAwareScrollViewDefaults({
            mode: mode ?? DEFAULT_KEYBOARD_AWARE_SCREEN_MODE,
            platform: Platform.OS as KeyboardAvoidancePlatform,
            keyboardVerticalOffset,
        });

        if (!defaults.useKeyboardController) {
            return (
                <ScrollView
                    ref={ref}
                    automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
                    {...props}
                />
            );
        }

        return (
            <RNKCKeyboardAwareScrollView
                // The library writes its handle, a ScrollViewInstance extended with keyboard methods, into this ref.
                ref={ref as React.Ref<RNKCKeyboardAwareScrollViewRef>}
                automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets ?? defaults.automaticallyAdjustKeyboardInsets}
                bottomOffset={bottomOffset ?? defaults.bottomOffset}
                disableScrollOnKeyboardHide={disableScrollOnKeyboardHide}
                enabled={enabled ?? defaults.enabled}
                extraKeyboardSpace={extraKeyboardSpace}
                {...props}
            />
        );
    },
);
