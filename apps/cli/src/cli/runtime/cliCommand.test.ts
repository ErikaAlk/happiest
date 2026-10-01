import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STANDARD_MANAGED_CLI_RELEASE_CHANNEL_ENV_KEYS } from '@happier-dev/cli-common/firstPartyRuntime';

import { createEnvKeyScope } from '@/testkit/env/envScope';

import { formatCliCommand, resolveCliCommandName } from './cliCommand';

describe('the command printed in "run this command" lines', () => {
  const envScope = createEnvKeyScope([...STANDARD_MANAGED_CLI_RELEASE_CHANNEL_ENV_KEYS, 'HAPPIER_CLI_INVOKER_NAME']);
  const originalArgv = [...process.argv];

  function invokeAs(entryPath: string): void {
    process.argv = [process.argv[0]!, entryPath, 'daemon', 'start'];
  }

  beforeEach(() => {
    envScope.patch({
      HAPPIER_CLI_INVOKER_NAME: undefined,
      HAPPIER_PUBLIC_RELEASE_CHANNEL: undefined,
      HAPPIER_RELEASE_RING: undefined,
      HAPPIER_RELEASE_CHANNEL: undefined,
    });
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    envScope.restore();
  });

  it('uses the product command the person invoked', () => {
    invokeAs('/home/test/.happiest/bin/happiest-preview');
    expect(formatCliCommand('daemon start')).toBe('happiest-preview daemon start');
  });

  it("names the release ring's command when the entrypoint names no command", () => {
    invokeAs('/home/test/.happiest/cli-dev/current/happiest-runtime/index.mjs');
    expect(formatCliCommand('daemon start')).toBe('happiest-dev daemon start');
  });

  it("never prints upstream Happier's commands", () => {
    invokeAs('/usr/local/bin/hdev');
    expect(resolveCliCommandName()).toBe('happiest');
  });

  it("keeps the source launcher's command, which uses its own home directory", () => {
    invokeAs('C:\\repo\\apps\\cli\\bin\\happiest-source.mjs');
    expect(resolveCliCommandName()).toBe('happiest-source');
  });

  it('prefers the name a wrapper reports', () => {
    invokeAs('/home/test/.happiest/cli/current/happiest-runtime/index.mjs');
    envScope.patch({ HAPPIER_CLI_INVOKER_NAME: '/opt/tools/happiest-wrapper' });
    expect(resolveCliCommandName()).toBe('happiest-wrapper');
  });
});
