import type { ChildProcess } from 'node:child_process';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import { readProcessInstanceFingerprintSync } from '@happier-dev/cli-common/processInstance';

import type { Metadata } from '@/api/types';
import { configuration } from '@/configuration';
import type { TrackedSession } from '@/daemon/types';
import { createDeferred } from '@/testkit/async/deferred';
import { measureMaxEventLoopLagMs } from '@/testkit/process/eventLoopLag';
import { spawnInlineNodeTestProcess } from '@/testkit/process/spawn';

import { createOnHappySessionWebhook } from './onHappySessionWebhook';

type SessionMarkerWriteFn = NonNullable<Parameters<typeof createOnHappySessionWebhook>[0]['writeSessionMarkerFn']>;
type SessionMarkerWriteArgs = Parameters<SessionMarkerWriteFn>[0];

const children: ChildProcess[] = [];

afterEach(() => {
  for (const child of children.splice(0)) child.kill();
});

describe('createOnHappySessionWebhook (live processes)', () => {
  it('records the reported runner identity in its session marker without blocking the daemon event loop', async () => {
    const child = spawnInlineNodeTestProcess('setInterval(() => {}, 1000)', { windowsHide: true });
    children.push(child);
    const pid = child.pid!;
    const markerWritten = createDeferred<SessionMarkerWriteArgs>();
    const onWebhook = createOnHappySessionWebhook({
      pidToTrackedSession: new Map<number, TrackedSession>(),
      pidToAwaiter: new Map(),
      writeSessionMarkerFn: async (marker) => {
        markerWritten.resolve(marker);
      },
    });
    const metadata: Metadata = {
      path: process.cwd(),
      host: os.hostname(),
      homeDir: os.homedir(),
      happyHomeDir: configuration.happyHomeDir,
      happyLibDir: process.cwd(),
      happyToolsDir: process.cwd(),
      hostPid: pid,
      startedBy: 'terminal',
      machineId: 'machine-live',
    };

    const { result: marker, maxLagMs } = await measureMaxEventLoopLagMs(async () => {
      await onWebhook('session-live-1', metadata);
      return await markerWritten.promise;
    });

    // Every session start reports through this webhook; a synchronous process probe here stalls
    // the RPCs, socket events and spawn acknowledgements queued behind it.
    expect(maxLagMs).toBeLessThan(250);
    expect(marker.processInstanceFingerprint).toBe(readProcessInstanceFingerprintSync(pid));
  }, 60_000);
});
