import { useUnistyles } from 'react-native-unistyles';

import { useReducedMotionPreference } from '@/hooks/ui/useReducedMotionPreference';
import { useLocalSetting } from '@/sync/store/hooks';

import type { ColorOsHostEnvironment } from './colorOsHostEnvironment';

/** The host environment for ColorOS native views, subscribed to the same owners the reader uses. */
export function useColorOsHostEnvironment(): ColorOsHostEnvironment {
    const { theme } = useUnistyles();
    const fontScale = useLocalSetting('uiFontScale');
    const reduceMotion = useReducedMotionPreference();
    return { dark: theme.dark, fontScale, reduceMotion };
}
