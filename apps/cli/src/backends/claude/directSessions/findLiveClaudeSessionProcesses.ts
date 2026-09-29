import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';

import { z } from 'zod';

import { readProcessInfosByPid } from '@/daemon/doctor';
import { readDaemonHeartbeatIntervalMs } from '@/daemon/lifecycle/heartbeatInterval';
import { isPidAliveBySignal } from '@/daemon/processRunState';
import type { DirectSessionRunningProcess } from '@/backends/directSessions/providerOps';
import { logger } from '@/ui/logger';

/**
 * Claude Code (observed with 2.1.283 and 2.1.284) records every running session in
 * `<config dir>/sessions/<pid>.json`. The file outlives a crashed process, so a record only counts
 * while its process is alive and started at the recorded `procStart`:
 * - on Windows `procStart` is the creation time as a FILETIME (100 ns ticks since 1601-01-01),
 *   compared with the CIM creation time, which carries microsecond precision;
 * - elsewhere it is the output of `ps -o lstart= -p <pid>` with `LC_ALL=C` and `TZ=UTC`
 *   (for example `Mon Sep 29 07:38:55 2026`), read here the same way.
 * A record without `procStart` cannot be tied to its process and does not count.
 */
const ClaudeSessionRecordSchema = z.object({
  pid: z.number().int().positive(),
  sessionId: z.string().min(1),
  procStart: z.string().min(1).optional(),
  pidDomain: z.string().min(1).optional(),
});

type ClaudeSessionRecord = z.infer<typeof ClaudeSessionRecordSchema>;

const FILETIME_UNIX_EPOCH_TICKS = 116444736000000000n;
const WIN32_FINGERPRINT = /^win32-cim:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{6})\d?Z$/;

function filetimeToMicrosecondKey(procStart: string): string {
  const ticks = BigInt(procStart) - FILETIME_UNIX_EPOCH_TICKS;
  const seconds = ticks / 10_000_000n;
  const microseconds = (ticks % 10_000_000n) / 10n;
  const secondsIso = new Date(Number(seconds) * 1000).toISOString().slice(0, 19);
  return `${secondsIso}.${microseconds.toString().padStart(6, '0')}`;
}

function cimFingerprintToMicrosecondKey(fingerprint: string | undefined): string | null {
  const match = WIN32_FINGERPRINT.exec(String(fingerprint ?? ''));
  return match ? `${match[1]}.${match[2]}` : null;
}

/** The live process at a PID: its parent and its start time, comparable with a recorded `procStart`. */
export type LiveProcessStart = Readonly<{ parentPid: number | null; procStart: string }>;

function readRecordedStartKey(procStart: string, platform: NodeJS.Platform): string | null {
  if (platform === 'win32') return /^\d+$/.test(procStart) ? filetimeToMicrosecondKey(procStart) : null;
  return procStart.trim();
}

async function readWin32ProcessStarts(pids: readonly number[]): Promise<Map<number, LiveProcessStart>> {
  const starts = new Map<number, LiveProcessStart>();
  for (const [pid, info] of await readProcessInfosByPid(pids)) {
    const startKey = cimFingerprintToMicrosecondKey(info.processInstanceFingerprint);
    if (startKey) starts.set(pid, { parentPid: info.parentPid ?? null, procStart: startKey });
  }
  return starts;
}

function readPosixProcessStarts(pids: readonly number[]): Promise<Map<number, LiveProcessStart>> {
  return new Promise((resolve, reject) => {
    execFile('ps', ['-o', 'pid=,ppid=,lstart=', '-p', pids.join(',')], {
      env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
      timeout: readDaemonHeartbeatIntervalMs(),
    }, (error, stdout) => {
      // ps exits 1 when none of the listed processes exists any more.
      if (error && !(error.code === 1 && String(stdout).trim() === '')) {
        reject(error);
        return;
      }
      const starts = new Map<number, LiveProcessStart>();
      for (const line of String(stdout).split('\n')) {
        const row = /^\s*(\d+)\s+(\d+)\s+(\S.*\S)\s*$/.exec(line);
        if (row) starts.set(Number(row[1]), { parentPid: Number(row[2]), procStart: row[3]! });
      }
      resolve(starts);
    });
  });
}

export function readLiveProcessStarts(
  pids: readonly number[],
  platform: NodeJS.Platform = process.platform,
): Promise<Map<number, LiveProcessStart>> {
  return platform === 'win32' ? readWin32ProcessStarts(pids) : readPosixProcessStarts(pids);
}

