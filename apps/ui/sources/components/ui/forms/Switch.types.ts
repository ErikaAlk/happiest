import type { StyleProp, ViewStyle } from 'react-native';

/**
 * The Switch contract shared by every platform: `Switch.tsx` renders React Native's switch on iOS
 * and web, `Switch.android.tsx` renders the ColorOS UI kit switch natively. Screens import
 * `@/components/ui/forms/Switch` and only ever see these props.
 */
export type AppSwitchProps = Readonly<{
    value: boolean;
    /** Without it the switch only shows `value`. */
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
    /**
     * For dense rows. React Native's switch is scaled down; the ColorOS switch has a single
     * size (COUI 44×24dp), which is already the compact one.
     */
    compact?: boolean;
    accessibilityLabel?: string;
    testID?: string;
    style?: StyleProp<ViewStyle>;
}>;
