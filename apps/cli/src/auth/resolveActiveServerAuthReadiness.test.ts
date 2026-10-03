import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEnvKeyScope } from '@/testkit/env/envScope';
import { withTempDir } from '@/testkit/fs/tempDir';

describe('resolveActiveServerAuthReadiness', () => {
  const envKeys = [
    'HAPPIEST_HOME_DIR',
    'HAPPIEST_SERVER_URL',
    'HAPPIEST_PUBLIC_SERVER_URL',
    'HAPPIEST_LOCAL_SERVER_URL',
    'HAPPIEST_WEBAPP_URL',
    'HAPPIEST_ACTIVE_SERVER_ID',
  ] as const;
  let envScope = createEnvKeyScope(envKeys);

  afterEach(() => {
    envScope.restore();
    envScope = createEnvKeyScope(envKeys);
    vi.resetModules();
  });

  it('reports no sign-in for a computer that has no server yet', async () => {
    await withTempDir('happier-cli-auth-readiness-', async (homeDir) => {
      envScope.patch({
        HAPPIEST_HOME_DIR: homeDir,
        HAPPIEST_SERVER_URL: undefined,
        HAPPIEST_PUBLIC_SERVER_URL: undefined,
        HAPPIEST_LOCAL_SERVER_URL: undefined,
        HAPPIEST_WEBAPP_URL: undefined,
        HAPPIEST_ACTIVE_SERVER_ID: undefined,
      });
      vi.resetModules();
      const { resolveActiveServerAuthReadiness } = await import('./resolveActiveServerAuthReadiness');

      const readiness = await resolveActiveServerAuthReadiness();

      expect(readiness).toMatchObject({
        credentials: null,
        authenticated: false,
        credentialState: 'missing',
        machineRegistered: false,
      });
    });
  });
});
