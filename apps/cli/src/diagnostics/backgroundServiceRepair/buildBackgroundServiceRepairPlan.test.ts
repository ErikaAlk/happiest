import { describe, expect, it } from 'vitest';

import { buildBackgroundServiceRepairPlan } from './buildBackgroundServiceRepairPlan';

describe('buildBackgroundServiceRepairPlan', () => {
  it('migrates only the current-server pinned current-channel service to one default background service', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentServerId: 'company',
      preferredMode: 'user',
      services: [{
        serverId: 'company',
        name: 'Company',
        installed: true,
        path: '/tmp/happiest-daemon.preview.company.service',
        platform: 'linux',
        mode: 'user',
        releaseChannel: 'preview',
        label: 'happiest-daemon.preview.company',
        targetMode: 'pinned',
      }, {
        serverId: 'sidecar',
        name: 'Sidecar',
        installed: true,
        path: '/tmp/happiest-daemon.preview.sidecar.service',
        platform: 'linux',
        mode: 'user',
        releaseChannel: 'preview',
        label: 'happiest-daemon.preview.sidecar',
        targetMode: 'pinned',
      }],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon.preview.company',
          mode: 'user',
          targetMode: 'pinned',
          releaseChannel: 'preview',
        }),
      }),
      expect.objectContaining({
        kind: 'install-default-following-service',
        releaseChannel: 'preview',
        mode: 'user',
      }),
    ]);
  });

  it('keeps one compatible default background service without removing unrelated pinned services', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'stable',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default',
        name: 'Default background service',
        installed: true,
        path: '/tmp/happiest-daemon.default.service',
        platform: 'linux',
        mode: 'user',
        releaseChannel: 'stable',
        label: 'happiest-daemon.default',
        targetMode: 'default-following',
      }, {
        serverId: 'company',
        name: 'Company',
        installed: true,
        path: '/tmp/happiest-daemon.company.service',
        platform: 'linux',
        mode: 'user',
        releaseChannel: 'stable',
        label: 'happiest-daemon.company',
        targetMode: 'pinned',
      }],
    });

    expect(plan.actions).toEqual([]);
  });

  it('reinstalls the compatible default service when its definition does not match the expected contents', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'stable',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default',
        name: 'Default background service',
        installed: true,
        path: '/tmp/happiest-daemon.default.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'stable',
        label: 'happiest-daemon.default',
        targetMode: 'default-following',
        installedDefinitionMatchesExpected: false,
      }],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'install-default-following-service',
        releaseChannel: 'stable',
        mode: 'user',
      }),
    ]);
  });

  it('removes other same-home services once a compatible default service exists', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentHappierHomeDir: '/home/test/.happier',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default',
        name: 'Default background service',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.default.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'preview',
        label: 'happiest-daemon.default',
        targetMode: 'default-following',
      }, {
        serverId: 'legacyPinned',
        name: 'Legacy pinned',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.legacyPinned.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'stable',
        label: 'happiest-daemon.legacyPinned',
        targetMode: 'pinned',
      }],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon.legacyPinned',
          mode: 'user',
          targetMode: 'pinned',
          releaseChannel: 'stable',
        }),
      }),
    ]);
  });

  it('keeps the preferred-mode compatible default service and removes the duplicate from the other mode', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'stable',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default',
        name: 'Default background service',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.default.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'stable',
        label: 'happiest-daemon.default',
        targetMode: 'default-following',
      }, {
        serverId: 'default',
        name: 'Default background service',
        installed: true,
        path: '/etc/systemd/system/happiest-daemon.default.service',
        platform: 'linux',
        mode: 'system',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'stable',
        label: 'happiest-daemon.default',
        targetMode: 'default-following',
      }],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon.default',
          mode: 'system',
          targetMode: 'default-following',
          releaseChannel: 'stable',
        }),
      }),
    ]);
  });

  it('prefers the canonical default service when same-mode compatible duplicates exist', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default-copy',
        name: 'Default background service',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.default-copy.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'preview',
        label: 'happiest-daemon.default-copy',
        targetMode: 'default-following',
      }, {
        serverId: 'default',
        name: 'Default background service',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.default.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'preview',
        label: 'happiest-daemon.default',
        targetMode: 'default-following',
      }],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon.default-copy',
          mode: 'user',
          targetMode: 'default-following',
          releaseChannel: 'preview',
        }),
      }),
    ]);
  });

  it('keeps the unscoped canonical default service over legacy channel-scoped default units', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default',
        name: 'Legacy preview default background service',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.preview.default.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'preview',
        label: 'happiest-daemon.preview.default',
        targetMode: 'default-following',
      }, {
        serverId: 'default',
        name: 'Canonical default background service',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.default.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'preview',
        label: 'happiest-daemon.default',
        targetMode: 'default-following',
      }],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon.preview.default',
          mode: 'user',
          targetMode: 'default-following',
          releaseChannel: 'preview',
        }),
      }),
    ]);
  });

  it('migrates a raw legacy daemon service to the canonical default service', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentHappierHomeDir: '/home/test/.happier',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default',
        name: 'Legacy default background service',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'preview',
        label: 'happiest-daemon',
        targetMode: 'default-following',
        installedDefinitionMatchesExpected: false,
      }],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon',
          installedPath: '/home/test/.config/systemd/user/happiest-daemon.service',
          mode: 'user',
          targetMode: 'default-following',
          releaseChannel: 'preview',
        }),
      }),
      expect.objectContaining({
        kind: 'install-default-following-service',
        releaseChannel: 'preview',
        mode: 'user',
      }),
    ]);
  });

  it('migrates a stale default-following service from another release channel to the current default service', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentHappierHomeDir: '/home/test/.happier',
      currentServerId: 'stack-a',
      preferredMode: 'user',
      services: [{
        serverId: 'stack-a',
        name: 'Preview background service',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.default.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'stable',
        label: 'happiest-daemon.default',
        targetMode: 'default-following',
      }],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon.default',
          installedPath: '/home/test/.config/systemd/user/happiest-daemon.default.service',
          mode: 'user',
          targetMode: 'default-following',
          releaseChannel: 'stable',
        }),
      }),
      expect.objectContaining({
        kind: 'install-default-following-service',
        releaseChannel: 'preview',
        mode: 'user',
      }),
    ]);
  });

  it('repairs a foreign-home default service while migrating current-server pinned services', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentHappierHomeDir: '/home/test/.happier',
      currentServerId: 'stack-a',
      preferredMode: 'user',
      services: [{
        serverId: 'stack-a',
        name: 'Pinned current server',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.preview.stack-a.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'preview',
        label: 'happiest-daemon.preview.stack-a',
        targetMode: 'pinned',
      }, {
        serverId: 'default',
        name: 'Foreign default background service',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.default.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/other/.happier',
        releaseChannel: 'preview',
        label: 'happiest-daemon.default',
        targetMode: 'default-following',
      }],
    });

    expect(plan.manualWarnings).toEqual([]);
    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon.default',
          installedPath: '/home/test/.config/systemd/user/happiest-daemon.default.service',
          mode: 'user',
          targetMode: 'default-following',
          releaseChannel: 'preview',
        }),
      }),
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon.preview.stack-a',
          mode: 'user',
          targetMode: 'pinned',
          releaseChannel: 'preview',
        }),
      }),
      expect.objectContaining({
        kind: 'install-default-following-service',
        releaseChannel: 'preview',
        mode: 'user',
      }),
    ]);
  });

  it('repairs a same-mode default-following service from another Happier home', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentHappierHomeDir: '/home/test/.happier',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default',
        name: 'Foreign stale default background service',
        installed: true,
        path: '/Users/tester/Library/LaunchAgents/com.happiest.cli.daemon.default.plist',
        platform: 'darwin',
        mode: 'user',
        happierHomeDir: '/Users/tester/.happier/stacks/repo-dev-old/cli',
        releaseChannel: 'stable',
        label: 'com.happiest.cli.daemon.default',
        targetMode: 'default-following',
      }],
    });

    expect(plan.manualWarnings).toEqual([]);
    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'com.happiest.cli.daemon.default',
          installedPath: '/Users/tester/Library/LaunchAgents/com.happiest.cli.daemon.default.plist',
          mode: 'user',
          targetMode: 'default-following',
          releaseChannel: 'stable',
        }),
      }),
      expect.objectContaining({
        kind: 'install-default-following-service',
        releaseChannel: 'preview',
        mode: 'user',
      }),
    ]);
  });

  it('repairs a same-mode default-following service with missing Happier home metadata', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentHappierHomeDir: '/home/test/.happier',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default',
        name: 'Legacy default background service',
        installed: true,
        path: '/Users/tester/Library/LaunchAgents/com.happiest.cli.daemon.default.plist',
        platform: 'darwin',
        mode: 'user',
        releaseChannel: 'stable',
        label: 'com.happiest.cli.daemon.default',
        targetMode: 'default-following',
      }],
    });

    expect(plan.manualWarnings).toEqual([]);
    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'com.happiest.cli.daemon.default',
          installedPath: '/Users/tester/Library/LaunchAgents/com.happiest.cli.daemon.default.plist',
          mode: 'user',
          targetMode: 'default-following',
          releaseChannel: 'stable',
        }),
      }),
      expect.objectContaining({
        kind: 'install-default-following-service',
        releaseChannel: 'preview',
        mode: 'user',
      }),
    ]);
  });

  it('does not remove or replace services from another Happier home when a foreign pinned service targets the current server', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentHappierHomeDir: '/home/test/.happier',
      currentServerId: 'stack-a',
      preferredMode: 'user',
      services: [{
        serverId: 'stack-a',
        name: 'Pinned current server',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.preview.stack-a.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'preview',
        label: 'happiest-daemon.preview.stack-a',
        targetMode: 'pinned',
      }, {
        serverId: 'stack-a',
        name: 'Foreign pinned current server',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.preview.stack-a.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/other/.happier',
        releaseChannel: 'preview',
        label: 'happiest-daemon.preview.stack-a',
        targetMode: 'pinned',
      }],
    });

    expect(plan.actions).toEqual([]);
    expect(plan.manualWarnings).toEqual([
      expect.stringContaining('/home/other/.happier'),
    ]);
  });

  it('removes same-mode default-following services with unknown Happier home metadata when a compatible default exists', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentHappierHomeDir: '/home/test/.happier',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default',
        name: 'Canonical default background service',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.default.service',
        platform: 'linux',
        mode: 'user',
        happierHomeDir: '/home/test/.happier',
        releaseChannel: 'preview',
        label: 'happiest-daemon.default',
        targetMode: 'default-following',
      }, {
        serverId: 'default',
        name: 'Legacy preview default background service (missing home)',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.preview.default.service',
        platform: 'linux',
        mode: 'user',
        // happierHomeDir intentionally omitted (legacy services may not embed it)
        releaseChannel: 'preview',
        label: 'happiest-daemon.preview.default',
        targetMode: 'default-following',
      }],
    });

    expect(plan.manualWarnings).toEqual([]);
    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon.preview.default',
          installedPath: '/home/test/.config/systemd/user/happiest-daemon.preview.default.service',
          mode: 'user',
          targetMode: 'default-following',
          releaseChannel: 'preview',
        }),
      }),
    ]);
  });

  it('repairs default-following services with missing Happier home metadata from another release channel', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentHappierHomeDir: '/home/test/.happier',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default',
        name: 'Legacy stable default background service (missing home)',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.default.service',
        platform: 'linux',
        mode: 'user',
        releaseChannel: 'stable',
        label: 'happiest-daemon.default',
        targetMode: 'default-following',
      }],
    });

    expect(plan.manualWarnings).toEqual([]);
    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon.default',
          installedPath: '/home/test/.config/systemd/user/happiest-daemon.default.service',
          mode: 'user',
          targetMode: 'default-following',
          releaseChannel: 'stable',
        }),
      }),
      expect.objectContaining({
        kind: 'install-default-following-service',
        releaseChannel: 'preview',
        mode: 'user',
      }),
    ]);
  });

  it('migrates a stale pinned service for the current server from another release channel to the current default service', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentServerId: 'stack-a',
      preferredMode: 'user',
      services: [{
        serverId: 'stack-a',
        name: 'Stack A',
        installed: true,
        path: '/home/test/.config/systemd/user/happiest-daemon.preview.stack-a.service',
        platform: 'linux',
        mode: 'user',
        releaseChannel: 'stable',
        label: 'happiest-daemon.preview.stack-a',
        targetMode: 'pinned',
      }],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'happiest-daemon.preview.stack-a',
          mode: 'user',
          targetMode: 'pinned',
          releaseChannel: 'stable',
        }),
      }),
      expect.objectContaining({
        kind: 'install-default-following-service',
        releaseChannel: 'preview',
        mode: 'user',
      }),
    ]);
  });

  it('keeps the canonical Windows default service over legacy channel-scoped task-name and wrapper-path forms', () => {
    const plan = buildBackgroundServiceRepairPlan({
      currentReleaseChannel: 'preview',
      currentServerId: 'default',
      preferredMode: 'user',
      services: [{
        serverId: 'default',
        name: 'Legacy preview default background service',
        installed: true,
        path: 'C:\\Users\\tester\\.happier\\services\\happiest-daemon.preview.default.ps1',
        platform: 'win32',
        mode: 'user',
        happierHomeDir: 'C:\\Users\\tester\\.happier',
        releaseChannel: 'preview',
        label: 'Happiest\\happiest-daemon.preview.default',
        targetMode: 'default-following',
      }, {
        serverId: 'default',
        name: 'Canonical default background service',
        installed: true,
        path: 'C:\\Users\\tester\\.happier\\services\\happiest-daemon.default.ps1',
        platform: 'win32',
        mode: 'user',
        happierHomeDir: 'C:\\Users\\tester\\.happier',
        releaseChannel: 'preview',
        label: 'Happiest\\happiest-daemon.default',
        targetMode: 'default-following',
      }],
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({
        kind: 'remove-service',
        service: expect.objectContaining({
          label: 'Happiest\\happiest-daemon.preview.default',
          mode: 'user',
          targetMode: 'default-following',
          releaseChannel: 'preview',
        }),
      }),
    ]);
  });
});
