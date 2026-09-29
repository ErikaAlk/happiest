import type { ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

import { readProcessInstanceFingerprintSync } from '@happier-dev/cli-common/processInstance';

import { createDeferred } from '@/testkit/async/deferred';
import { measureMaxEventLoopLagMs } from '@/testkit/process/eventLoopLag';
import { spawnInlineNodeTestProcess } from '@/testkit/process/spawn';

import { persistAcceptedSpawnMarker } from './acceptedSpawnMarker';

type SessionMarkerWriteFn = NonNullable<NonNullable<Parameters<typeof persistAcceptedSpawnMarker>[1]>['writeSessionMarkerFn']>;
type SessionMarkerWriteArgs = Parameters<SessionMarkerWriteFn>[0];

const children: ChildProcess[] = [];

afterEach(() => {
  for (const child of children.splice(0)) child.kill();
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
});
