import { requireNativeModule, requireNativeView } from 'expo';
import type { ReactNode } from 'react';
import type { ColorValue, NativeSyntheticEvent, StyleProp, ViewProps, ViewStyle } from 'react-native';

import type { ColorOsHostEnvironment } from './colorOsHostEnvironment';

/**
 * Native views of the local `happiest-coloros-ui` module (Android only). Each one hosts a ColorOS UI
 * kit Compose control and reports its measured size to React Native layout. Only `.android.tsx`
 * control implementations import this file.
 *
 * Slot content (icons, custom trailing views) is passed as React children wrapped in `ColorOsSlot`;
 * each view documents the order it reads them in.
 */
type ColorOsNativeViewProps = ColorOsHostEnvironment & Readonly<{
    /** Read by the Compose control's semantics; RN's own `accessibilityLabel` would label the host view instead. */
    accessibilityText?: string;
    /** Applied by React Native to the host view, so hiding it hides the control's semantics too. */
    importantForAccessibility?: ViewProps['importantForAccessibility'];
    accessibilityElementsHidden?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
    children?: ReactNode;
}>;

type EmptyEvent = NativeSyntheticEvent<Record<string, never>>;

const MODULE_NAME = 'HappiestColorOsUi';

export type CoSwitchNativeProps = ColorOsNativeViewProps & Readonly<{
    checked: boolean;
    enabled: boolean;
    /** False shows the value without taking input (the kit's display-only switch). */
    interactive: boolean;
    onStateDescription: string;
    offStateDescription: string;
    onCheckedChange: (event: NativeSyntheticEvent<{ checked: boolean }>) => void;
}>;
export const CoSwitchNative = requireNativeView<CoSwitchNativeProps>(MODULE_NAME, 'CoSwitchView');

export type CoCheckBoxNativeProps = ColorOsNativeViewProps & Readonly<{
    checked: boolean;
    enabled: boolean;
}>;
export const CoCheckBoxNative = requireNativeView<CoCheckBoxNativeProps>(MODULE_NAME, 'CoCheckBoxView');

export type CoSeekBarNativeProps = ColorOsNativeViewProps & Readonly<{
    /** 0..1. */
    value: number;
    steps: number;
    enabled: boolean;
    /** The value as a screen reader speaks it; omitted speaks the 0..1 position as a percentage. */
    valueText?: string;
    onValueChange: (event: NativeSyntheticEvent<{ value: number }>) => void;
    onValueChangeFinished?: (event: EmptyEvent) => void;
}>;
export const CoSeekBarNative = requireNativeView<CoSeekBarNativeProps>(MODULE_NAME, 'CoSeekBarView');

export type CoProgressBarNativeProps = ColorOsNativeViewProps & Readonly<{
    /** 0..1. */
    value: number;
    /** Bar height in dp; omitted uses the kit's height. */
    barHeight?: number;
    /** Fill colour; omitted uses the theme colour. */
    color?: ColorValue;
}>;
export const CoProgressBarNative = requireNativeView<CoProgressBarNativeProps>(MODULE_NAME, 'CoProgressBarView');

export type CoLoadingNativeProps = ColorOsNativeViewProps & Readonly<{
    large: boolean;
    /** False keeps the ring visible but stops it turning. */
    animating: boolean;
}>;
export const CoLoadingNative = requireNativeView<CoLoadingNativeProps>(MODULE_NAME, 'CoLoadingView');

export type CoRedDotNativeProps = ColorOsNativeViewProps & Readonly<{
    /** Omitted draws the plain dot. */
    count?: number;
}>;
export const CoRedDotNative = requireNativeView<CoRedDotNativeProps>(MODULE_NAME, 'CoRedDotView');

/** Children: the image (when `hasImage`). */
export type CoEmptyStateNativeProps = ColorOsNativeViewProps & Readonly<{
    title: string;
    subtitle?: string;
    actionText?: string;
    hasImage: boolean;
    onAction: (event: EmptyEvent) => void;
}>;
export const CoEmptyStateNative = requireNativeView<CoEmptyStateNativeProps>(MODULE_NAME, 'CoEmptyStateView');

/** Children: the icon (when `hasIcon`), tinted by the kit. */
export type CoFloatingButtonNativeProps = ColorOsNativeViewProps & Readonly<{
    enabled: boolean;
    hasIcon: boolean;
    onPress: (event: EmptyEvent) => void;
}>;
export const CoFloatingButtonNative = requireNativeView<CoFloatingButtonNativeProps>(MODULE_NAME, 'CoFloatingButtonView');

export type CoCardPosition = 'head' | 'middle' | 'tail' | 'full';
export type CoListItemTrailing = 'none' | 'arrow' | 'status' | 'switch' | 'custom';

