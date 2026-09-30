import * as React from 'react';
import { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderScreen } from '@/dev/testkit';
import type { RouteFocusStore } from '@/dev/testkit/mocks/router';

import type { SessionMobileSurface } from './sessionCockpitState';

type SurfaceNavigation = Readonly<{
    isActive: boolean;
    switchSurface: (surface: SessionMobileSurface) => void;
    returnToPreviousSurface: () => void;
}>;

const harness = vi.hoisted(() => ({
    platformOS: 'ios' as 'ios' | 'android' | 'web',
    routeFocus: null as null | RouteFocusStore,
    backHandlers: new Set<() => boolean>(),
    persistedSurfaces: [] as Array<Readonly<{ sessionId: string; surface: string }>>,
    localSettingReads: [] as string[],
    surfaceRenders: [] as Array<Readonly<{ surface: SessionMobileSurface; isActive: boolean; scopeId: string }>>,
    navigation: new Map<SessionMobileSurface, SurfaceNavigation>(),
}));

vi.mock('expo-router', async () => {
    const { createExpoRouterMock, createRouteFocusStore } = await import('@/dev/testkit/mocks/router');
    harness.routeFocus = createRouteFocusStore();
    return createExpoRouterMock({ isFocused: harness.routeFocus }).module;
});

vi.mock('react-native', async () => {
    const { createReactNativeWebMock } = await import('@/dev/testkit/mocks/reactNative');
    return createReactNativeWebMock({
        Platform: {
            get OS() {
                return harness.platformOS;
            },
        },
        BackHandler: {
            addEventListener: (_eventName: string, handler: () => boolean) => {
                harness.backHandlers.add(handler);
                return {
                    remove: () => {
                        harness.backHandlers.delete(handler);
                    },
                };
            },
        },
    });
});

vi.mock('@/sync/domains/state/storage', async () => {
    const { createStorageModuleStub } = await import('@/dev/testkit/mocks/storage');
    return createStorageModuleStub({
        useLocalSetting: (key: string) => {
            harness.localSettingReads.push(key);
            return null;
        },
        usePersistSessionLastMobileSurface: () => (sessionId: string, surface: string) => {
            harness.persistedSurfaces.push({ sessionId, surface });
        },
    });
});

// The real surface screen renders the whole session UI. This probe stands in for it and reads the
// navigator's real surface context, so every assertion below observes what a surface would see.
vi.mock('./SessionCockpitSurfaceScreen', async () => {
    const { useSessionCockpitSurfaceNavigation } = await import('./SessionCockpitSurfaceNavigation');
    return {
        SessionCockpitSurfaceScreen: (props: { surface: SessionMobileSurface; scopeId: string }) => {
            const navigation = useSessionCockpitSurfaceNavigation();
            if (!navigation) {
                throw new Error(`Surface ${props.surface} rendered outside the cockpit navigator`);
            }
            harness.navigation.set(props.surface, navigation);
            harness.surfaceRenders.push({ surface: props.surface, isActive: navigation.isActive, scopeId: props.scopeId });
            return React.createElement('SurfaceProbe', { surface: props.surface, isActive: navigation.isActive });
        },
    };
});

function navigationFor(surface: SessionMobileSurface): SurfaceNavigation {
    const navigation = harness.navigation.get(surface);
    if (!navigation) {
        throw new Error(`Surface ${surface} has not mounted`);
    }
    return navigation;
}

function lastRender(surface: SessionMobileSurface) {
    const renders = harness.surfaceRenders.filter((render) => render.surface === surface);
    return renders[renders.length - 1];
}

async function settleDeferredFreeze() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function renderNavigator(props: Readonly<{
    sessionId?: string;
    initialSurface: SessionMobileSurface;
    terminalTabAvailable?: boolean;
    scopeId?: string;
}>) {
    const { SessionCockpitTabNavigator } = await import('./SessionCockpitTabNavigator');
    const element = (next: typeof props) => (
        <SessionCockpitTabNavigator
            sessionId={next.sessionId ?? 's1'}
            scopeId={next.scopeId ?? `session:${next.sessionId ?? 's1'}`}
            initialSurface={next.initialSurface}
            terminalTabAvailable={next.terminalTabAvailable ?? true}
        />
    );
    const screen = await renderScreen(element(props));
    return {
        screen,
        update: (next: typeof props) => screen.update(element(next)),
    };
}

