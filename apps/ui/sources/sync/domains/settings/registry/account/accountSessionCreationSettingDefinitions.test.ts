import { describe, expect, it } from 'vitest';
import { settingsParse, applySettings } from '@/sync/domains/settings/settings';

import {
    ACCOUNT_SESSION_CREATION_SETTING_DEFINITIONS,
    resolveNewSessionWizardSectionPresentation,
} from '@/sync/domains/settings/registry/account/accountSessionCreationSettingDefinitions';

describe('account session creation setting definitions', () => {
    it('keeps old settings visible and preserves hidden options when another setting changes', () => {
        const previous = settingsParse({ schemaVersion: 8 });
        expect(previous.newSessionHiddenOptionsV1).toEqual([]);
        const hidden = applySettings(previous, { newSessionHiddenOptionsV1: ['machine', 'models', 'providerOption'] });
        const reloaded = settingsParse(JSON.parse(JSON.stringify(hidden)));
        const updated = applySettings(reloaded, { newSessionWizardColumnsEnabled: true });
        expect(updated.newSessionHiddenOptionsV1).toEqual(['machine', 'models', 'providerOption']);
        expect(ACCOUNT_SESSION_CREATION_SETTING_DEFINITIONS.newSessionHiddenOptionsV1.storageScope).toBe('account');
    });

    it('resumes the previous ordinary-entry draft by default from an account-synced preference', () => {
        const definition = ACCOUNT_SESSION_CREATION_SETTING_DEFINITIONS.newSessionDraftEntryMode;

        expect(definition.default).toBe('resumePrevious');
        expect(definition.storageScope).toBe('account');
        expect(definition.schema.parse('alwaysFresh')).toBe('alwaysFresh');
        expect(definition.schema.safeParse('recentDraft').success).toBe(false);
    });

    it('defaults new-session wizard section presentation overrides to auto', () => {
        expect(ACCOUNT_SESSION_CREATION_SETTING_DEFINITIONS.newSessionWizardSectionPresentationV1.default).toEqual({});
        expect(resolveNewSessionWizardSectionPresentation({}, 'models')).toBe('auto');
    });

    it('defaults the new-session wizard column layout preference to disabled', () => {
        expect(ACCOUNT_SESSION_CREATION_SETTING_DEFINITIONS.newSessionWizardColumnsEnabled.default).toBe(false);
    });

    it('defaults new sessions to the selected folder', () => {
        expect(ACCOUNT_SESSION_CREATION_SETTING_DEFINITIONS.newSessionDefaultCheckoutModeV1.default).toBe('current_path');
    });

    it('keeps valid wizard presentation overrides and drops unknown section or presentation values', () => {
        const schema = ACCOUNT_SESSION_CREATION_SETTING_DEFINITIONS.newSessionWizardSectionPresentationV1.schema;
        const parsed = schema.parse({
            models: 'dropdown',
            machines: 'list',
            unknown: 'dropdown',
            paths: 'grid',
        });

        expect(parsed).toEqual({
            models: 'dropdown',
            machines: 'list',
        });
    });
});
