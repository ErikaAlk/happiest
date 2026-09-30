import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';

import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

import {
  isAbsolutePathForPathShape,
  isWin32ShapedAbsolutePath,
  joinPathForPathShape,
  resolvePathForPathShape,
} from '../path/pathShape.js';

export function resolveHappyHomeDirFromEnvironment(processEnv: NodeJS.ProcessEnv = process.env): string {
  const override = typeof processEnv.HAPPIEST_HOME_DIR === 'string' ? processEnv.HAPPIEST_HOME_DIR.trim() : '';
  if (override) {
    const envHome =
      process.platform === 'win32'
        ? (processEnv.USERPROFILE || processEnv.HOME)
        : processEnv.HOME;
    const normalizedHome = typeof envHome === 'string' ? envHome.trim() : '';
    const expandedOverride =
      override === '~'
        ? (normalizedHome || homedir())
        : override.startsWith('~/') || override.startsWith('~\\')
          ? joinPathForPathShape(normalizedHome || homedir(), override.slice(2))
          : override;
    if (process.platform !== 'win32' && isWin32ShapedAbsolutePath(expandedOverride)) {
      throw new Error(`Windows-shaped home overrides are not supported on ${process.platform}`);
    }
    return isAbsolutePathForPathShape(expandedOverride) ? expandedOverride : resolvePathForPathShape(expandedOverride);
  }

  const envHome =
    process.platform === 'win32'
      ? ((processEnv.USERPROFILE ?? processEnv.HOME ?? '').trim())
      : ((processEnv.HOME ?? processEnv.USERPROFILE ?? '').trim());
  let baseHome = resolveSudoInvokerHomeDir(processEnv) ?? envHome;
  if (!baseHome) {
    try {
      baseHome = homedir();
    } catch {
      baseHome = '';
    }
  }

  if (!baseHome) {
    baseHome = tmpdir();
  }

  return joinPathForPathShape(baseHome, productIdentity.homeDirName);
}

/**
 * Under `sudo`, the product belongs to the invoking user, so the home directory is resolved from
 * the invoker's passwd entry rather than root's `HOME`.
 */
function resolveSudoInvokerHomeDir(processEnv: NodeJS.ProcessEnv): string | null {
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  if (uid !== 0) return null;
  const sudoUser = typeof processEnv.SUDO_USER === 'string' ? processEnv.SUDO_USER.trim() : '';
  const sudoUidRaw = typeof processEnv.SUDO_UID === 'string' ? processEnv.SUDO_UID.trim() : '';
  const sudoUid = sudoUidRaw ? Number.parseInt(sudoUidRaw, 10) : NaN;
  if (!sudoUser && !Number.isFinite(sudoUid)) return null;

  const username = sudoUser || undefined;
  const invokerUid = Number.isFinite(sudoUid) ? sudoUid : undefined;

  if (process.platform === 'linux') {
    try {
      const result = spawnSync('getent', ['passwd', sudoUser || String(sudoUid)], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        env: process.env,
      });
      if ((result.status ?? 1) === 0) {
        const homeDir = parsePasswdHomeDir(String(result.stdout ?? ''), username, invokerUid);
        if (homeDir) return homeDir;
      }
    } catch {
      // Fall back to /etc/passwd below.
    }
  }

  try {
    const homeDir = parsePasswdHomeDir(String(readFileSync('/etc/passwd', 'utf8')), username, invokerUid);
    if (homeDir) return homeDir;
  } catch {
    // Ignore.
  }

  return null;
}

function parsePasswdHomeDir(passwdDatabase: string, username?: string, uid?: number): string | null {
  for (const line of String(passwdDatabase ?? '').split(/\r?\n/u)) {
    if (!line) continue;
    const parts = line.split(':');
    if (parts.length < 7) continue;
    const [name, _pw, uidText, _gid, _gecos, homeDir] = parts;
    const parsedUid = Number.parseInt(uidText, 10);
    const matchesUser = username && name === username;
    const matchesUid = uid != null && Number.isFinite(parsedUid) && parsedUid === uid;
    if (!matchesUser && !matchesUid) continue;
    const candidate = String(homeDir ?? '').trim();
    return candidate.startsWith('/') ? candidate : null;
  }
  return null;
}
