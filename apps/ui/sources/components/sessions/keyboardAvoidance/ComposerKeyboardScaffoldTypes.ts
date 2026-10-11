import type * as React from 'react';
import type {
    AccessibilityRole,
    StyleProp,
    ViewProps,
    ViewStyle,
} from 'react-native';

export type ComposerKeyboardScaffoldMode = 'session' | 'newSession';

/**
 * Whether the scaffold paints its own ground.
 *
 * `opaque` (the default) fills the root and the composer wrapper with the session page canvas or
 * the new-session sheet surface. `transparent` paints neither, so a screen presented as a
 * transparent modal can show what is behind it.
 *
 * This is deliberately NOT derived from `mode`: the new-session wizard is also `newSession` and
 * keeps its opaque sheet.
 */
export type ComposerKeyboardScaffoldSurface = 'opaque' | 'transparent';

export type ComposerKeyboardScaffoldProps = Readonly<{
    accessibilityLabel?: string;
    accessibilityRole?: AccessibilityRole;
    children: React.ReactNode;
    composer: React.ReactNode;
    composerTestID?: string;
    contentProps?: ViewProps;
    contentStyle?: StyleProp<ViewStyle>;
    contentTestID?: string;
    headerHeight?: number;
    keyboardLiftSuppressed?: boolean;
    layoutBottomInset?: number;
    mode: ComposerKeyboardScaffoldMode;
    safeAreaTop?: number;
    safeAreaBottom?: number;
    style?: StyleProp<ViewStyle>;
    /** Defaults to `opaque`. See `ComposerKeyboardScaffoldSurface`. */
    surface?: ComposerKeyboardScaffoldSurface;
    testID?: string;
}>;
