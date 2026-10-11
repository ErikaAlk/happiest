import * as React from 'react';

import { CoLoadingNative } from '@/components/ui/coloros/colorOsNativeViews';
import { useColorOsHostEnvironment } from '@/components/ui/coloros/useColorOsHostEnvironment';

import type { ActivitySpinnerProps } from './activitySpinnerModel';

export { ICON_CIRCLE_INK_RATIO, iconMatchedSpinnerSize, type ActivitySpinnerProps } from './activitySpinnerModel';

/** COUI 标准大号加载圈直径。 */
const COUI_LARGE_RING_DP = 26;

/** Android: the ColorOS UI kit loading ring. */
export function ActivitySpinner(props: ActivitySpinnerProps) {
    const environment = useColorOsHostEnvironment();
    const { animating = true, hidesWhenStopped = true, animationEnabled = true, size } = props;

    if (!animating && hidesWhenStopped) {
        return null;
    }

    return (
        <CoLoadingNative
            {...environment}
            large={size === 'large' || (typeof size === 'number' && size >= COUI_LARGE_RING_DP)}
            diameter={typeof size === 'number' ? size : undefined}
            animating={animating && animationEnabled}
            accessibilityText={props.accessibilityLabel}
            importantForAccessibility={props.importantForAccessibility}
            accessibilityElementsHidden={props.accessibilityElementsHidden}
            testID={props.testID}
            style={props.style}
        />
    );
}
