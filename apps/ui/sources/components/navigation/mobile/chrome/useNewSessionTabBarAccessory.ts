import * as React from 'react';
import { useRouter } from 'expo-router';

import {
    shouldForceFreshNewSessionEntryFromPressEvent,
    useResolveNewSessionOrdinaryEntryRoute,
} from '@/components/sessions/new/navigation/newSessionOrdinaryEntryRoute';
import type { TabBarAccessory } from '@/components/ui/navigation/tabBarModel';
import { t } from '@/text';

/**
 * The "+" beside the floating tab bar on the sessions list — a second, thumb-reachable way into the
 * new-session flow while the header "+" stays where it is. Creating a session is not a navigation
 * destination, so it rides the bar as an accessory and never as a fifth tab.
 */
export function useNewSessionTabBarAccessory(): TabBarAccessory {
    const router = useRouter();
    const resolveNewSessionOrdinaryEntryRoute = useResolveNewSessionOrdinaryEntryRoute();

    return React.useMemo(() => ({
        testID: 'tabbar-start-new-session',
        accessibilityLabel: t('newSession.title'),
        icon: 'plus',
        onPress: (event?: unknown) => {
            const { draftId, draftOrigin } = resolveNewSessionOrdinaryEntryRoute({
                forceFresh: shouldForceFreshNewSessionEntryFromPressEvent(event),
            });
            router.push({ pathname: '/new', params: { draftId, draftOrigin } });
        },
    }), [resolveNewSessionOrdinaryEntryRoute, router]);
}
