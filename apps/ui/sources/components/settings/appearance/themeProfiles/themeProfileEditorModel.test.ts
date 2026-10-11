import { expect, it } from 'vitest';
import { THEME_PROFILE_TOKEN_DEFINITIONS } from '@/theme/profiles/themeProfileTokenRegistry';
import type { ThemeProfileV1 } from '@/theme/profiles/themeProfileTypes';
import { getThemeProfileContrastWarnings } from './themeProfileEditorModel';

it('warns when transparent foreground loses contrast on the resolved surface', () => {
    const profile: ThemeProfileV1 = {
        schemaVersion: 1, id: 'contrast', name: '透明文字', createdAt: '2026-10-08', updatedAt: '2026-10-08',
        base: { light: 'light', dark: 'dark' },
        overrides: { light: { 'text.primary': '#0000001A' }, dark: {} },
    };
    const token = THEME_PROFILE_TOKEN_DEFINITIONS.find((entry) => entry.id === 'text.primary');
    if (!token) throw new Error('text.primary token missing');
    expect(getThemeProfileContrastWarnings(profile, 'light', token)).toContain('surface.base');
});
