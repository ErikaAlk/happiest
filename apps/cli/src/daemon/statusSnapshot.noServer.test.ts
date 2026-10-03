import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reloadConfiguration } from '@/configuration';
import { createEnvKeyScope } from '@/testkit/env/envScope';
import { createTempDir, removeTempDir } from '@/testkit/fs/tempDir';

const ENV_KEYS = [
  'HAPPIEST_HOME_DIR',
  'HAPPIEST_SERVER_URL',
  'HAPPIEST_PUBLIC_SERVER_URL',
  'HAPPIEST_LOCAL_SERVER_URL',
  'HAPPIEST_WEBAPP_URL',
  'HAPPIEST_ACTIVE_SERVER_ID',
  'HAPPIEST_DAEMON_LIFECYCLE_SCOPE_ID',
  'HAPPIEST_DAEMON_SERVICE_PLATFORM',
  'HAPPIEST_DAEMON_SERVICE_USER_HOME_DIR',
  'HAPPIEST_DAEMON_SERVICE_HOME_DIR',
] as const;

describe('readDaemonStatusSnapshot on a computer with no server', () => {
  let envScope = createEnvKeyScope([...ENV_KEYS]);
  let tmpHomeDir: string | null = null;

  beforeEach(async () => {
    tmpHomeDir = await createTempDir('happier-status-no-server-');
    envScope.patch({
      HAPPIEST_HOME_DIR: tmpHomeDir,
      HAPPIEST_SERVER_URL: undefined,
      HAPPIEST_PUBLIC_SERVER_URL: undefined,
      HAPPIEST_LOCAL_SERVER_URL: undefined,
      HAPPIEST_WEBAPP_URL: undefined,
      HAPPIEST_ACTIVE_SERVER_ID: undefined,
      HAPPIEST_DAEMON_LIFECYCLE_SCOPE_ID: undefined,
      HAPPIEST_DAEMON_SERVICE_PLATFORM: 'linux',
      HAPPIEST_DAEMON_SERVICE_USER_HOME_DIR: tmpHomeDir,
      HAPPIEST_DAEMON_SERVICE_HOME_DIR: tmpHomeDir,
    });
    reloadConfiguration();
  });

  afterEach(async () => {
    envScope.restore();
    envScope = createEnvKeyScope([...ENV_KEYS]);
    reloadConfiguration();
    if (tmpHomeDir) {
      await removeTempDir(tmpHomeDir);
      tmpHomeDir = null;
    }
  });

  it('reports no server, no sign-in and no running daemon', async () => {
    const { readDaemonStatusSnapshot } = await import('./statusSnapshot');

    const snapshot = await readDaemonStatusSnapshot();

    expect(snapshot.server).toBeNull();
    expect(snapshot.daemon).toMatchObject({ running: false, pid: null, httpPort: null });
    expect(snapshot.auth).toMatchObject({ authenticated: false, machineRegistered: false, needsAuth: true });
  });
});
