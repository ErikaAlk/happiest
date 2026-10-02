import { isVersionAtLeast } from '../mcp/version';
import { probeCodexCliVersion, type CodexCliVersionProbeDependencies } from '../utils/probeCodexCliVersion';

const SHARED_CONTROL_MIN_VERSION_UNIX = { major: 0, minor: 131, patch: 0 } as const;

export async function resolveCodexSharedControlSupport(params: Readonly<{
  cwd: string;
  processEnv?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  dependencies?: Partial<CodexCliVersionProbeDependencies>;
}>): Promise<Readonly<{ ok: true }> | Readonly<{ ok: false; reason: 'unsupported-version' }>> {
  // Codex 0.154 added protected Windows AF_UNIX sockets, but Node's IPC path
  // transport connects Windows named pipes only. Keep Windows on the existing
  // exclusive local-control path until Happier owns an AF_UNIX-capable bridge.
  if ((params.platform ?? process.platform) === 'win32') {
    return { ok: false, reason: 'unsupported-version' };
  }
  try {
    const version = await probeCodexCliVersion({
      cwd: params.cwd,
      processEnv: params.processEnv ?? process.env,
      overrideEnvVarKeys: ['HAPPIER_CODEX_APP_SERVER_BIN', 'HAPPIER_CODEX_TUI_BIN', 'HAPPY_CODEX_TUI_BIN'],
      dependencies: params.dependencies,
    });
    return isVersionAtLeast(version, SHARED_CONTROL_MIN_VERSION_UNIX)
      ? { ok: true }
      : { ok: false, reason: 'unsupported-version' };
  } catch {
    return { ok: false, reason: 'unsupported-version' };
  }
}
