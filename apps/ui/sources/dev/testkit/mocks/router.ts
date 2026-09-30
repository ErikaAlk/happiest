import * as React from 'react';
import { vi } from 'vitest';

export type ExpoRouterParams = Record<string, string | string[] | undefined>;
export type ExpoRouterParamsInput = ExpoRouterParams | (() => ExpoRouterParams);
export type ExpoRouterPathnameInput = string | (() => string);
export type ExpoRouterSegmentsInput = string[] | (() => string[]);

export type StackScreenOptions = Readonly<Record<string, unknown>>;
export type StackScreenOptionsInput = StackScreenOptions | (() => StackScreenOptions);

export type StackOptionsCapture = Readonly<{
    record: (options: StackScreenOptionsInput) => void;
    reset: () => void;
    getRaw: () => StackScreenOptionsInput | null;
    getResolved: () => StackScreenOptions | null;
}>;

/** Route focus that re-renders `useIsFocused` subscribers when a test moves it. */
export type RouteFocusStore = Readonly<{
    isFocused: () => boolean;
    setFocused: (focused: boolean) => void;
    subscribe: (listener: () => void) => () => void;
}>;

export type PreventRemoveCallback = (event: Readonly<{
    data: Readonly<{ action: unknown }>;
    repeat: () => void;
}>) => void;

export type ExpoRouterMockOptions = Readonly<{
    pathname?: ExpoRouterPathnameInput;
    params?: ExpoRouterParamsInput;
    segments?: ExpoRouterSegmentsInput;
    navigation?: unknown;
    /**
     * Route focus reported by `useIsFocused`. A function is read on every render; a
     * {@link RouteFocusStore} also re-renders subscribers when it changes.
     */
    isFocused?: boolean | (() => boolean) | RouteFocusStore;
    /** Receives every `usePreventRemove(preventRemove, callback)` registration. */
    onPreventRemove?: (preventRemove: boolean, callback: PreventRemoveCallback | undefined) => void;
    router?: Partial<{
        push: (value: unknown) => unknown;
        navigate: (value: unknown, options?: unknown) => unknown;
        back: () => unknown;
        replace: (value: unknown) => unknown;
        dismissTo: (value: unknown) => unknown;
        dismissAll: () => unknown;
        canDismiss: () => boolean;
        setParams: (value: ExpoRouterParams) => unknown;
    }>;
    stackOptionsCapture?: StackOptionsCapture;
}>;

type ExpoRouterMockRouter = {
    push: (value: unknown) => unknown;
    navigate: (value: unknown, options?: unknown) => unknown;
    back: () => unknown;
    replace: (value: unknown) => unknown;
    dismissTo: (value: unknown) => unknown;
    dismissAll: () => unknown;
    canDismiss: () => boolean;
    setParams: (value: ExpoRouterParams) => unknown;
};

type RouterMethod<TArgs extends unknown[], TResult> = (...args: TArgs) => TResult;

function isVitestMockFunction<TArgs extends unknown[], TResult>(
    value: RouterMethod<TArgs, TResult> | undefined,
): value is ReturnType<typeof vi.fn<RouterMethod<TArgs, TResult>>> {
    return typeof value === 'function' && 'mock' in value;
}

function createTrackedRouterMethod<TArgs extends unknown[], TResult>(
    providedMethod: RouterMethod<TArgs, TResult> | undefined,
): {
    method: RouterMethod<TArgs, TResult>;
    spy: ReturnType<typeof vi.fn<RouterMethod<TArgs, TResult>>>;
} {
    if (!providedMethod) {
        const spy = vi.fn<RouterMethod<TArgs, TResult>>();
        return {
            method: spy,
            spy,
        };
    }

    if (isVitestMockFunction(providedMethod)) {
        return {
            method: providedMethod,
            spy: providedMethod,
        };
    }

    const spy = vi.fn<RouterMethod<TArgs, TResult>>();
    return {
        method: ((...args: TArgs) => {
            spy(...args);
            return providedMethod(...args);
        }) as RouterMethod<TArgs, TResult>,
        spy,
    };
}

function resolveParamsInput(params: ExpoRouterParamsInput | undefined): ExpoRouterParams {
    const resolved = typeof params === 'function' ? params() : params;
    return { ...(resolved ?? {}) };
}

function resolveSegmentsInput(segments: ExpoRouterSegmentsInput | undefined): string[] {
    const resolved = typeof segments === 'function' ? segments() : segments;
    return [...(resolved ?? [])];
}

function resolvePathnameInput(pathname: ExpoRouterPathnameInput | undefined): string {
    const resolved = typeof pathname === 'function' ? pathname() : pathname;
    return resolved ?? '/';
}

function resolveIsFocusedInput(isFocused: ExpoRouterMockOptions['isFocused']): boolean {
    if (typeof isFocused === 'object') {
        return isFocused.isFocused();
    }
    const resolved = typeof isFocused === 'function' ? isFocused() : isFocused;
    return resolved ?? true;
}

function subscribeToNothing(): () => void {
    return () => {};
}

