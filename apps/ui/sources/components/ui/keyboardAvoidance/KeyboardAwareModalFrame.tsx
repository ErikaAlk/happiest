import * as React from 'react';
import type { ViewInstance } from 'react-native';

import { KeyboardAwareScreen, type KeyboardAwareScreenProps } from './KeyboardAwareScreen';

export type KeyboardAwareModalFrameProps = Omit<KeyboardAwareScreenProps, 'mode'>;

export const KeyboardAwareModalFrame = React.forwardRef<ViewInstance, KeyboardAwareModalFrameProps>(
    function KeyboardAwareModalFrame(props, ref) {
        return <KeyboardAwareScreen ref={ref} mode="centeredModal" {...props} />;
    },
);
