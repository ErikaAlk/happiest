import { existsSync, readdirSync } from 'node:fs';
import { delimiter as pathDelimiter, join, normalize as normalizePath } from 'node:path';

export type CommandInvocation = Readonly<{ command: string; args: string[]; windowsVerbatimArguments?: boolean }>;

function asNonEmptyString(value: unknown): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readEnvPath(env: NodeJS.ProcessEnv): string {
  // Windows env vars are case-insensitive; Node may expose PATH as `Path`.
  return readEnvValueCaseInsensitive(env, 'PATH') ?? '';
}

function readEnvPathext(env: NodeJS.ProcessEnv): string {
  return readEnvValueCaseInsensitive(env, 'PATHEXT') ?? '';
}

function readEnvValueCaseInsensitive(env: NodeJS.ProcessEnv, name: string): string | null {
  const direct = env[name];
  if (typeof direct === 'string') return direct;

  const lowered = name.toLowerCase();
  for (const [key, value] of Object.entries(env)) {
    if (key.toLowerCase() !== lowered) continue;
    return typeof value === 'string' ? value : null;
  }
  return null;
}

function normalizePathext(pathext: string): string[] {
  const raw = asNonEmptyString(pathext) ?? '.EXE;.CMD;.BAT;.COM';
  return raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.startsWith('.') ? part : `.${part}`));
}

function expandPathextCaseVariants(exts: string[]): string[] {
  const seen = new Set<string>();
  const variants: string[] = [];
  for (const ext of exts) {
    for (const candidate of [ext, ext.toLowerCase(), ext.toUpperCase()]) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      variants.push(candidate);
    }
  }
  return variants;
}

function isCommandOnly(command: string): boolean {
  const trimmed = String(command ?? '').trim();
  if (!trimmed) return false;
  if (trimmed.includes('/') || trimmed.includes('\\')) return false;
  if (trimmed.includes(':')) return false;
  return true;
}

function isWindowsShellShimPath(pathLike: string): boolean {
  return /\.(cmd|bat)$/i.test(String(pathLike ?? '').trim());
}

function isWindowsCmdExeCommand(command: string): boolean {
  return /^cmd(?:\.exe)?$/i.test(String(command ?? '').trim());
}

function buildWindowsCommandCandidates(commandLike: string, env: NodeJS.ProcessEnv): string[] {
  const cmd = asNonEmptyString(commandLike);
  if (!cmd) return [];

  const exts = expandPathextCaseVariants(normalizePathext(readEnvPathext(env)));
  const lowered = cmd.toLowerCase();
  const hasKnownExt = exts.some((ext) => lowered.endsWith(ext.toLowerCase()));
  return hasKnownExt ? [cmd] : [...exts.map((ext) => `${cmd}${ext}`), cmd];
}

export function resolveWindowsCommandPath(commandPath: string, env: NodeJS.ProcessEnv = process.env): string | null {
  for (const candidate of buildWindowsCommandCandidates(commandPath, env)) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * The entries of a PATH directory from one listing, keyed by lower-cased name; `'missing'` when there
 * is no such directory and `null` when it exists but cannot be listed.
 *
 * The listing decides which candidate spellings exist. Probing every PATHEXT spelling in every PATH
 * directory costs over a thousand blocking filesystem calls per missing command on a typical Windows
 * PATH, and a probe cannot see an app execution alias such as Windows Terminal's
 * `%LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe`: `existsSync` follows its reparse point, cannot open
 * it and reports it missing, although Windows finds and runs it. The listing names it like any file.
 */
function listPathDirectory(dir: string): ReadonlyMap<string, string> | 'missing' | null {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : null;
  }
  return new Map(entries.map((entry) => [entry.toLowerCase(), entry]));
}

/**
 * The first `command` on PATH, trying each PATHEXT spelling per directory. `accept` skips matches the
 * caller already knows are not the one it looks for (the managed `happier.exe` when looking for a
 * `happier` the user installed), so the search goes on to the next match instead of stopping there.
 * A directory that cannot be listed is probed one candidate at a time.
 */
