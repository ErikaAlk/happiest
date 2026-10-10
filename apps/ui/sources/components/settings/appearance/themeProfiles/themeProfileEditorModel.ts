import { resolveThemeProfile } from '@/theme/profiles/resolveThemeProfile';
import { readThemeProfilePathValue } from '@/theme/profiles/themeProfilePathAccess';
import { THEME_PROFILE_TOKEN_DEFINITIONS, type ThemeProfileTokenDefinition } from '@/theme/profiles/themeProfileTokenRegistry';
import type { ThemeProfileMode, ThemeProfileV1 } from '@/theme/profiles/themeProfileTypes';
import { parseThemeColor, themeContrastRatioOverLayers } from '@/theme/themeContrastMath';

export type ThemeProfileTokenGroupModel = Readonly<{
    group: string;
    tokens: readonly ThemeProfileTokenDefinition[];
}>;

export const buildThemeProfileTokenGroups = (): readonly ThemeProfileTokenGroupModel[] => {
    const groups = new Map<string, ThemeProfileTokenDefinition[]>();
    for (const token of THEME_PROFILE_TOKEN_DEFINITIONS) {
        const existing = groups.get(token.group) ?? [];
        existing.push(token);
        groups.set(token.group, existing);
    }
    return Array.from(groups.entries()).map(([group, tokens]) => ({ group, tokens }));
};

export const readDraftTokenValue = (
    profile: ThemeProfileV1,
    mode: ThemeProfileMode,
    token: ThemeProfileTokenDefinition,
): string => {
    const theme = resolveThemeProfile({ mode, profile });
    return readThemeProfilePathValue(theme.colors, token.path) ?? profile.overrides[mode][token.id] ?? '';
};

export const getThemeProfileContrastWarnings = (
    profile: ThemeProfileV1,
    mode: ThemeProfileMode,
    token: ThemeProfileTokenDefinition,
): readonly string[] => {
    if (!token.contrastPairs?.length) return [];
    const rawValue = readDraftTokenValue(profile, mode, token);
    if (!rawValue) return [];
    const value = parseThemeColor(rawValue);
    const canvas = resolveThemeProfile({ mode, profile }).colors.background.canvas;

    const warnings: string[] = [];
    for (const pair of token.contrastPairs) {
        const pairToken = THEME_PROFILE_TOKEN_DEFINITIONS.find((definition) => definition.id === pair.tokenId);
        if (!pairToken) continue;
        const pairValue = readDraftTokenValue(profile, mode, pairToken);
        if (!pairValue) continue;
        if (themeContrastRatioOverLayers(value, [canvas, pairValue]) < pair.minRatio) {
            warnings.push(pair.tokenId);
        }
    }
    return warnings;
};

export const getThemeProfileRecentColors = (profile: ThemeProfileV1): readonly string[] => {
    const colors: string[] = [];
    for (const mode of ['light', 'dark'] as const) {
        for (const value of Object.values(profile.overrides[mode])) {
            if (!colors.includes(value)) {
                colors.unshift(value);
            }
        }
    }
    return colors.slice(0, 8);
};
