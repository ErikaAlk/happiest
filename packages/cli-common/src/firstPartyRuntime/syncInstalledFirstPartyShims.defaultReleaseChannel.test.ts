import { existsSync, lstatSync, readlinkSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeDefaultManagedReleaseChannel } from './defaultReleaseChannelState';
import { promoteVersionedPayload } from './promoteVersionedPayload';
import { syncInstalledFirstPartyShims } from './syncInstalledFirstPartyShims';

async function createStagedPayload(rootDir: string, versionId: string, contents: string): Promise<string> {
  const stagedPayloadPath = join(rootDir, `stage-${versionId}`);
  await mkdir(stagedPayloadPath, { recursive: true });
  await mkdir(join(stagedPayloadPath, 'happiest-runtime'), { recursive: true });
  await writeFile(join(stagedPayloadPath, 'happiest'), contents, 'utf8');
  await writeFile(join(stagedPayloadPath, 'happiest-runtime', 'index.mjs'), `export default ${JSON.stringify(versionId)};\n`, 'utf8');
  return stagedPayloadPath;
}

describe('syncInstalledFirstPartyShims default release-channel handling', () => {
  it('keeps the happiest shim pointed at the selected default release-channel', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'happier-first-party-runtime-'));
    const env = { ...process.env, HAPPIEST_HOME_DIR: homeDir };

    try {
      await writeDefaultManagedReleaseChannel({
        processEnv: env,
        releaseChannel: 'preview',
      });
      await promoteVersionedPayload({
        componentId: 'happier-cli',
        processEnv: env,
        releaseRing: 'stable',
        versionId: '1.0.0',
        stagedPayloadPath: await createStagedPayload(homeDir, '1.0.0', 'stable-binary'),
      });
      await promoteVersionedPayload({
        componentId: 'happier-cli',
        processEnv: env,
        releaseRing: 'preview',
        versionId: '2.0.0',
        stagedPayloadPath: await createStagedPayload(homeDir, '2.0.0', 'preview-binary'),
      });

      await syncInstalledFirstPartyShims({
        componentId: 'happier-cli',
        processEnv: env,
        releaseRing: 'preview',
      });
      await syncInstalledFirstPartyShims({
        componentId: 'happier-cli',
        processEnv: env,
        releaseRing: 'stable',
      });

      const defaultShimPath = join(homeDir, 'bin', process.platform === 'win32' ? 'happiest.exe' : 'happiest');
      expect(existsSync(defaultShimPath)).toBe(true);

      if (process.platform === 'win32') {
        await expect(readFile(defaultShimPath, 'utf8')).resolves.toBe('preview-binary');
      } else {
        expect(lstatSync(defaultShimPath).isSymbolicLink()).toBe(true);
        expect(readlinkSync(defaultShimPath)).toMatch(/cli-preview\/current\/happiest|..\/cli-preview\/current\/happiest/);
      }
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
