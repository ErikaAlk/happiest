import { execFile, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

// Every reader formats the CIM creation time through this one expression, so a fingerprint
// persisted by one reader compares equal with the fingerprint another reader observes later.
const WIN32_CREATION_UTC_MEMBER = '.CreationDate.ToUniversalTime().ToString("O")';
const WIN32_FINGERPRINT_PREFIX = 'win32-cim:';
const POWERSHELL_ARGS = ['-NoProfile', '-NonInteractive', '-Command'];

function normalizePid(pid) {
  const value = Number(pid);
  return Number.isInteger(value) && value > 1 ? value : null;
}

function parseLinuxProcStatFingerprint(stat) {
  const closingParen = stat.lastIndexOf(')');
  const fieldsAfterCommand = closingParen >= 0
    ? stat.slice(closingParen + 1).trim().split(/\s+/)
    : [];
  const startTimeTicks = fieldsAfterCommand[19];
  return /^\d+$/.test(String(startTimeTicks ?? '')) ? `linux-proc:${startTimeTicks}` : null;
}

function runProbe(command, args, { spawnSyncImpl }) {
  const result = spawnSyncImpl(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result?.error || result?.status !== 0) return null;
  const value = String(result?.stdout ?? '').trim();
  return value || null;
}

function runProbeAsync(command, args, { execFileImpl }) {
  return new Promise((resolve) => {
    execFileImpl(command, args, { encoding: 'utf8', windowsHide: true }, (error, stdout) => {
      const value = error ? '' : String(stdout ?? '').trim();
      resolve(value || null);
    });
  });
}

/**
 * Synchronous reader for callers that cannot yield (lock files, build tooling). Long-lived
 * event-loop owners such as the daemon use {@link readProcessInstanceFingerprint} instead: on
 * Windows every probe starts PowerShell, which takes seconds.
 */
export function readProcessInstanceFingerprintSync(pid, {
  platform = process.platform,
  spawnSyncImpl = spawnSync,
  readFileSyncImpl = readFileSync,
} = {}) {
  const normalizedPid = normalizePid(pid);
  if (!normalizedPid) return null;

  if (platform === 'linux') {
    try {
      const fingerprint = parseLinuxProcStatFingerprint(String(readFileSyncImpl(`/proc/${normalizedPid}/stat`, 'utf8')));
      if (fingerprint) return fingerprint;
    } catch {
      // Fall through to the portable POSIX probe.
    }
  }

  if (platform === 'win32') {
    const script = [
      `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${normalizedPid}" -ErrorAction Stop`,
      'if ($null -eq $p) { exit 3 }',
      `$p${WIN32_CREATION_UTC_MEMBER}`,
    ].join('; ');
    const value = runProbe('powershell.exe', [...POWERSHELL_ARGS, script], { spawnSyncImpl });
    return value ? `${WIN32_FINGERPRINT_PREFIX}${value}` : null;
  }

  const value = runProbe('ps', ['-o', 'lstart=', '-p', String(normalizedPid)], { spawnSyncImpl });
  return value ? `${platform}-ps:${value}` : null;
}

function parsePositiveInt(value) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(typeof value === 'string' ? value : '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseWin32ProcessRows(output) {
  const rows = new Map();
  const trimmed = String(output ?? '').trim();
  if (!trimmed) return rows;
  const parsed = JSON.parse(trimmed);
  for (const row of Array.isArray(parsed) ? parsed : [parsed]) {
    if (!row || typeof row !== 'object') continue;
    const pid = parsePositiveInt(row.ProcessId);
    if (!pid) continue;
    const name = typeof row.Name === 'string' && row.Name.trim() ? row.Name : undefined;
    const commandLine = typeof row.CommandLine === 'string' && row.CommandLine.trim() ? row.CommandLine.trim() : undefined;
    const creationUtc = typeof row.CreationUtc === 'string' && row.CreationUtc.trim() ? row.CreationUtc.trim() : undefined;
    rows.set(pid, {
      pid,
      ...(name ? { name } : {}),
      ...(commandLine ? { commandLine } : {}),
      ...(creationUtc ? { processInstanceFingerprint: `${WIN32_FINGERPRINT_PREFIX}${creationUtc}` } : {}),
    });
  }
  return rows;
}

/**
 * Reads name, command line and process-instance fingerprint of Windows processes with one
 * non-blocking PowerShell/CIM query. `pids === null` reads every process. Resolves an empty map
 * when the query fails; callers treat a missing row as unknown identity.
 */
export async function readWin32ProcessRows(pids, { execFileImpl = execFile } = {}) {
  const uniquePids = pids === null
    ? null
    : Array.from(new Set(pids.map(normalizePid).filter((pid) => pid !== null)));
  if (uniquePids !== null && uniquePids.length === 0) return new Map();
  const filter = uniquePids === null
    ? ''
    : ` -Filter "${uniquePids.map((pid) => `ProcessId=${pid}`).join(' OR ')}"`;
  const script = [
    `$rows = Get-CimInstance Win32_Process${filter} | Select-Object ProcessId, Name, CommandLine, @{ Name = 'CreationUtc'; Expression = { $_${WIN32_CREATION_UTC_MEMBER} } }`,
    'if ($null -eq $rows) { return }',
    '$rows | ConvertTo-Json -Compress',
  ].join('; ');
  const output = await runProbeAsync('powershell.exe', [...POWERSHELL_ARGS, script], { execFileImpl });
  if (!output) return new Map();
  try {
    return parseWin32ProcessRows(output);
  } catch {
    return new Map();
  }
}

export async function readProcessInstanceFingerprint(pid, {
  platform = process.platform,
  execFileImpl = execFile,
  readFileImpl = readFile,
} = {}) {
  const normalizedPid = normalizePid(pid);
  if (!normalizedPid) return null;

  if (platform === 'linux') {
    const stat = await readFileImpl(`/proc/${normalizedPid}/stat`, 'utf8').catch(() => null);
    const fingerprint = stat === null ? null : parseLinuxProcStatFingerprint(String(stat));
    if (fingerprint) return fingerprint;
  }

  if (platform === 'win32') {
    const rows = await readWin32ProcessRows([normalizedPid], { execFileImpl });
    return rows.get(normalizedPid)?.processInstanceFingerprint ?? null;
  }

  const value = await runProbeAsync('ps', ['-o', 'lstart=', '-p', String(normalizedPid)], { execFileImpl });
  return value ? `${platform}-ps:${value}` : null;
}

export function processInstanceFingerprintMatches(expected, observed) {
  const normalizedExpected = String(expected ?? '').trim();
  const normalizedObserved = String(observed ?? '').trim();
  return Boolean(normalizedExpected && normalizedObserved && normalizedExpected === normalizedObserved);
}
