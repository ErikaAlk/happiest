import * as React from 'react';
import { Stack } from 'expo-router';

import { ColorOsControlsGallery } from '@/components/ui/coloros/ColorOsControlsGallery';

export default function ColorOsControlsDevScreen() {
    return (
        <>
            <Stack.Screen options={{ headerTitle: 'ColorOS controls' }} />
            <ColorOsControlsGallery />
        </>
    );
}
