import * as React from 'react';

import { CoCheckBoxNative } from '@/components/ui/coloros/colorOsNativeViews';
import { useColorOsHostEnvironment } from '@/components/ui/coloros/useColorOsHostEnvironment';

import type { CheckboxMarkProps } from './CheckboxMark.types';

export type { CheckboxMarkProps } from './CheckboxMark.types';

/**
 * Android: the ColorOS UI kit check box, display-only. The pressable around it takes the press and
 * speaks for it, so the mark itself stays out of the accessibility tree.
 */
export function CheckboxMark(props: CheckboxMarkProps): React.ReactElement {
    const environment = useColorOsHostEnvironment();

    return (
        <CoCheckBoxNative
            {...environment}
            testID={props.testID}
            checked={props.checked}
            enabled
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
        />
    );
}
