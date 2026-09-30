import * as React from 'react';
import type { ViewInstance, ViewProps } from 'react-native';
import { Platform, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';

import { resolveKeyboardStickyFooterOffset } from './keyboardAvoidanceGeometry';

export type KeyboardStickyFooterProps = ViewProps & Readonly<{
    offset?: number;
    enabled?: boolean;
}>;

export const KeyboardStickyFooter = React.forwardRef<ViewInstance, KeyboardStickyFooterProps>(
    function KeyboardStickyFooter({ offset, enabled, ...props }, ref) {
        if (Platform.OS === 'web') {
            return <KeyboardStickyFooterView ref={ref} {...props} />;
        }

        return (
            <KeyboardStickyView
                ref={ref}
                offset={resolveKeyboardStickyFooterOffset(offset)}
                enabled={enabled}
                {...props}
            />
        );
    },
);

const KeyboardStickyFooterView = React.forwardRef<ViewInstance, ViewProps>(function KeyboardStickyFooterView(props, ref) {
    return <View ref={ref} {...props} />;
});
