import { spawn, type ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

import { readProcessInstanceFingerprintSync } from '@happier-dev/cli-common/processInstance';

import { readSessionRunnerProcessIdentity } from './sessionRunnerProcessIdentity';

const children: ChildProcess[] = [];

function spawnIdleProcess(): ChildProcess {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });
  children.push(child);
  return child;
}

/**
 * Longest stretch in which the event loop could not run a timer. The final stretch counts too:
 * a fully synchronous `work` never lets the timer fire at all.
 */
async function measureMaxEventLoopLagMs<T>(work: () => Promise<T>): Promise<Readonly<{ result: T; maxLagMs: number }>> {
  const tickMs = 20;
  let maxLagMs = 0;
  let lastTurnAt = performance.now();
  const recordTurn = () => {
    const now = performance.now();
    maxLagMs = Math.max(maxLagMs, now - lastTurnAt - tickMs);
    lastTurnAt = now;
  };
  const timer = setInterval(recordTurn, tickMs);
  try {
    const result = await work();
    recordTurn();
    return { result, maxLagMs };
  } finally {
    clearInterval(timer);
  }
}

afterEach(() => {
  for (const child of children.splice(0)) child.kill();
});

describe('session runner process identity (live processes)', () => {
  it('reads live process identities without blocking the daemon event loop', async () => {
    const pids = [spawnIdleProcess(), spawnIdleProcess()].map((child) => child.pid!);

    const { result, maxLagMs } = await measureMaxEventLoopLagMs(() =>
      Promise.all(pids.map((pid) => readSessionRunnerProcessIdentity({ pid }))));

    // The daemon heartbeat reads these identities every minute; a synchronous process probe
    // stalls every RPC, pending-queue wake and socket event queued behind it.
    expect(maxLagMs).toBeLessThan(250);
    for (const identity of result) {
      expect(identity.kind).toBe('not_happy');
      expect(identity.processInstanceFingerprint).toBeTruthy();
    }
  }, 60_000);

  it('produces the same process-instance fingerprint that persisted session markers record', async () => {
    const pid = spawnIdleProcess().pid!;

    const identity = await readSessionRunnerProcessIdentity({ pid });

    expect(identity.processInstanceFingerprint).toBe(readProcessInstanceFingerprintSync(pid));
  }, 60_000);
});
