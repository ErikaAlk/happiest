import { UnistylesRuntime } from 'react-native-unistyles';

import { readReducedMotionPreference } from '@/hooks/ui/useReducedMotionPreference';
import { storage } from '@/sync/domains/state/storage';

/**
 * The app state every ColorOS native control renders against. The native side has no view of the
 * app's theme, its in-app text scale or its reduced-motion preference, so each control receives
 * them as props: views through `useColorOsHostEnvironment`, imperative dialogs through
 * `readColorOsHostEnvironment`, both reading the same owners.
 */
export type ColorOsHostEnvironment = Readonly<{
    dark: boolean;
    /** The in-app text scale; the native side multiplies it onto the system font scale, as `Text` does. */
    fontScale: number;
    reduceMotion: boolean;
}>;

/** The current values for imperative callers outside React (native alerts). */
export function readColorOsHostEnvironment(): ColorOsHostEnvironment {
    return {
        dark: UnistylesRuntime.getTheme().dark,
        fontScale: storage.getState().localSettings.uiFontScale,
        reduceMotion: readReducedMotionPreference(),
    };
}
