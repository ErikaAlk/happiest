import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderSystemdServiceUnit } from '@happier-dev/cli-common/service';

import { withTempDir } from '@/testkit/fs/tempDir';

import { discoverInstalledDaemonServiceEntries } from './discoverInstalledDaemonServiceEntries';

const { spawnSyncMock } = vi.hoisted(() => ({
  spawnSyncMock: vi.fn<typeof import('node:child_process').spawnSync>(),
}));

vi.mock('node:child_process', () => ({
  spawnSync: spawnSyncMock,
}));

function writeLinuxDaemonUnit(path: string): void {
  writeFileSync(
    path,
    renderSystemdServiceUnit({
      description: 'CLI daemon',
      execStart: ['/home/tester/bin/cli', 'daemon', 'start-sync'],
      env: {
        HAPPIEST_ACTIVE_SERVER_ID: 'cloud',
        HAPPIER_DAEMON_STARTUP_SOURCE: 'background-service',
        HAPPIER_PUBLIC_RELEASE_CHANNEL: 'stable',
      },
      wantedBy: 'default.target',
    }),
    'utf-8',
  );
}

// An upstream Happier installed on the same machine keeps its own background services next to this
// product's. Discovery lists only this product's services, so no repair, uninstall or takeover can
// act on the upstream ones.
describe('discoverInstalledDaemonServiceEntries next to an upstream Happier', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
    spawnSyncMock.mockReturnValue({ status: 1, stdout: '', stderr: '' } as never);
  });

  it('lists only this product’s systemd units', async () => {
    await withTempDir('happiest-discover-coexist-linux-', async (homeDir) => {
      const unitDir = join(homeDir, '.config', 'systemd', 'user');
      mkdirSync(unitDir, { recursive: true });
      const upstreamPath = join(unitDir, 'happier-daemon.cloud.service');
      const productPath = join(unitDir, 'happiest-daemon.cloud.service');
      writeLinuxDaemonUnit(upstreamPath);
      writeLinuxDaemonUnit(productPath);

      const entries = await discoverInstalledDaemonServiceEntries({
        platform: 'linux',
        userHomeDir: homeDir,
        happierHomeDir: join(homeDir, '.happiest'),
        mode: 'user',
        serversById: {},
      });

      expect(entries.map((entry) => entry.path)).toEqual([productPath]);
      expect(entries[0]).toMatchObject({ label: 'happiest-daemon.cloud', serverId: 'cloud' });
    });
  });

  it('lists only this product’s scheduled tasks', async () => {
    await withTempDir('happiest-discover-coexist-win32-', async (homeDir) => {
      const productHome = join(homeDir, '.happiest');
      mkdirSync(join(productHome, 'services'), { recursive: true });
      const upstreamWrapper = 'C:\\Users\\tester\\.happier\\services\\happier-daemon.cloud.ps1';
      const productWrapper = 'C:\\Users\\tester\\.happiest\\services\\happiest-daemon.cloud.ps1';
      const wrapperByTaskName: Record<string, string> = {
        'Happier\\happier-daemon.cloud': upstreamWrapper,
        'Happiest\\happiest-daemon.cloud': productWrapper,
      };
      const queriedTaskNames: string[] = [];
      spawnSyncMock.mockImplementation(((command: string, args: readonly string[] = []) => {
        if (command !== 'schtasks') return { status: 1, stdout: '', stderr: '' };
        if (args.includes('CSV')) {
          return {
            status: 0,
            stdout: '"\\Happier\\happier-daemon.cloud","N/A","Ready"\r\n"\\Happiest\\happiest-daemon.cloud","N/A","Ready"\r\n',
            stderr: '',
          };
        }
        const taskName = String(args[args.indexOf('/TN') + 1] ?? '');
        queriedTaskNames.push(taskName);
        const wrapperPath = wrapperByTaskName[taskName];
        if (!wrapperPath || !args.includes('/XML')) return { status: 1, stdout: '', stderr: '' };
        return {
          status: 0,
          stdout: `<Task><Actions><Exec><Arguments>-File "${wrapperPath}"</Arguments></Exec></Actions></Task>`,
          stderr: '',
        };
      }) as never);

      const entries = await discoverInstalledDaemonServiceEntries({
        platform: 'win32',
        userHomeDir: homeDir,
        happierHomeDir: productHome,
        mode: 'user',
        serversById: {},
      });

      expect(entries.map((entry) => entry.path)).toEqual([productWrapper]);
      expect(entries[0]).toMatchObject({ label: 'Happiest\\happiest-daemon.cloud' });
      expect(queriedTaskNames).not.toContain('Happier\\happier-daemon.cloud');
    });
  });
});
