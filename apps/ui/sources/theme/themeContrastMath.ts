// WCAG 对比度计算共用入口，按绘制顺序合成背景和文字的透明度。

import Color from 'color';

export type ThemeContrastColor = Readonly<{ r: number; g: number; b: number; a: number }>;

export function parseThemeColor(value: string): ThemeContrastColor {
    const color = Color(value.trim());
    return {
        r: color.red(),
        g: color.green(),
        b: color.blue(),
        a: color.alpha(),
    };
}

export function compositeThemeColorOver(source: ThemeContrastColor, backdrop: ThemeContrastColor): ThemeContrastColor {
    return {
        r: source.a * source.r + (1 - source.a) * backdrop.r,
        g: source.a * source.g + (1 - source.a) * backdrop.g,
        b: source.a * source.b + (1 - source.a) * backdrop.b,
        a: 1,
    };
}

export function withThemeColorOpacity(color: ThemeContrastColor, opacity: number): ThemeContrastColor {
    return { ...color, a: color.a * opacity };
}

/**
 * Contrast of ink that a `View`-level `opacity` has faded into the surface behind it.
 *
 * This exists because the naive form — reduce the alpha and take the ratio — silently returns the
 * UNDIMMED figure: relative luminance has no alpha term, so the fade has to be composited first.
 * That mistake makes the `opacity: pressed ? 0.7 : 1` idiom look compliant, which is precisely the
 * measurement this repo needs to get right.
 */
export function themeContrastRatioForFadedInk(params: Readonly<{
    ink: ThemeContrastColor;
    opacity: number;
    backdrop: ThemeContrastColor;
}>): number {
    const faded = compositeThemeColorOver(
        withThemeColorOpacity(params.ink, params.opacity),
        params.backdrop,
    );
    return themeContrastRatio(faded, params.backdrop);
}

/** WCAG 2.x relative luminance. */
export function themeColorRelativeLuminance(color: ThemeContrastColor): number {
    const channel = (value: number): number => {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function themeContrastRatio(left: ThemeContrastColor, right: ThemeContrastColor): number {
    const leftLuminance = themeColorRelativeLuminance(left);
    const rightLuminance = themeColorRelativeLuminance(right);
    const lighter = Math.max(leftLuminance, rightLuminance);
    const darker = Math.min(leftLuminance, rightLuminance);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Ratio of `ink` against a stack of layers painted back-to-front, e.g.
 * `['#ffffff', 'rgba(52,199,89,0.12)']` = a success tint on the base surface.
 */
export function themeContrastRatioOverLayers(ink: ThemeContrastColor, layers: readonly string[]): number {
    let backdrop: ThemeContrastColor | null = null;
    for (const layer of layers) {
        const parsed = parseThemeColor(layer);
        backdrop = backdrop === null ? parsed : compositeThemeColorOver(parsed, backdrop);
    }
    if (backdrop === null) {
        throw new Error('themeContrastRatioOverLayers needs at least one backdrop layer');
    }
    return themeContrastRatio(compositeThemeColorOver(ink, backdrop), backdrop);
}
