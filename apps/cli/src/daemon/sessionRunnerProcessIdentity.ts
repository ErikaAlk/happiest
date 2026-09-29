import { classifyProcessesByPid, type ProcessByPidClassification } from './doctor';
import { hashProcessCommand } from './sessionRegistry';
import type { ProcessRunState } from './processRunState';
import { readProcessInstanceFingerprint } from '@happier-dev/cli-common/processInstance';

export type SessionRunnerProcessIdentity =
  | Readonly<{ kind: 'happy'; processCommandHash: string; processInstanceFingerprint?: string }>
  | Readonly<{ kind: 'not_happy'; processInstanceFingerprint?: string }>
  | Readonly<{ kind: 'unknown'; processInstanceFingerprint?: string }>;

/**
 * Test/adapter hook for process identity checks.
 *
 * Return a valid hash only when the PID is known to be a Happy runner process, return
 * null when the PID was inspected and is not Happy, and throw when identity is unknown.
 */
export type SessionRunnerProcessCommandHashReader = (pid: number) => Promise<string | null>;
export type SessionRunnerProcessInstanceFingerprintReader = (pid: number) => string | null | Promise<string | null>;

export function isValidProcessCommandHash(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

async function readInjectedProcessIdentity(
  pid: number,
  getProcessCommandHash: SessionRunnerProcessCommandHashReader,
  getProcessInstanceFingerprint: SessionRunnerProcessInstanceFingerprintReader,
): Promise<SessionRunnerProcessIdentity> {
  const processInstanceFingerprint = (await getProcessInstanceFingerprint(pid)) ?? undefined;
  try {
    const processCommandHash = await getProcessCommandHash(pid);
    if (isValidProcessCommandHash(processCommandHash)) {
      return { kind: 'happy', processCommandHash, ...(processInstanceFingerprint ? { processInstanceFingerprint } : {}) };
    }
    return processCommandHash === null
      ? { kind: 'not_happy', ...(processInstanceFingerprint ? { processInstanceFingerprint } : {}) }
      : { kind: 'unknown', ...(processInstanceFingerprint ? { processInstanceFingerprint } : {}) };
  } catch {
    return { kind: 'unknown', ...(processInstanceFingerprint ? { processInstanceFingerprint } : {}) };
  }
}

export async function readSessionRunnerProcessIdentity(params: Readonly<{
  pid: number;
  getProcessCommandHash?: SessionRunnerProcessCommandHashReader;
  getProcessInstanceFingerprint?: SessionRunnerProcessInstanceFingerprintReader;
}>): Promise<SessionRunnerProcessIdentity> {
  if (params.getProcessCommandHash) {
    return await readInjectedProcessIdentity(
      params.pid,
      params.getProcessCommandHash,
      params.getProcessInstanceFingerprint ?? readProcessInstanceFingerprint,
    );
  }
  return (await readSessionRunnerProcessIdentities([params.pid])).get(params.pid) ?? { kind: 'unknown' };
}

function readObservedProcessInstanceFingerprint(classified: ProcessByPidClassification): string | undefined {
  if (classified.kind === 'happy') return classified.process.processInstanceFingerprint;
  if (classified.kind === 'not_happy') return classified.processInstanceFingerprint;
  return undefined;
}

/**
 * Identity of several runner PIDs from one process observation. On Windows the command line and
 * the process-instance fingerprint come from a single non-blocking CIM query for all PIDs, so the
 * daemon heartbeat costs one PowerShell start per tick regardless of how many sessions it tracks.
 */
export async function readSessionRunnerProcessIdentities(
  pids: readonly number[],
): Promise<Map<number, SessionRunnerProcessIdentity>> {
  const classifications = await classifyProcessesByPid(pids).catch(() => new Map<number, ProcessByPidClassification>());
  const identities = new Map<number, SessionRunnerProcessIdentity>();
  for (const pid of new Set(pids)) {
    const classified = classifications.get(pid) ?? { kind: 'unknown' as const };
    // Windows observes the fingerprint in the classification query; a PID missing from it has no
    // process to fingerprint. Elsewhere the fingerprint is a cheap procfs read or `ps` probe.
    const processInstanceFingerprint = readObservedProcessInstanceFingerprint(classified)
      ?? (process.platform === 'win32' ? undefined : (await readProcessInstanceFingerprint(pid)) ?? undefined);
    const fingerprintField = processInstanceFingerprint ? { processInstanceFingerprint } : {};
    if (classified.kind === 'happy') {
      identities.set(pid, {
        kind: 'happy',
        processCommandHash: hashProcessCommand(classified.process.command),
        ...fingerprintField,
      });
    } else {
      identities.set(pid, { kind: classified.kind, ...fingerprintField });
    }
  }
  return identities;
}

export function storedProcessIdentityProvesPidReuse(params: Readonly<{
  storedProcessInstanceFingerprint: string | null | undefined;
  currentIdentity: SessionRunnerProcessIdentity;
}>): boolean {
  const stored = String(params.storedProcessInstanceFingerprint ?? '').trim();
  const observed = String(params.currentIdentity.processInstanceFingerprint ?? '').trim();
  return Boolean(stored && observed && stored !== observed);
}

export function storedProcessIdentityMatchesCurrentIdentity(params: Readonly<{
  storedProcessCommandHash: string | null | undefined;
  storedProcessInstanceFingerprint: string | null | undefined;
  currentIdentity: SessionRunnerProcessIdentity;
}>): boolean {
  if (params.currentIdentity.kind !== 'happy') return false;
  const storedFingerprint = String(params.storedProcessInstanceFingerprint ?? '').trim();
  if (storedFingerprint) {
    return params.currentIdentity.processInstanceFingerprint === storedFingerprint;
  }
  return isValidProcessCommandHash(params.storedProcessCommandHash)
    && params.currentIdentity.processCommandHash === params.storedProcessCommandHash;
}

export type SessionRunnerProcessPresence =
  | 'absent'
  | 'present'
  | 'recoverable_stopped'
  | 'unknown';

/**
 * Canonical process-evidence decision shared by lock acquisition and daemon resume fencing.
 * A fingerprint mismatch proves PID reuse; missing identity evidence never does.
 */
export function classifySessionRunnerProcessPresence(params: Readonly<{
  runState: ProcessRunState | null;
  storedProcessCommandHash: string | null | undefined;
  storedProcessInstanceFingerprint: string | null | undefined;
  currentIdentity?: SessionRunnerProcessIdentity;
}>): SessionRunnerProcessPresence {
  if (params.runState === 'dead' || params.runState === 'zombie') return 'absent';
  if (params.runState === null) return 'unknown';

  if (
    params.currentIdentity
    && storedProcessIdentityProvesPidReuse({
      storedProcessInstanceFingerprint: params.storedProcessInstanceFingerprint,
      currentIdentity: params.currentIdentity,
    })
  ) {
    return 'absent';
  }

  if (params.runState === 'stopped') {
    if (
      params.currentIdentity
      && storedProcessIdentityMatchesCurrentIdentity({
        storedProcessCommandHash: params.storedProcessCommandHash,
        storedProcessInstanceFingerprint: params.storedProcessInstanceFingerprint,
        currentIdentity: params.currentIdentity,
      })
    ) {
      return 'recoverable_stopped';
    }
    return 'unknown';
  }

  return 'present';
}
