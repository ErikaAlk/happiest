import * as React from 'react';
import { useIsFocused } from 'expo-router';
import { BackHandler, Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { Freeze } from 'react-freeze';

import { usePersistSessionLastMobileSurface } from '@/sync/domains/state/storage';

import {
    type SessionMobileSurface,
} from './sessionCockpitState';
import { SessionCockpitSurfaceNavigationProvider } from './SessionCockpitSurfaceNavigation';
import {
    SessionCockpitSurfaceScreen,
    type SessionCockpitSurfaceScreenProps,
} from './SessionCockpitSurfaceScreen';

const SESSION_COCKPIT_SURFACES_WITH_TERMINAL: readonly SessionMobileSurface[] = ['chat', 'browse', 'git', 'navigation', 'tabs', 'terminal'];
const SESSION_COCKPIT_SURFACES_WITHOUT_TERMINAL: readonly SessionMobileSurface[] = ['chat', 'browse', 'git', 'navigation', 'tabs'];
const WebInertView = View as React.ComponentType<ViewProps & Pick<React.HTMLAttributes<HTMLElement>, 'inert'>>;

type SessionCockpitTabNavigatorProps = Omit<SessionCockpitSurfaceScreenProps, 'surface'> & Readonly<{
    initialSurface: SessionMobileSurface;
}>;

type SessionCockpitSurfaceTabsProps = SessionCockpitTabNavigatorProps & Readonly<{
    surfaces: readonly SessionMobileSurface[];
}>;

function resolveAvailableSurfaces(terminalTabAvailable: boolean): readonly SessionMobileSurface[] {
    return terminalTabAvailable
        ? SESSION_COCKPIT_SURFACES_WITH_TERMINAL
        : SESSION_COCKPIT_SURFACES_WITHOUT_TERMINAL;
}

function resolveInitialSurface(
    initialSurface: SessionMobileSurface,
    terminalTabAvailable: boolean,
): SessionMobileSurface {
    if (initialSurface === 'terminal' && !terminalTabAvailable) {
        return 'chat';
    }
    return initialSurface;
}

export const SessionCockpitTabNavigator = React.memo((props: SessionCockpitTabNavigatorProps) => {
    const terminalTabAvailable = props.terminalTabAvailable !== false;
    const initialSurface = resolveInitialSurface(props.initialSurface, terminalTabAvailable);
    const surfaces = resolveAvailableSurfaces(terminalTabAvailable);

    // The session route is navigated singularly (`useNavigateToSession` reuses the route key),
    // so a session -> session move never remounts this screen. Keying on the session makes the
    // surface history belong to the session it was built for: session B opens on its own initial
    // surface instead of session A's, and does not inherit session A's surface history. It also
    // keeps mounted work small: only the destination surface mounts.
    return (
        <SessionCockpitSurfaceTabs
            key={props.sessionId}
            {...props}
            initialSurface={initialSurface}
            surfaces={surfaces}
        />
    );
});

const SessionCockpitSurfaceTabs = React.memo((props: SessionCockpitSurfaceTabsProps) => {
    const { initialSurface, surfaces, ...screenProps } = props;
    const routeFocused = useIsFocused();
    const persistSessionLastMobileSurface = usePersistSessionLastMobileSurface();
    // Most recent surface last. Revisiting a surface moves it to the end, so going back walks
    // the surfaces in the order the reader last left them.
    const [surfaceHistory, setSurfaceHistory] = React.useState<readonly SessionMobileSurface[]>(() => [initialSurface]);
    // Surfaces mount on first visit and stay mounted, frozen while inactive.
    const [mountedSurfaces, setMountedSurfaces] = React.useState<ReadonlySet<SessionMobileSurface>>(() => new Set([initialSurface]));

    const availableHistory = surfaceHistory.filter((surface) => surfaces.includes(surface));
    const activeSurface = availableHistory[availableHistory.length - 1] ?? 'chat';
    const previousSurface = availableHistory.length > 1 ? availableHistory[availableHistory.length - 2] : null;
    const activeSurfaceRef = React.useRef(activeSurface);
    const previousSurfaceRef = React.useRef(previousSurface);
    activeSurfaceRef.current = activeSurface;
    previousSurfaceRef.current = previousSurface;

    const persistSessionSurface = React.useCallback((surface: SessionMobileSurface) => {
        persistSessionLastMobileSurface(props.sessionId, surface);
    }, [persistSessionLastMobileSurface, props.sessionId]);

    const switchSurface = React.useCallback((targetSurface: SessionMobileSurface) => {
        setSurfaceHistory((history) => [...history.filter((surface) => surface !== targetSurface), targetSurface]);
        setMountedSurfaces((mounted) => mounted.has(targetSurface) ? mounted : new Set([...mounted, targetSurface]));
        persistSessionSurface(targetSurface);
    }, [persistSessionSurface]);

    const returnToPreviousSurface = React.useCallback(() => {
        const target = previousSurfaceRef.current;
        if (target) {
            const leavingSurface = activeSurfaceRef.current;
            setSurfaceHistory((history) => history.filter((surface) => surface !== leavingSurface));
            persistSessionSurface(target);
        } else {
            switchSurface('chat');
        }
    }, [persistSessionSurface, switchSurface]);

    React.useEffect(() => {
        if (Platform.OS !== 'android' || !routeFocused || !previousSurface) return;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            returnToPreviousSurface();
            return true;
        });
        return () => subscription.remove();
    }, [previousSurface, returnToPreviousSurface, routeFocused]);

    return (
        <View style={styles.container}>
            {surfaces.filter((surface) => mountedSurfaces.has(surface)).map((surface) => (
                <SessionCockpitScene
                    key={surface}
                    surface={surface}
                    active={surface === activeSurface}
                    switchSurface={switchSurface}
                    returnToPreviousSurface={returnToPreviousSurface}
                >
                    <SessionCockpitSurfaceScreen {...screenProps} surface={surface} />
                </SessionCockpitScene>
            ))}
        </View>
    );
});