export function resolveWindowsCommandOnPath(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
  accept: (candidate: string) => boolean = () => true,
): string | null {
  const cmd = asNonEmptyString(command);
  if (!cmd) return null;

  const pathEnv = asNonEmptyString(readEnvPath(env));
  if (!pathEnv) return null;

  const candidates = buildWindowsCommandCandidates(cmd, env);

  for (const dir of pathEnv.split(pathDelimiter)) {
    const trimmedDir = dir.trim();
    if (!trimmedDir) continue;
    const entries = listPathDirectory(trimmedDir);
    if (entries === 'missing') continue;
    for (const name of candidates) {
      const listedName = entries ? entries.get(name.toLowerCase()) : name;
      if (!listedName) continue;
      const full = join(trimmedDir, listedName);
      if (!entries && !existsSync(full)) continue;
      if (accept(full)) return full;
    }
  }

  return null;
}

// See http://www.robvanderwoude.com/escapechars.php
const cmdMetaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
const nodeModulesCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;

function escapeCmdCommand(arg: string): string {
  return arg.replace(cmdMetaCharsRegExp, '^$1');
}

function escapeCmdArgument(arg: string, doubleEscapeMetaChars: boolean): string {
  let s = `${arg}`;

  // Algorithm below is based on https://qntm.org/cmd
  // (Copied from cross-spawn)
  s = s.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
  s = s.replace(/(?=(\\+?)?)\1$/, '$1$1');

  // Quote the whole thing:
  s = `"${s}"`;

  // Escape meta chars
  s = s.replace(cmdMetaCharsRegExp, '^$1');
  if (doubleEscapeMetaChars) {
    s = s.replace(cmdMetaCharsRegExp, '^$1');
  }

  return s;
}

function buildCmdExeInvocation(params: Readonly<{ resolvedCommand: string; args: ReadonlyArray<string>; env: NodeJS.ProcessEnv; comspec?: string | null }>): CommandInvocation {
  const resolvedCommand = normalizePath(params.resolvedCommand);
  const comspec = resolveWindowsCmdExeCommand(params.env, params.comspec);

  const needsDoubleEscape = nodeModulesCmdShimRegExp.test(resolvedCommand);
  const shellCommand = [escapeCmdCommand(resolvedCommand), ...params.args.map((arg) => escapeCmdArgument(arg, needsDoubleEscape))].join(' ');

  return {
    command: comspec,
    args: ['/d', '/s', '/c', `"${shellCommand}"`],
    windowsVerbatimArguments: true,
  };
}

function resolveWindowsCmdExeCommand(env: NodeJS.ProcessEnv, explicitComspec?: string | null): string {
  const configured =
    asNonEmptyString(explicitComspec) ??
    asNonEmptyString(readEnvValueCaseInsensitive(env, 'COMSPEC'));
  if (configured) {
    return resolveWindowsCommandPath(configured, env) ?? configured;
  }

  const windowsRoot =
    asNonEmptyString(readEnvValueCaseInsensitive(env, 'SystemRoot')) ??
    asNonEmptyString(readEnvValueCaseInsensitive(env, 'WINDIR'));
  if (windowsRoot) {
    const cmdPath = join(windowsRoot, 'System32', 'cmd.exe');
    return resolveWindowsCommandPath(cmdPath, env) ?? cmdPath;
  }

  return resolveWindowsCommandOnPath('cmd.exe', env) ?? 'cmd.exe';
}

export function resolveWindowsCommandInvocation(params: Readonly<{
  command: string;
  args: ReadonlyArray<string>;
  env?: NodeJS.ProcessEnv;
  comspec?: string | null;
  resolveCommandOnPath?: boolean;
}>): CommandInvocation {
  const command = String(params.command ?? '').trim();
  const args = Array.isArray(params.args) ? params.args.map((a) => String(a)) : [];

  if (process.platform !== 'win32') {
    return { command, args };
  }

  const env = params.env ?? process.env;
  if (isCommandOnly(command) && isWindowsCmdExeCommand(command)) {
    return { command: resolveWindowsCmdExeCommand(env, params.comspec), args };
  }

  const shouldResolveOnPath = params.resolveCommandOnPath !== false;
  const resolvedCommand =
    shouldResolveOnPath && isCommandOnly(command)
      ? (resolveWindowsCommandOnPath(command, env) ?? command)
      : (resolveWindowsCommandPath(command, env) ?? command);

  if (!isWindowsShellShimPath(resolvedCommand)) {
    return { command: resolvedCommand, args };
  }

  return buildCmdExeInvocation({ resolvedCommand, args, env, comspec: params.comspec });
}
