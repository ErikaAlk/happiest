import * as React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { CoHeaderSurfaceNative } from '@/components/ui/coloros/colorOsNativeViews';
import { useColorOsHostEnvironment } from '@/components/ui/coloros/useColorOsHostEnvironment';

export function ColorOsHeaderSurface({ children, ...props }: ViewProps) {
    const environment = useColorOsHostEnvironment();
    return (
        <View {...props}>
            {children ? <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
                <CoHeaderSurfaceNative {...environment} style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" />
            </View> : null}
            {children}
        </View>
    );
}
