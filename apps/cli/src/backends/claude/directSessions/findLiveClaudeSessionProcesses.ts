import { readdir, readFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';

import { z } from 'zod';

import { readProcessInfosByPid, type ProcessInfoByPid } from '@/daemon/doctor';
import { isPidAliveBySignal } from '@/daemon/processRunState';
import type { DirectSessionRunningProcess } from '@/backends/directSessions/providerOps';
import { logger } from '@/ui/logger';

/**
 * Claude Code (observed with 2.1.283 and 2.1.284) records every running session in
 * `<config dir>/sessions/<pid>.json`. The file outlives a crashed process, so a record only counts
 * while its process is alive and is provably the process that wrote it:
 * - on Windows `procStart` is the creation time as a FILETIME (100 ns ticks since 1601-01-01),
 *   compared with the CIM creation time, which carries microsecond precision;
 * - elsewhere the record's format is not verified, so the live process must be a Claude process.
 *   A PID reused by another Claude process rewrites the same `<pid>.json`, and a PID reused by
 *   anything else fails the command check.
 */
const ClaudeSessionRecordSchema = z.object({
  pid: z.number().int().positive(),
  sessionId: z.string().min(1),
  procStart: z.string().regex(/^\d+$/).optional(),
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

function isRecordedProcess(record: ClaudeSessionRecord, info: ProcessInfoByPid, platform: NodeJS.Platform): boolean {
  if (platform === 'win32') {
    if (!record.procStart) return false;
    return cimFingerprintToMicrosecondKey(info.processInstanceFingerprint) === filetimeToMicrosecondKey(record.procStart);
  }
  return /claude/i.test(`${info.name ?? ''} ${info.cmd ?? ''}`);
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
 * Verdicts for records that carry `procStart`, keyed by PID and `procStart`: the recorded process,
 * or `null` when the live process at that PID is a different one. A process's identity and parent
 * never change, so a verdict holds while the PID stays alive. Reading them on Windows costs a
 * PowerShell start (about 1.3 s), which status polling cannot pay every 250 ms.
 */
const verifiedRecords = new Map<string, DirectSessionRunningProcess | null>();

function readVerifiedRecordKey(record: ClaudeSessionRecord): string | null {
  return record.procStart ? `${record.pid}:${record.procStart}` : null;
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
  readProcessInfos?: (pids: readonly number[]) => Promise<Map<number, ProcessInfoByPid>>;
}>): Promise<DirectSessionRunningProcess[]> {
  const platform = params.platform ?? process.platform;
  const pidDomain = `${platform}:${params.hostName ?? hostname()}`.toLowerCase();
  const candidates = (await readSessionRecords(join(params.configDir, 'sessions'))).filter((record) =>
    record.sessionId === params.remoteSessionId
    && (record.pidDomain === undefined || record.pidDomain.toLowerCase() === pidDomain));
  forgetExitedRecords();
  if (candidates.length === 0) return [];

  const live: DirectSessionRunningProcess[] = [];
  const unverified: ClaudeSessionRecord[] = [];
  for (const record of candidates) {
    if (!isPidAliveBySignal(record.pid)) continue;
    const key = readVerifiedRecordKey(record);
    const verdict = params.reuseVerifiedProcesses && key ? verifiedRecords.get(key) : undefined;
    if (verdict === undefined) unverified.push(record);
    else if (verdict) live.push(verdict);
  }
  if (unverified.length === 0) return live;

  const infos = await (params.readProcessInfos ?? readProcessInfosByPid)(unverified.map((record) => record.pid));
  for (const record of unverified) {
    const info = infos.get(record.pid);
    const verdict = info && isRecordedProcess(record, info, platform)
      ? { pid: record.pid, parentPid: info.parentPid ?? null }
      : null;
    const key = readVerifiedRecordKey(record);
    // A process that exited during the read leaves no row; its verdict is not a lasting fact.
    if (key && info) verifiedRecords.set(key, verdict);
    if (verdict) live.push(verdict);
  }
  return live;
}
