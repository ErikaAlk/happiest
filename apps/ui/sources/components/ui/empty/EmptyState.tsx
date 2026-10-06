import * as React from 'react';
import { View } from 'react-native';

import { QuietTextButton } from '@/components/ui/buttons/QuietTextButton';
import { CenteredInfoTile } from '@/components/ui/lists/CenteredInfoTile';

import type { EmptyStateProps } from './EmptyState.types';

export type { EmptyStateAction, EmptyStateProps } from './EmptyState.types';

/**
 * Generic, app-wide empty state: themed icon + title + subtitle + optional
 * action. Reuses {@link CenteredInfoTile} for the icon/title/subtitle layout
 * (the canonical centered info tile) and adds the action slot it lacks. i18n is
 * the caller's responsibility — pass already-translated strings.
 */
export const EmptyState = React.memo((props: EmptyStateProps) => {
    return (
        <View testID={props.testID} style={{ width: '100%', alignItems: 'center' }}>
            <CenteredInfoTile
                icon={props.icon}
                title={props.title}
                description={props.subtitle ?? null}
                titleTestID={props.titleTestID}
                descriptionTestID={props.subtitleTestID}
                paddingHorizontal={props.paddingHorizontal}
            />
            {props.action != null ? (
                <View
                    testID={props.actionTestID}
                    style={{ width: '100%', maxWidth: 520, alignItems: 'center', marginTop: 16 }}
                >
                    <QuietTextButton label={props.action.label} onPress={props.action.onPress} testID={props.action.testID} />
                </View>
            ) : null}
        </View>
    );
});

EmptyState.displayName = 'EmptyState';
