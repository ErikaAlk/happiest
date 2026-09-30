import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readProcessInstanceFingerprintSync } from '@happier-dev/cli-common/processInstance';

import { createDeferred } from '@/testkit/async/deferred';
import { createEnvKeyScope } from '@/testkit/env/envScope';
import { measureMaxEventLoopLagMs } from '@/testkit/process/eventLoopLag';
import { spawnInlineNodeTestProcess } from '@/testkit/process/spawn';

import { persistAcceptedSpawnMarker } from './acceptedSpawnMarker';

type SessionMarkerWriteFn = NonNullable<NonNullable<Parameters<typeof persistAcceptedSpawnMarker>[1]>['writeSessionMarkerFn']>;
type SessionMarkerWriteArgs = Parameters<SessionMarkerWriteFn>[0];

const children: ChildProcess[] = [];
const homeEnv = createEnvKeyScope(['HAPPIEST_HOME_DIR']);
const tempDirs: string[] = [];

afterEach(async () => {
  for (const child of children.splice(0)) child.kill();
  homeEnv.restore();
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('persistAcceptedSpawnMarker (live processes)', () => {
  it('records the spawned runner identity without blocking the daemon event loop', async () => {
    const child = spawnInlineNodeTestProcess('setInterval(() => {}, 1000)', { windowsHide: true });
    children.push(child);
    const pid = child.pid!;
    const markerWritten = createDeferred<SessionMarkerWriteArgs>();

    const { maxLagMs } = await measureMaxEventLoopLagMs(() =>
      persistAcceptedSpawnMarker(
        {
          pid,
          spawnOptions: { directory: process.cwd(), backendTarget: { kind: 'builtInAgent', agentId: 'claude' } },
          directory: process.cwd(),
          encryptionMaterial: { type: 'legacy', secret: new Uint8Array(32).fill(3) },
        },
        {
          writeSessionMarkerFn: async (marker) => {
            markerWritten.resolve(marker);
          },
        },
      ));
    const marker = await markerWritten.promise;

    // Custody is persisted inside every spawn request, before the daemon acknowledges it; a
    // synchronous process probe here stalls every other RPC and socket event of the daemon.
    expect(maxLagMs).toBeLessThan(250);
    expect(marker.processInstanceFingerprint).toBe(readProcessInstanceFingerprintSync(pid));
    expect(marker.happySessionId).toBe(`PID-${pid}`);
  }, 60_000);

  it('keeps the marker the runner already reported for the same process', async () => {
    // The identity read above yields to the event loop, so the runner's session report can land
    // first. Custody written afterwards must not replace the reported session and resume facts.
    const homeDir = await mkdtemp(join(tmpdir(), 'happier-accepted-spawn-marker-'));
    tempDirs.push(homeDir);
    homeEnv.patch({ HAPPIEST_HOME_DIR: homeDir });
    vi.resetModules();
    const registry = await import('../sessionRegistry');
    const { persistAcceptedSpawnMarker: persist } = await import('./acceptedSpawnMarker');
    const child = spawnInlineNodeTestProcess('setInterval(() => {}, 1000)', { windowsHide: true });
    children.push(child);
    const pid = child.pid!;
    await registry.writeSessionMarker({
      pid,
      happySessionId: 'session-reported',
      startedBy: 'daemon',
      cwd: process.cwd(),
      processInstanceFingerprint: readProcessInstanceFingerprintSync(pid) ?? undefined,
    });

    await persist({
      pid,
      spawnOptions: { directory: process.cwd(), backendTarget: { kind: 'builtInAgent', agentId: 'claude' } },
      directory: process.cwd(),
      encryptionMaterial: { type: 'legacy', secret: new Uint8Array(32).fill(3) },
    });

    expect((await registry.readSessionMarkerForPid(pid))?.happySessionId).toBe('session-reported');
  }, 60_000);
});