describe('SessionCockpitTabNavigator', () => {
    beforeEach(() => {
        harness.platformOS = 'ios';
        harness.routeFocus?.setFocused(true);
        harness.backHandlers.clear();
        harness.persistedSurfaces = [];
        harness.localSettingReads = [];
        harness.surfaceRenders = [];
        harness.navigation.clear();
    });

    it('mounts a surface on first visit and keeps visited surfaces mounted but inactive', async () => {
        const { screen } = await renderNavigator({ initialSurface: 'chat' });

        expect(screen.findAllByType('SurfaceProbe').map((node) => node.props.surface)).toEqual(['chat']);
        expect(lastRender('chat')?.isActive).toBe(true);

        await act(async () => {
            navigationFor('chat').switchSurface('git');
        });
        await settleDeferredFreeze();

        expect(screen.findByTestId('session-cockpit-scene:git')?.props).toEqual(expect.objectContaining({
            pointerEvents: 'auto',
            accessibilityElementsHidden: false,
            importantForAccessibility: 'auto',
        }));
        expect(screen.findByTestId('session-cockpit-scene:chat')?.props).toEqual(expect.objectContaining({
            pointerEvents: 'none',
            accessibilityElementsHidden: true,
            importantForAccessibility: 'no-hide-descendants',
        }));
        expect(lastRender('git')?.isActive).toBe(true);
        // The deactivated surface renders once with its blur before it freezes.
        expect(lastRender('chat')?.isActive).toBe(false);
        expect(harness.persistedSurfaces).toEqual([{ sessionId: 's1', surface: 'git' }]);
        expect(harness.localSettingReads).not.toContain('sessionLastMobileSurfaceBySessionId');
    });

    it('stops updating an inactive surface after it observed its blur and resumes it on return', async () => {
        const { update } = await renderNavigator({ initialSurface: 'chat', scopeId: 'scope:a' });

        await act(async () => {
            navigationFor('chat').switchSurface('browse');
        });
        await settleDeferredFreeze();
        const chatRendersBeforeUpdate = harness.surfaceRenders.filter((render) => render.surface === 'chat').length;

        await update({ initialSurface: 'chat', scopeId: 'scope:b' });
        await settleDeferredFreeze();

        expect(lastRender('browse')?.scopeId).toBe('scope:b');
        expect(harness.surfaceRenders.filter((render) => render.surface === 'chat')).toHaveLength(chatRendersBeforeUpdate);

        await act(async () => {
            navigationFor('browse').returnToPreviousSurface();
        });
        await settleDeferredFreeze();

        expect(lastRender('chat')).toEqual({ surface: 'chat', isActive: true, scopeId: 'scope:b' });
    });

    it('walks back through surfaces in the order they were last visited', async () => {
        await renderNavigator({ initialSurface: 'chat' });

        for (const next of ['git', 'browse', 'git'] as const) {
            const active = harness.surfaceRenders.filter((render) => render.isActive).at(-1)!.surface;
            await act(async () => {
                navigationFor(active).switchSurface(next);
            });
        }
        await act(async () => {
            navigationFor('git').returnToPreviousSurface();
        });
        expect(lastRender('browse')?.isActive).toBe(true);

        await act(async () => {
            navigationFor('browse').returnToPreviousSurface();
        });
        expect(lastRender('chat')?.isActive).toBe(true);
        expect(harness.persistedSurfaces.map((entry) => entry.surface)).toEqual(['git', 'browse', 'git', 'browse', 'chat']);
    });

    it('returns to chat when the current surface has no previous surface', async () => {
        const { screen } = await renderNavigator({ initialSurface: 'navigation' });

        await act(async () => {
            navigationFor('navigation').returnToPreviousSurface();
        });

        expect(lastRender('chat')?.isActive).toBe(true);
        expect(screen.findByTestId('session-cockpit-scene:navigation')?.props.pointerEvents).toBe('none');
        expect(harness.persistedSurfaces).toEqual([{ sessionId: 's1', surface: 'chat' }]);
    });

    it('marks inactive web scenes inert and hidden while the active scene stays interactive', async () => {
        harness.platformOS = 'web';
        const { screen } = await renderNavigator({ initialSurface: 'chat' });

        await act(async () => {
            navigationFor('chat').switchSurface('tabs');
        });

        expect(screen.findByTestId('session-cockpit-scene:chat')?.props).toEqual(expect.objectContaining({
            inert: true,
            'aria-hidden': true,
            pointerEvents: 'none',
            accessibilityElementsHidden: undefined,
        }));
        expect(screen.findByTestId('session-cockpit-scene:tabs')?.props).toEqual(expect.objectContaining({
            inert: undefined,
            'aria-hidden': undefined,
            pointerEvents: 'auto',
        }));
    });

    it('lets the Android back button return to the previous surface only while the route is focused', async () => {
        harness.platformOS = 'android';
        await renderNavigator({ initialSurface: 'chat' });
        expect(harness.backHandlers.size).toBe(0);

        await act(async () => {
            navigationFor('chat').switchSurface('git');
        });
        expect(harness.backHandlers.size).toBe(1);

        await act(async () => {
            harness.routeFocus?.setFocused(false);
        });
        expect(harness.backHandlers.size).toBe(0);

        await act(async () => {
            harness.routeFocus?.setFocused(true);
        });
        const [handler] = [...harness.backHandlers];
        let handled = false;
        await act(async () => {
            handled = handler!();
        });

        expect(handled).toBe(true);
        expect(lastRender('chat')?.isActive).toBe(true);
        // Chat is the root of the history, so the system back action is no longer intercepted.
        expect(harness.backHandlers.size).toBe(0);
    });

    it('opens the destination session on its own initial surface without inheriting surface history', async () => {
        const { screen, update } = await renderNavigator({ sessionId: 's1', initialSurface: 'chat' });

        await act(async () => {
            navigationFor('chat').switchSurface('git');
        });
        harness.navigation.clear();
        await update({ sessionId: 's2', initialSurface: 'terminal' });

        expect(screen.findAllByType('SurfaceProbe').map((node) => node.props.surface)).toEqual(['terminal']);
        expect(lastRender('terminal')?.isActive).toBe(true);
        expect(harness.persistedSurfaces).toEqual([{ sessionId: 's1', surface: 'git' }]);
    });

    it('opens chat instead of an unavailable terminal surface', async () => {
        const { screen } = await renderNavigator({ initialSurface: 'terminal', terminalTabAvailable: false });

        expect(screen.findAllByType('SurfaceProbe').map((node) => node.props.surface)).toEqual(['chat']);
        expect(screen.findByTestId('session-cockpit-scene:terminal')).toBeNull();
    });
});
