// Vitest/node stub for `expo-router`.
// The real package imports React Native internals (`react-native/Libraries/...`) in its native entrypoints.

import * as React from 'react';

export const Link = 'Link' as any;

export function Stack(props: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, props.children ?? null);
}

Stack.Screen = 'StackScreen' as any;

export function useRouter() {
    return {
        push: () => {},
        back: () => {},
        replace: () => {},
        setParams: () => {},
    };
}

export function useSegments(): string[] {
    return [];
}

export function usePathname(): string {
    return '/';
}

export function useLocalSearchParams(): Record<string, string | string[] | undefined> {
    return {};
}

export function useGlobalSearchParams(): Record<string, string | string[] | undefined> {
    return {};
}

export function useIsFocused(): boolean {
    return true;
}

export function useFocusEffect(effect: () => void | (() => void)): void {
    React.useEffect(() => effect(), [effect]);
}

export function usePreventRemove(
    _preventRemove: boolean,
    _callback?: (event: { data: { action: unknown }; repeat: () => void }) => void,
): () => void {
    return () => {};
}

export function ThemeProvider(props: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, props.children ?? null);
}

export const DefaultTheme = { dark: false, colors: {}, fonts: {} };
export const DarkTheme = { dark: true, colors: {}, fonts: {} };

export const router = useRouter();