const SessionCockpitScene = React.memo((props: Readonly<{
    children: React.ReactNode;
    surface: SessionMobileSurface;
    active: boolean;
    switchSurface: (surface: SessionMobileSurface) => void;
    returnToPreviousSurface: () => void;
}>) => {
    const isWeb = Platform.OS === 'web';
    const surfaceNavigation = React.useMemo(() => ({
        isActive: props.active,
        switchSurface: props.switchSurface,
        returnToPreviousSurface: props.returnToPreviousSurface,
    }), [props.active, props.returnToPreviousSurface, props.switchSurface]);

    return (
        <WebInertView
            testID={`session-cockpit-scene:${props.surface}`}
            style={[styles.scene, !props.active && styles.inactiveScene]}
            collapsable={false}
            inert={isWeb && !props.active ? true : undefined}
            aria-hidden={isWeb && !props.active ? true : undefined}
            accessibilityElementsHidden={isWeb ? undefined : !props.active}
            importantForAccessibility={isWeb ? undefined : (props.active ? 'auto' : 'no-hide-descendants')}
            pointerEvents={props.active ? 'auto' : 'none'}
        >
            <DelayedFreeze freeze={!props.active}>
                <SessionCockpitSurfaceNavigationProvider value={surfaceNavigation}>
                    {props.children}
                </SessionCockpitSurfaceNavigationProvider>
            </DelayedFreeze>
        </WebInertView>
    );
});

// Freezes one render after deactivation, so the surface observes its own blur (effects keyed on
// `useSessionScreenIsFocused()` run their inactive branch) before its updates stop.
function DelayedFreeze(props: Readonly<{ freeze: boolean; children: React.ReactNode }>) {
    const [freezeReady, setFreezeReady] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setFreezeReady(props.freeze);
        }, 0);
        return () => clearTimeout(timer);
    }, [props.freeze]);

    return <Freeze freeze={props.freeze && freezeReady}>{props.children}</Freeze>;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 0,
    },
    scene: {
        ...StyleSheet.absoluteFill,
    },
    inactiveScene: {
        display: 'none',
    },
});
