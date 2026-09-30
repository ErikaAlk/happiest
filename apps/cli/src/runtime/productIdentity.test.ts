import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getFirstPartyComponentCatalogEntry } from '@happier-dev/cli-common/firstPartyRuntime';

import { projectPathFromModuleUrl } from '@/projectPath';
import { normalizeCliArgv } from '@/cli/parseArgs';
import { resolveSessionRunnerEntrypointIdentityFromProcessCommand } from '@/daemon/sessionRunnerRuntime/resolveRunnerEntrypointIdentity';
import { resolveCliRuntimeRootPath } from './assets/resolveCliRuntimeAssetPath';
import {
  resolveRuntimeRootFromEntrypointPath,
  resolveRuntimeRootFromPackagedBinaryPath,
} from './resolveRuntimeEntrypointArgv';

describe('Happiest runtime identity', () => {
  it('launches the CLI and daemon from the product runtime directory', () => {
    for (const id of ['happier-cli', 'happier-daemon'] as const) {
      expect(getFirstPartyComponentCatalogEntry(id).nodeEntrypointRelativePath).toBe('happiest-runtime/index.mjs');
    }
  });

  it('resolves the installed runtime root and strips the executable from CLI arguments', () => {
    const entrypoint = '/home/alice/.happiest/cli/versions/0.1.0/happiest-runtime/index.mjs';
    expect(resolveRuntimeRootFromEntrypointPath(entrypoint)).toBe('/home/alice/.happiest/cli/versions/0.1.0');
    expect(normalizeCliArgv([entrypoint, 'daemon', 'start-sync'])).toEqual(['daemon', 'start-sync']);
    const nativeRoot = join(process.cwd(), 'versions', '0.1.0');
    expect(projectPathFromModuleUrl(pathToFileURL(join(nativeRoot, 'happiest-runtime', 'index.mjs')).href)).toBe(nativeRoot.replaceAll('\\', '/'));
  });

  it('resolves all product channel binaries and their asset roots', () => {
    for (const command of ['happiest', 'happiest-preview', 'happiest-dev']) {
      expect(resolveRuntimeRootFromPackagedBinaryPath(`/home/alice/.happiest/bin/${command}`)).toBe('/home/alice/.happiest/bin');
      const ringSuffix = command.slice('happiest'.length);
      expect(resolveCliRuntimeRootPath(`/home/alice/.happiest/bin/${command}`)).toBe(join('/home/alice/.happiest', `cli${ringSuffix}`, 'current'));
    }
    expect(resolveRuntimeRootFromPackagedBinaryPath('/home/alice/.happier/bin/happier')).toBeNull();
  });

  it('recognizes the immutable runner snapshot generation', () => {
    const entrypoint = '/repo/apps/cli/.happiest-runner-snapshots/abcdef1234567890/index.mjs';
    expect(resolveRuntimeRootFromEntrypointPath(entrypoint)).toBe('/repo/apps/cli/.happiest-runner-snapshots/abcdef1234567890');
    expect(resolveSessionRunnerEntrypointIdentityFromProcessCommand(`node ${entrypoint} --started-by daemon`)).toEqual(expect.objectContaining({
      status: 'known', comparableId: 'snapshot:abcdef1234567890',
    }));
    expect(resolveSessionRunnerEntrypointIdentityFromProcessCommand('happiest /home/alice/.happiest/cli/versions/0.1.0/happiest --started-by daemon')).toEqual(expect.objectContaining({
      status: 'known', comparableId: 'version:0.1.0',
    }));
  });
});
