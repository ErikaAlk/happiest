import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { readProcessInstanceFingerprint } from '@happier-dev/cli-common/processInstance';

import { readProcessInfosByPid } from '@/daemon/doctor';
import {
  filetimeFromCimFingerprint,
  spawnClaudeStandInProcess,
  writeClaudeSessionRecord,
} from '@/testkit/backends/claudeSessionRecord';

import { findLiveClaudeSessionProcesses } from './findLiveClaudeSessionProcesses';

const children: ChildProcess[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  for (const child of children.splice(0)) child.kill();
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function recordLiveSession(sessionId: string) {
  const configDir = await mkdtemp(join(tmpdir(), 'happier-claude-verified-records-'));
  tempDirs.push(configDir);
  const child = spawnClaudeStandInProcess();
  children.push(child);
  const fingerprint = process.platform === 'win32' ? await readProcessInstanceFingerprint(child.pid!) : null;
  // Outside Windows the record format is unverified; any procStart makes the record reusable.
  const procStart = fingerprint ? filetimeFromCimFingerprint(fingerprint) : '1';
  await writeClaudeSessionRecord({ configDir, pid: child.pid!, sessionId, procStart });
  return { configDir, child };
}

function countingProcessReader() {
  const reads: number[][] = [];
  return {
    reads,
    readProcessInfos: async (pids: readonly number[]) => {
      reads.push([...pids]);
      return await readProcessInfosByPid(pids);
    },
  };
}

describe('findLiveClaudeSessionProcesses', () => {
  it('reuses a verified process while it lives only when the caller asks to', async () => {
    const { configDir, child } = await recordLiveSession('session-polled');
    const reader = countingProcessReader();
    const lookup = (reuseVerifiedProcesses: boolean) => findLiveClaudeSessionProcesses({
      configDir,
      remoteSessionId: 'session-polled',
      reuseVerifiedProcesses,
      readProcessInfos: reader.readProcessInfos,
    });
    const expected = [{ pid: child.pid, parentPid: process.pid }];

    expect(await lookup(true)).toEqual(expected);
    expect(await lookup(true)).toEqual(expected);
    expect(reader.reads).toEqual([[child.pid]]);

    expect(await lookup(false)).toEqual(expected);
    expect(reader.reads).toEqual([[child.pid], [child.pid]]);

    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    expect(await lookup(true)).toEqual([]);
    expect(reader.reads).toHaveLength(2);
  }, 60_000);
});