/** Children in order: the leading icon (when `hasLeading`), then the custom trailing view (when `trailing` is `custom`). */
export type CoListItemNativeProps = ColorOsNativeViewProps & Readonly<{
    title: string;
    summary?: string;
    position: CoCardPosition;
    trailing: CoListItemTrailing;
    statusText?: string;
    trailingArrow: boolean;
    switchChecked: boolean;
    hasLeading: boolean;
    enabled: boolean;
    selected: boolean;
    destructive: boolean;
    showDivider: boolean;
    pressable: boolean;
    longPressable: boolean;
    onPress: (event: EmptyEvent) => void;
    onLongPress: (event: EmptyEvent) => void;
    onSwitchChange: (event: NativeSyntheticEvent<{ checked: boolean }>) => void;
}>;
export const CoListItemNative = requireNativeView<CoListItemNativeProps>(MODULE_NAME, 'CoListItemView');

export type CoCategoryTextNativeProps = ColorOsNativeViewProps & Readonly<{ text: string }>;
export const CoCategoryTitleNative = requireNativeView<CoCategoryTextNativeProps>(MODULE_NAME, 'CoCategoryTitleView');
export const CoCategoryFooterNative = requireNativeView<CoCategoryTextNativeProps>(MODULE_NAME, 'CoCategoryFooterView');

export type CoButtonType = 'primary' | 'secondary' | 'transparent' | 'outline' | 'text';

/** Children in order: the leading icon (when `hasLeading`), then the trailing icon (when `hasTrailing`). */
export type CoButtonNativeProps = ColorOsNativeViewProps & Readonly<{
    text: string;
    buttonType: CoButtonType;
    size: 'large' | 'small';
    enabled: boolean;
    loading: boolean;
    loadingDescription: string;
    textColor?: ColorValue;
    /** Width follows React Native layout; otherwise the button hugs its content. */
    fillWidth: boolean;
    hasLeading: boolean;
    hasTrailing: boolean;
    onPress: (event: EmptyEvent) => void;
}>;
export const CoButtonNative = requireNativeView<CoButtonNativeProps>(MODULE_NAME, 'CoButtonView');

export type CoNavigationItem = Readonly<{
    label: string;
    enabled: boolean;
    badgeCount?: number;
    badgeDot: boolean;
}>;

/**
 * Children in order: two icons per item — the outline glyph, then the filled one the kit fades to while
 * the item is selected — then the end accessory's icon.
 */
export type CoNavigationBarNativeProps = ColorOsNativeViewProps & Readonly<{
    items: ReadonlyArray<CoNavigationItem>;
    selectedIndex: number;
    showLabels: boolean;
    size: 'compact' | 'regular' | 'large';
    /** The end accessory's accessible name; omitted draws no accessory. */
    endAccessoryDescription?: string;
    /** Not `onSelect`: React Native registers `topSelect` as a bubbling event, and these are direct events. */
    onItemSelect: (event: NativeSyntheticEvent<{ index: number }>) => void;
    onEndAccessory: (event: EmptyEvent) => void;
}>;
export const CoNavigationBarNative = requireNativeView<CoNavigationBarNativeProps>(MODULE_NAME, 'CoNavigationBarView');

export type CoBarAction = Readonly<{
    contentDescription: string;
    /** A text key; omitted draws an icon button whose icon is the next child. */
    text?: string;
    enabled: boolean;
}>;

/** Children in order: the icon of each action without `text`. */
export type CoTopBarNativeProps = ColorOsNativeViewProps & Readonly<{
    title: string;
    /** The back key's accessible name; omitted draws no back key. */
    backDescription?: string;
    actions: ReadonlyArray<CoBarAction>;
    onBack: (event: EmptyEvent) => void;
    onAction: (event: NativeSyntheticEvent<{ index: number }>) => void;
}>;
export const CoTopBarNative = requireNativeView<CoTopBarNativeProps>(MODULE_NAME, 'CoTopBarView');

export type CoAlertButtonRole = 'normal' | 'recommended' | 'danger';

type HappiestColorOsUiModule = Readonly<{
    /** Resolves with the pressed button index, or -1 when dismissed from the scrim or back key. */
    showAlert: (options: ColorOsHostEnvironment & Readonly<{
        title?: string;
        message?: string;
        buttons: ReadonlyArray<Readonly<{ text: string; role: CoAlertButtonRole }>>;
        dismissible: boolean;
    }>) => Promise<number>;
}>;

export const ColorOsUiModule = requireNativeModule<HappiestColorOsUiModule>(MODULE_NAME);
