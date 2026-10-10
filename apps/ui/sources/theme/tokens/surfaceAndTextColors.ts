// 页面与测试环境共用设计库生成的颜色，不依赖 React Native 平台初始化。

import { CoTokens } from '../coloros/tokens.g';

export type ThemeTextColors = Readonly<{
    primary: string;
    secondary: string;
    tertiary: string;
    link: string;
    destructive: string;
    placeholder: string;
    disabled: string;
}>;

export type ThemeSurfaceColors = Readonly<{
    base: string;
    inset: string;
    elevated: string;
    ripple: string;
    pressed: string;
    selected: string;
    pressedOverlay: string;
    sectionTint: string;
}>;

export const lightTextColors: ThemeTextColors = {
    primary: CoTokens.color.label1.light,
    secondary: CoTokens.color.label1Variant.light,
    tertiary: CoTokens.color.label2.light,
    link: CoTokens.color.primaryText.light,
    destructive: '#FF3B30',
    placeholder: CoTokens.color.label2Variant.light,
    disabled: CoTokens.color.label3.light,
};

export const darkTextColors: ThemeTextColors = {
    primary: CoTokens.color.label1.dark,
    secondary: CoTokens.color.label2.dark,
    tertiary: CoTokens.color.label2.dark,
    link: CoTokens.color.primaryText.dark,
    destructive: '#EE6E6C',
    placeholder: CoTokens.color.label2Variant.dark,
    disabled: CoTokens.color.label3.dark,
};

export const lightSurfaceColors: ThemeSurfaceColors = {
    base: CoTokens.color.surface.light,
    inset: CoTokens.color.bgGrouped.light,
    elevated: CoTokens.color.surfaceGrouped.light,
    ripple: CoTokens.color.press.light,
    pressed: CoTokens.color.cardPressed.light,
    selected: CoTokens.color.fillSolid.light,
    pressedOverlay: CoTokens.color.hover.light,
    sectionTint: CoTokens.color.fill4.light,
};

export const darkSurfaceColors: ThemeSurfaceColors = {
    base: CoTokens.color.surface.dark,
    inset: CoTokens.color.bgGrouped.dark,
    elevated: CoTokens.color.surfaceTop.dark,
    ripple: CoTokens.color.press.dark,
    pressed: CoTokens.color.fillSolid.dark,
    selected: CoTokens.color.fillSolid.dark,
    pressedOverlay: CoTokens.color.hover.dark,
    sectionTint: CoTokens.color.fill4.dark,
};
