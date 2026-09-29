export function readProcessInstanceFingerprintSync(
  pid: number,
  options?: Readonly<{
    platform?: NodeJS.Platform;
    spawnSyncImpl?: typeof import('node:child_process').spawnSync;
    readFileSyncImpl?: typeof import('node:fs').readFileSync;
  }>,
): string | null;

export function readLinuxProcessParentPid(
  pid: number,
  options?: Readonly<{
    readFileImpl?: typeof import('node:fs/promises').readFile;
  }>,
): Promise<number | null>;

export function readProcessInstanceFingerprint(
  pid: number,
  options?: Readonly<{
    platform?: NodeJS.Platform;
    execFileImpl?: typeof import('node:child_process').execFile;
    readFileImpl?: typeof import('node:fs/promises').readFile;
  }>,
): Promise<string | null>;

export type Win32ProcessRow = Readonly<{
  pid: number;
  parentPid?: number;
  name?: string;
  commandLine?: string;
  processInstanceFingerprint?: string;
}>;

export function readWin32ProcessRows(
  pids: readonly number[] | null,
  options?: Readonly<{
    execFileImpl?: typeof import('node:child_process').execFile;
    /** Deadline of the caller's containing operation; an expired probe resolves as an empty map. */
    timeoutMs?: number;
  }>,
): Promise<Map<number, Win32ProcessRow>>;

export function processInstanceFingerprintMatches(expected: unknown, observed: unknown): boolean;
