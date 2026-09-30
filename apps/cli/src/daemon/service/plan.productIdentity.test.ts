import { describe, expect, it } from 'vitest';

import type { PublicReleaseRingId } from '@happier-dev/release-runtime/releaseRings';

import {
  planDaemonServiceInstall,
  planDaemonServiceUninstall,
  type DaemonServiceMode,
  type DaemonServicePlatform,
  type DaemonServiceTargetMode,
} from './plan';

// An upstream Happier installed on the same machine owns these names; a Happiest plan must never
// create, stop, disable or delete anything under them.
const UPSTREAM_SERVICE_NAME_PATTERN = /happier-daemon|com\.happier\.cli\.daemon|Happier\\/;
const PRODUCT_SERVICE_NAME_PATTERN = /happiest-daemon|com\.happiest\.cli\.daemon|Happiest\\/;

const variants: ReadonlyArray<Readonly<{ platform: DaemonServicePlatform; mode: DaemonServiceMode }>> = [
  { platform: 'darwin', mode: 'user' },
  { platform: 'linux', mode: 'user' },
  { platform: 'linux', mode: 'system' },
  { platform: 'win32', mode: 'user' },
];
const channels: readonly PublicReleaseRingId[] = ['stable', 'preview', 'publicdev'];
const targetModes: readonly DaemonServiceTargetMode[] = ['pinned', 'default-following'];

function homeDirsFor(platform: DaemonServicePlatform): Readonly<{ userHomeDir: string; happierHomeDir: string; executable: string }> {
  if (platform === 'win32') {
    return {
      userHomeDir: 'C:\\Users\\tester',
      happierHomeDir: 'C:\\Users\\tester\\.happiest',
      executable: 'C:\\Users\\tester\\.happiest\\cli\\current\\happiest.exe',
    };
  }
  const userHomeDir = platform === 'darwin' ? '/Users/tester' : '/home/tester';
  return {
    userHomeDir,
    happierHomeDir: `${userHomeDir}/.happiest`,
    executable: `${userHomeDir}/.happiest/cli/current/happiest`,
  };
}

describe('daemon service plans use only the product service names', () => {
  for (const { platform, mode } of variants) {
    for (const channel of channels) {
      for (const targetMode of targetModes) {
        it(`${platform}/${mode}/${channel}/${targetMode}`, () => {
          const dirs = homeDirsFor(platform);
          const install = planDaemonServiceInstall({
            platform,
            mode,
            systemUser: mode === 'system' ? 'tester' : undefined,
            channel,
            targetMode,
            instanceId: 'cloud',
            activeServerId: 'cloud',
            userHomeDir: dirs.userHomeDir,
            happierHomeDir: dirs.happierHomeDir,
            serverUrl: 'http://127.0.0.1:24910',
            webappUrl: 'http://localhost:24910',
            publicServerUrl: 'http://localhost:24910',
            nodePath: dirs.executable,
            entryPath: dirs.executable,
            uid: 501,
          });
          const uninstall = planDaemonServiceUninstall({
            platform,
            mode,
            channel,
            targetMode,
            instanceId: 'cloud',
            userHomeDir: dirs.userHomeDir,
            happierHomeDir: dirs.happierHomeDir,
            uid: 501,
          });

          for (const plan of [install, uninstall]) {
            const serialized = JSON.stringify(plan);
            expect(serialized).not.toMatch(UPSTREAM_SERVICE_NAME_PATTERN);
            expect(serialized).toMatch(PRODUCT_SERVICE_NAME_PATTERN);
          }
        });
      }
    }
  }
});
