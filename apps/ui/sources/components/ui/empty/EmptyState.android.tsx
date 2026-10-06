import * as React from 'react';

import { ColorOsSlot } from '@/components/ui/coloros/ColorOsSlot';
import { useColorOsHostEnvironment } from '@/components/ui/coloros/useColorOsHostEnvironment';
import { CoEmptyStateNative } from '@/components/ui/coloros/colorOsNativeViews';

import type { EmptyStateProps } from './EmptyState.types';

export type { EmptyStateAction, EmptyStateProps } from './EmptyState.types';

/** Android: the ColorOS UI kit empty state; the caller's icon is hosted in the kit's image slot. */
export const EmptyState = React.memo((props: EmptyStateProps) => {
    const environment = useColorOsHostEnvironment();
    const action = props.action;
    const handleAction = React.useCallback(() => action?.onPress(), [action]);

    return (
        <CoEmptyStateNative
            {...environment}
            testID={props.testID}
            title={props.title}
            subtitle={props.subtitle}
            actionText={action?.label}
            onAction={handleAction}
            hasImage
            style={{ width: '100%' }}
        >
            <ColorOsSlot>{props.icon}</ColorOsSlot>
        </CoEmptyStateNative>
    );
});

EmptyState.displayName = 'EmptyState';
