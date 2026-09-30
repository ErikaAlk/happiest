import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  resolveManagedCliReleaseChannel,
  resolveManagedCliReleaseChannelSync,
} from './resolveManagedCliReleaseChannel';

function withDefaultChannelMarker<T>(releaseChannel: string, run: (env: NodeJS.ProcessEnv) => T): T {
  const homeDir = mkdtempSync(join(tmpdir(), 'happiest-managed-cli-release-channel-'));
  try {
    writeFileSync(
      join(homeDir, 'default-cli-release-channel.json'),
      `${JSON.stringify({ releaseChannel })}\n`,
      'utf8',
    );
    return run({ HAPPIEST_HOME_DIR: homeDir });
  } finally {
    rmSync(homeDir, { recursive: true, force: true });
  }
}

async function withDefaultChannelMarkerAsync<T>(
  releaseChannel: string,
  run: (env: NodeJS.ProcessEnv) => Promise<T>,
): Promise<T> {
  const homeDir = mkdtempSync(join(tmpdir(), 'happier-managed-cli-release-channel-'));
  try {
    writeFileSync(
      join(homeDir, 'default-cli-release-channel.json'),
      `${JSON.stringify({ releaseChannel })}\n`,
      'utf8',
    );
    return await run({ HAPPIEST_HOME_DIR: homeDir });
  } finally {
    rmSync(homeDir, { recursive: true, force: true });
  }
}

describe('resolveManagedCliReleaseChannelSync', () => {
  it('uses explicit channel flags before env and runtime hints', () => {
    const resolved = resolveManagedCliReleaseChannelSync({
      args: ['--dev'],
      argv: ['happiest-preview', 'self', 'update'],
      processEnv: { HAPPIER_PUBLIC_RELEASE_CHANNEL: 'preview' },
    });

    expect(resolved).toMatchObject({
      ringId: 'publicdev',
      label: 'dev',
      source: 'explicit-arg',
      channelToolName: 'happiest-dev',
    });
  });

  it('uses managed runtime path hints before shim names', () => {
    const resolved = resolveManagedCliReleaseChannelSync({
      argv: [
        'happiest-dev',
        '/Users/test/.happiest/cli-preview/versions/1.2.3/happiest-runtime/index.mjs',
      ],
      processEnv: {},
    });

    expect(resolved).toMatchObject({
      ringId: 'preview',
      source: 'path-hint',
      invokedToolName: 'happiest-dev',
      channelToolName: 'happiest-preview',
    });
  });

  it('uses the raw channel invoker when packaged argv paths are generic', () => {
    const resolved = resolveManagedCliReleaseChannelSync({
      args: ['update'],
      argv: ['happiest-dev', 'self', 'update'],
      invokedPath: 'self',
      processEnv: {},
    });

    expect(resolved).toMatchObject({
      ringId: 'publicdev',
      source: 'shim-name',
      invokedToolName: 'happiest-dev',
      channelToolName: 'happiest-dev',
    });
  });

  it('uses the persisted default channel for the unsuffixed product invoker', () => {
    withDefaultChannelMarker('preview', (processEnv) => {
      const resolved = resolveManagedCliReleaseChannelSync({
        args: ['update'],
        argv: ['happiest', 'self', 'update'],
        invokedPath: 'self',
        processEnv,
      });

      expect(resolved).toMatchObject({
        ringId: 'preview',
        source: 'default-marker',
        invokedToolName: 'happiest',
        channelToolName: 'happiest-preview',
      });
    });
  });

  it('does not treat another product command as its own invoker', () => {
    withDefaultChannelMarker('preview', (processEnv) => {
      for (const foreignInvoker of ['happier', 'hprev', 'hdev']) {
        const resolved = resolveManagedCliReleaseChannelSync({
          args: ['update'],
          argv: [foreignInvoker, 'self', 'update'],
          invokedPath: 'self',
          processEnv,
        });

        expect(resolved).toMatchObject({
          ringId: 'stable',
          source: 'default',
          invokedToolName: null,
        });
      }
    });
  });
});

describe('resolveManagedCliReleaseChannel', () => {
  it('can use the persisted default channel as an unconditional fallback', async () => {
    await withDefaultChannelMarkerAsync('publicdev', async (processEnv) => {
      const resolved = await resolveManagedCliReleaseChannel({
        processEnv,
        markerFallback: 'always',
      });

      expect(resolved).toMatchObject({
        ringId: 'publicdev',
        source: 'default-marker',
        invokedToolName: null,
        channelToolName: 'happiest-dev',
      });
    });
  });
});
