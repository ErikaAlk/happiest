import * as React from 'react';
import { useRouter } from 'expo-router';

import {
    shouldForceFreshNewSessionEntryFromPressEvent,
    useResolveNewSessionOrdinaryEntryRoute,
} from '@/components/sessions/new/navigation/newSessionOrdinaryEntryRoute';
import type { TabBarAccessory } from '@/components/ui/navigation/tabBarModel';
import { t } from '@/text';

/**
 * 会话列表底栏的新建入口。
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
