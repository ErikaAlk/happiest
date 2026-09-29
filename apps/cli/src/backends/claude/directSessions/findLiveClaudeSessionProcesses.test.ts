import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  readClaudeRecordedProcStart,
  spawnClaudeStandInProcess,
  writeClaudeSessionRecord,
} from '@/testkit/backends/claudeSessionRecord';

import { findLiveClaudeSessionProcesses, readLiveProcessStarts, type LiveProcessStart } from './findLiveClaudeSessionProcesses';

const children: ChildProcess[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  for (const child of children.splice(0)) child.kill();
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function createConfigDir(): Promise<string> {
  const configDir = await mkdtemp(join(tmpdir(), 'happier-claude-verified-records-'));
  tempDirs.push(configDir);
  return configDir;
}

function spawnStandIn(): ChildProcess {
  const child = spawnClaudeStandInProcess();
  children.push(child);
  return child;
}

async function recordLiveSession(sessionId: string) {
  const configDir = await createConfigDir();
  const child = spawnStandIn();
  await writeClaudeSessionRecord({ configDir, pid: child.pid!, sessionId, procStart: await readClaudeRecordedProcStart(child.pid!) });
  return { configDir, child };
}

function countingProcessReader() {
  const reads: number[][] = [];
  return {
    reads,
    readProcessStarts: async (pids: readonly number[]) => {
      reads.push([...pids]);
      return await readLiveProcessStarts(pids);
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
      readProcessStarts: reader.readProcessStarts,
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

  it('counts a live process outside Windows only when it started at the recorded procStart', async () => {
    // Claude Code records `ps -o lstart=` output there. A process that took over the PID of a
    // crashed Claude has another start time, whatever its command line says.
    const configDir = await createConfigDir();
    const child = spawnStandIn();
    const recorded = 'Mon Sep 29 07:38:55 2026';
    await writeClaudeSessionRecord({ configDir, pid: child.pid!, sessionId: 'session-posix', procStart: recorded, platform: 'linux' });
    const lookupWithStart = (procStart: string) => findLiveClaudeSessionProcesses({
      configDir,
      remoteSessionId: 'session-posix',
      platform: 'linux',
      readProcessStarts: async () => new Map<number, LiveProcessStart>([[child.pid!, { parentPid: 42, procStart }]]),
    });

    expect(await lookupWithStart('Mon Sep 29 07:41:02 2026')).toEqual([]);
    expect(await lookupWithStart(recorded)).toEqual([{ pid: child.pid, parentPid: 42 }]);
  }, 60_000);

  it('fails instead of reporting no process when a recorded live process cannot be identified', async () => {
    const { configDir, child } = await recordLiveSession('session-unreadable');

    await expect(findLiveClaudeSessionProcesses({
      configDir,
      remoteSessionId: 'session-unreadable',
      readProcessStarts: async () => new Map(),
    })).rejects.toThrow(String(child.pid));
  }, 60_000);

  it('does not count a record without procStart', async () => {
    const configDir = await createConfigDir();
    const child = spawnStandIn();
    await writeClaudeSessionRecord({ configDir, pid: child.pid!, sessionId: 'session-unstamped' });

    expect(await findLiveClaudeSessionProcesses({ configDir, remoteSessionId: 'session-unstamped' })).toEqual([]);
  }, 60_000);
});
