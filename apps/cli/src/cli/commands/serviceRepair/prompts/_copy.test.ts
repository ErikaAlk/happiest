import { describe, expect, it } from 'vitest';

import type {
  AuthExpiredForActiveProfile,
  AuthMissingForProfile,
  AutomaticStartupEntry,
  AutomaticStartupLaneMismatch,
  AutomaticStartupLegacyPinnedCurrentServer,
} from '@/diagnostics/doctorRepair';

import {
  copyAuthExpiredForActiveProfile,
  copyAuthMissingForProfile,
  copyLaneMismatch,
  copyLegacyPinnedCurrentServer,
  copyNoServersConfigured,
} from './_copy';

function makeEntry(
  overrides: Partial<AutomaticStartupEntry> = {},
): AutomaticStartupEntry {
  return {
    serverId: 'default',
    name: 'Default automatic startup',
    releaseChannel: 'preview',
    ringId: 'preview',
    mode: 'user',
    targetMode: 'pinned',
    relayUrl: 'https://api.happier.dev',
    running: true,
    configuredCliVersion: '0.2.6-preview.1.1',
    runningCliVersion: '0.2.6-preview.1.1',
    path: '/tmp/happier-home/Library/LaunchAgents/com.happier.default.preview.plist',
    happierHomeDir: '/tmp/happier-home',
    isForeignHome: false,
    installedDefinitionMatchesExpected: true,
    isLegacyChannelScoped: false,
    ...overrides,
  };
}

describe('serviceRepair prompt copy', () => {
  it('mentions the selected channel in lane-mismatch move question', () => {
    const finding: AutomaticStartupLaneMismatch = {
      kind: 'automatic_startup_lane_mismatch',
      severity: 'warning',
      autoApplyWithoutPrompt: false,
      existing: [makeEntry()],
      targetReleaseChannel: 'dev',
    };
    const copy = copyLaneMismatch(finding, { releaseChannel: 'dev', version: '0.2.6-dev.2.1' });
    expect(copy.question).toBe('Move the auto-starting background service to the dev channel?');
    expect(copy.body).toContain('CLI you just installed:      dev • 0.2.6-dev.2.1');
    expect(copy.body).toContain('Auto-starting service is on: preview • 0.2.6-preview.1.1');
  });

  it('explains default-following and includes channel in legacy-pinned question', () => {
    const finding: AutomaticStartupLegacyPinnedCurrentServer = {
      kind: 'automatic_startup_legacy_pinned_current_server',
      severity: 'warning',
      autoApplyWithoutPrompt: false,
      entry: makeEntry(),
    };
    const copy = copyLegacyPinnedCurrentServer(finding, {
      releaseChannel: 'dev',
      version: '0.2.6-dev.2.1',
    });
    expect(copy.question).toBe(
      'Switch this auto-starting background service to the default-following setup on dev?',
    );
    expect(copy.body).toContain('The current recommendation is a dynamic (default-following) setup that follows');
    expect(copy.body).toContain("whichever server you're using, so you don't have to reinstall it when you switch servers.");
    expect(copy.body).toContain('CLI you just installed:      dev • 0.2.6-dev.2.1');
    expect(copy.body).toContain('Auto-starting service is on: preview • 0.2.6-preview.1.1');
  });

  it('prints an executable sign-in command for an expired active profile', () => {
    const finding: AuthExpiredForActiveProfile = {
      kind: 'auth_expired_for_active_profile',
      severity: 'warning',
      autoApplyWithoutPrompt: false,
      serverId: 'cloud',
      serverName: 'Cloud',
      serverUrl: 'https://api.happier.dev',
    };
    const copy = copyAuthExpiredForActiveProfile(finding, 'happiest-dev');

    // `happiest auth` alone only prints help; the remedy must be the parsed
    // `auth login` form so the printed command actually runs.
    expect(copy).toContain('  happiest-dev auth login');
    expect(copy).not.toContain('  happiest-dev auth\n');
  });

  it('prints the same executable sign-in command the doctor report renders', () => {
    const finding: AuthMissingForProfile = {
      kind: 'auth_missing_for_profile',
      severity: 'warning',
      autoApplyWithoutPrompt: false,
      serverId: 'company',
      serverName: 'Company',
      serverUrl: 'https://relay.company.test',
    };
    const copy = copyAuthMissingForProfile(finding, 'happiest-dev');

    expect(copy).toContain('  happiest-dev auth login --server company');
    expect(copy).not.toContain('happiest-dev auth --server company');
  });

  it('points a computer with no server profile at setup and server add', () => {
    const copy = copyNoServersConfigured('happiest-dev');

    expect(copy).toContain('  happiest-dev setup');
    expect(copy).toContain('  happiest-dev server add --server-url <url> --use');
  });
});