export function createRouteFocusStore(initialFocused = true): RouteFocusStore {
    let focused = initialFocused;
    const listeners = new Set<() => void>();

    return {
        isFocused: () => focused,
        setFocused: (nextFocused) => {
            focused = nextFocused;
            for (const listener of [...listeners]) {
                listener();
            }
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

function resolveStackScreenOptions(options: StackScreenOptionsInput | null): StackScreenOptions | null {
    if (!options) {
        return null;
    }
    return typeof options === 'function' ? options() : options;
}

export function createStackOptionsCapture(): StackOptionsCapture {
    let currentOptions: StackScreenOptionsInput | null = null;

    return {
        record(options) {
            currentOptions = options;
        },
        reset() {
            currentOptions = null;
        },
        getRaw() {
            return currentOptions;
        },
        getResolved() {
            return resolveStackScreenOptions(currentOptions);
        },
    };
}

export function createExpoRouterMock(options: ExpoRouterMockOptions = {}) {
    const trackedPush = createTrackedRouterMethod<[unknown], unknown>(options.router?.push);
    const trackedNavigate = createTrackedRouterMethod<[unknown, unknown?], unknown>(options.router?.navigate);
    const trackedBack = createTrackedRouterMethod<[], unknown>(options.router?.back);
    const trackedReplace = createTrackedRouterMethod<[unknown], unknown>(options.router?.replace);
    const trackedDismissTo = createTrackedRouterMethod<[unknown], unknown>(options.router?.dismissTo);
    const trackedDismissAll = createTrackedRouterMethod<[], unknown>(options.router?.dismissAll);
    const trackedSetParams = createTrackedRouterMethod<[ExpoRouterParams], unknown>(options.router?.setParams);
    const disablePreventRemove = vi.fn<() => void>();
    const subscribeToFocus = typeof options.isFocused === 'object' ? options.isFocused.subscribe : subscribeToNothing;
    const readFocus = () => resolveIsFocusedInput(options.isFocused);
    const useIsFocused = () => React.useSyncExternalStore(subscribeToFocus, readFocus, readFocus);
    const router = Object.assign(options.router ?? {}, {
        push: trackedPush.method,
        navigate: trackedNavigate.method,
        back: trackedBack.method,
        replace: trackedReplace.method,
        dismissTo: trackedDismissTo.method,
        dismissAll: trackedDismissAll.method,
        canDismiss: options.router?.canDismiss ?? (() => false),
        setParams: trackedSetParams.method,
    }) as ExpoRouterMockRouter;
    const spies = {
        push: trackedPush.spy,
        navigate: trackedNavigate.spy,
        back: trackedBack.spy,
        replace: trackedReplace.spy,
        dismissTo: trackedDismissTo.spy,
        dismissAll: trackedDismissAll.spy,
        setParams: trackedSetParams.spy,
        disablePreventRemove,
    };

    let paramsOverrides: ExpoRouterParams = {};
    const syncParams = () => {
        state.params = {
            ...resolveParamsInput(options.params),
            ...paramsOverrides,
        };
        return state.params;
    };
    const state = {
        get pathname() {
            return resolvePathnameInput(options.pathname);
        },
        params: {} as ExpoRouterParams,
        get segments() {
            return resolveSegmentsInput(options.segments);
        },
        navigation: options.navigation ?? null,
        router,
    };
    syncParams();
    const setParamsMock = (value: ExpoRouterParams) => {
        paramsOverrides = {
            ...paramsOverrides,
            ...value,
        };
        syncParams();
        return trackedSetParams.method(value);
    };
    state.router.setParams = setParamsMock as typeof state.router.setParams;
    spies.push.mockName('router.push');
    spies.navigate.mockName('router.navigate');
    spies.back.mockName('router.back');
    spies.replace.mockName('router.replace');
    spies.dismissTo.mockName('router.dismissTo');
    spies.dismissAll.mockName('router.dismissAll');
    spies.setParams.mockName('router.setParams');
    spies.disablePreventRemove.mockName('usePreventRemove.disablePrevention');

    return {
        state,
        spies,
        module: {
            Redirect: (props: Record<string, unknown>) => React.createElement('Redirect', props),
            Link: 'Link' as any,
            Slot: (props: Record<string, unknown>) => React.createElement('Slot', props),
            ThemeProvider: (props: { value?: unknown; children?: React.ReactNode }) =>
                React.createElement('ThemeProvider', { value: props.value }, props.children ?? null),
            DefaultTheme: { dark: false, colors: {}, fonts: {} },
            DarkTheme: { dark: true, colors: {}, fonts: {} },
            Stack: Object.assign(
                function Stack(props: { children?: React.ReactNode }) {
                    return React.createElement(React.Fragment, null, props.children ?? null);
                },
                {
                    Screen: (props: { options?: StackScreenOptionsInput }) => {
                        if (props.options) {
                            options.stackOptionsCapture?.record(props.options);
                        }
                        return React.createElement('StackScreen', props);
                    },
                },
            ),
            useRouter: () => state.router,
            useNavigation: () => state.navigation,
            useSegments: () => resolveSegmentsInput(options.segments),
            usePathname: () => resolvePathnameInput(options.pathname),
            useLocalSearchParams: () => syncParams(),
            useGlobalSearchParams: () => syncParams(),
            useIsFocused,
            // Like the real hook: runs while the route is focused and cleans up on blur.
            useFocusEffect: (effect: () => void | (() => void)) => {
                const focused = useIsFocused();
                React.useEffect(() => (focused ? effect() : undefined), [effect, focused]);
            },
            usePreventRemove: (preventRemove: boolean, callback?: PreventRemoveCallback) => {
                options.onPreventRemove?.(preventRemove, callback);
                return disablePreventRemove;
            },
            router: state.router,
        },
    };
}
