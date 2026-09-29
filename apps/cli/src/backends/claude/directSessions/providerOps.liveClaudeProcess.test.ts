import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { readProcessInstanceFingerprint } from '@happier-dev/cli-common/processInstance';

import {
  filetimeFromCimFingerprint,
  recordLiveClaudeSession,
  spawnClaudeStandInProcess,
  writeClaudeSessionRecord,
} from '@/testkit/backends/claudeSessionRecord';
import { spawnInlineNodeTestProcess } from '@/testkit/process/spawn';

import { claudeDirectSessionProviderOps } from './providerOps';

const children: ChildProcess[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  for (const child of children.splice(0)) child.kill();
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function createConfigDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'happier-claude-live-session-'));
  tempDirs.push(dir);
  return dir;
}

function spawnTracked(): ChildProcess {
  const child = spawnClaudeStandInProcess();
  children.push(child);
  return child;
}

async function readActivity(configDir: string, remoteSessionId: string) {
  const getActivity = claudeDirectSessionProviderOps.getActivity;
  if (!getActivity) throw new Error('Claude direct sessions report activity');
  return await getActivity({
    source: { kind: 'claudeConfig', configDir },
    remoteSessionId,
  });
}

describe('claudeDirectSessionProviderOps.getActivity (live Claude processes)', () => {
  it('reports a session as running while the Claude process recorded for it is alive', async () => {
    const configDir = await createConfigDir();
    const child = spawnTracked();
    await recordLiveClaudeSession({ configDir, pid: child.pid!, sessionId: 'session-live' });

    const activity = await readActivity(configDir, 'session-live');

    expect(activity.isRunning).toBe(true);
    expect(activity.runningProcesses).toEqual([{ pid: child.pid, parentPid: process.pid }]);
  }, 60_000);

  it('does not report a session as running from the record of an exited process or without a record', async () => {
    const configDir = await createConfigDir();
    const exited = spawnInlineNodeTestProcess('', { windowsHide: true });
    await new Promise((resolve) => exited.once('exit', resolve));
    await writeClaudeSessionRecord({ configDir, pid: exited.pid!, sessionId: 'session-exited', procStart: '134351197015253263' });

    for (const remoteSessionId of ['session-exited', 'session-without-record']) {
      const activity = await readActivity(configDir, remoteSessionId);
      expect(activity.isRunning, remoteSessionId).toBe(false);
      expect(activity.runningProcesses, remoteSessionId).toEqual([]);
    }
  }, 60_000);

  it.skipIf(process.platform !== 'win32')('does not report a session as running when its process id now belongs to a later process', async () => {
    const configDir = await createConfigDir();
    const child = spawnTracked();
    const fingerprint = await readProcessInstanceFingerprint(child.pid!);
    // Same live PID, but the recorded process was created one second before this one.
    const earlierProcStart = (BigInt(filetimeFromCimFingerprint(fingerprint!)) - 10_000_000n).toString();
    await writeClaudeSessionRecord({ configDir, pid: child.pid!, sessionId: 'session-reused-pid', procStart: earlierProcStart });

    const activity = await readActivity(configDir, 'session-reused-pid');

    expect(activity.isRunning).toBe(false);
    expect(activity.runningProcesses).toEqual([]);
  }, 60_000);
});
