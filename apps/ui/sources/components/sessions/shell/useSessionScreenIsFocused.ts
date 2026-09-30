import { useIsFocused } from 'expo-router';

import { useSessionCockpitSurfaceNavigation } from '@/components/workspaceCockpit/session/SessionCockpitSurfaceNavigation';

/**
 * Whether the session screen is the one the user is looking at: its route is focused and, inside
 * the mobile session cockpit, its surface is the active one. Outside the cockpit there is no
 * surface switcher, so the route focus alone decides.
 */
export function useSessionScreenIsFocused(): boolean {
    const routeFocused = useIsFocused();
    const surfaceNavigation = useSessionCockpitSurfaceNavigation();
    return routeFocused && (surfaceNavigation === null || surfaceNavigation.isActive);
}
