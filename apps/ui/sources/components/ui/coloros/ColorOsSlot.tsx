import { RNHostView } from '@expo/ui/jetpack-compose';
import * as React from 'react';
import { View } from 'react-native';

/**
 * React Native content drawn in a slot of a ColorOS native view (an icon, an empty-state image). It
 * keeps its own React Native size, takes no touches (the native control around it does), and stays out
 * of the accessibility tree, because the native control already names itself.
 */
export function ColorOsSlot(props: Readonly<{ children: React.ReactNode }>): React.ReactElement {
    return (
        <RNHostView matchContents>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {props.children}
            </View>
        </RNHostView>
    );
}