async function readSessionRecords(sessionsDir: string): Promise<ClaudeSessionRecord[]> {
  let entries: string[];
  try {
    entries = await readdir(sessionsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const records: ClaudeSessionRecord[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    let raw: string;
    try {
      raw = await readFile(join(sessionsDir, entry), 'utf8');
    } catch (error) {
      // The session ended between listing and reading: Claude Code removes its own record.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Claude Code may be rewriting the record right now; the next observation reads it whole.
      logger.debug('[claude-direct] Ignoring a Claude session record that is not complete JSON', { entry });
      continue;
    }
    const record = ClaudeSessionRecordSchema.safeParse(parsed);
    if (!record.success) {
      logger.debug('[claude-direct] Ignoring Claude session record in an unknown format', { entry });
      continue;
    }
    records.push(record.data);
  }
  return records;
}

/**
 * Verdicts keyed by PID and `procStart`: the recorded process, or `null` when the live process at
 * that PID is a different one. A process's start time and parent never change, so a verdict holds
 * while the PID stays alive. Reading them on Windows costs a PowerShell start (about 1.3 s), which
 * status polling cannot pay every 250 ms.
 */
const verifiedRecords = new Map<string, DirectSessionRunningProcess | null>();

function readVerifiedRecordKey(record: ClaudeSessionRecord & { procStart: string }): string {
  return `${record.pid}:${record.procStart}`;
}

function forgetExitedRecords(): void {
  for (const key of verifiedRecords.keys()) {
    if (!isPidAliveBySignal(Number.parseInt(key, 10))) verifiedRecords.delete(key);
  }
}

export async function findLiveClaudeSessionProcesses(params: Readonly<{
  configDir: string;
  remoteSessionId: string;
  /**
   * Reuse verdicts from earlier lookups while their processes stay alive. Only for observation:
   * a crashed Claude leaves its record behind and the OS may give its PID to another process, so
   * a caller that stops the returned processes or refuses work because of them verifies anew.
   */
  reuseVerifiedProcesses?: boolean;
  platform?: NodeJS.Platform;
  hostName?: string;
  readProcessStarts?: (pids: readonly number[]) => Promise<Map<number, LiveProcessStart>>;
}>): Promise<DirectSessionRunningProcess[]> {
  const platform = params.platform ?? process.platform;
  const pidDomain = `${platform}:${params.hostName ?? hostname()}`.toLowerCase();
  const candidates: Array<ClaudeSessionRecord & { procStart: string }> = [];
  for (const record of await readSessionRecords(join(params.configDir, 'sessions'))) {
    if (record.sessionId !== params.remoteSessionId) continue;
    if (record.pidDomain !== undefined && record.pidDomain.toLowerCase() !== pidDomain) continue;
    if (record.procStart === undefined) {
      logger.debug('[claude-direct] Ignoring a Claude session record without procStart', { pid: record.pid });
      continue;
    }
    candidates.push({ ...record, procStart: record.procStart });
  }
  forgetExitedRecords();
  if (candidates.length === 0) return [];

  const live: DirectSessionRunningProcess[] = [];
  const unverified: Array<ClaudeSessionRecord & { procStart: string }> = [];
  for (const record of candidates) {
    if (!isPidAliveBySignal(record.pid)) continue;
    const verdict = params.reuseVerifiedProcesses ? verifiedRecords.get(readVerifiedRecordKey(record)) : undefined;
    if (verdict === undefined) unverified.push(record);
    else if (verdict) live.push(verdict);
  }
  if (unverified.length === 0) return live;

  const starts = await (params.readProcessStarts ?? ((pids) => readLiveProcessStarts(pids, platform)))(
    unverified.map((record) => record.pid),
  );
  for (const record of unverified) {
    const start = starts.get(record.pid);
    if (!start) {
      // No row means the process exited during the read, or its start time could not be read. A
      // process that is still alive may be the recorded one, so it cannot count as absent.
      if (isPidAliveBySignal(record.pid)) {
        throw new Error(`Could not read the start time of process ${record.pid}, which Claude recorded for session ${params.remoteSessionId}`);
      }
      continue;
    }
    const verdict = readRecordedStartKey(record.procStart, platform) === start.procStart
      ? { pid: record.pid, parentPid: start.parentPid }
      : null;
    verifiedRecords.set(readVerifiedRecordKey(record), verdict);
    if (verdict) live.push(verdict);
  }
  return live;
}
