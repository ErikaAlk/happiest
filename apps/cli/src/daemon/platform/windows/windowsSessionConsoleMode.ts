export type WindowsRemoteSessionLaunchMode = 'hidden' | 'windows_terminal' | 'console';

function normalizeWindowsRemoteSessionLaunchMode(value: unknown): WindowsRemoteSessionLaunchMode | null {
  if (value === 'hidden' || value === 'windows_terminal' || value === 'console') return value;
  if (value === 'visible') return 'console';
  return null;
}

export function resolveWindowsRemoteSessionLaunchMode(params: {
  platform: string;
  requested?: WindowsRemoteSessionLaunchMode | 'visible' | null | undefined;
  env: NodeJS.ProcessEnv;
}): WindowsRemoteSessionLaunchMode {
  if (params.platform !== 'win32') return 'hidden';

  const requested = normalizeWindowsRemoteSessionLaunchMode(params.requested);
  if (requested) return requested;

  const envLaunchMode = normalizeWindowsRemoteSessionLaunchMode(params.env.HAPPIER_WINDOWS_REMOTE_SESSION_LAUNCH_MODE);
  if (envLaunchMode) return envLaunchMode;

  const legacyEnvMode = normalizeWindowsRemoteSessionLaunchMode(params.env.HAPPIER_WINDOWS_REMOTE_SESSION_CONSOLE);
  if (legacyEnvMode) return legacyEnvMode;

  return 'hidden';
}

export const resolveWindowsRemoteSessionConsoleMode = resolveWindowsRemoteSessionLaunchMode;

/**
 * The starting mode of a session runner the daemon spawns outside tmux.
 *
 * A runner opened in a visible window starts in local mode, so the window shows the agent's own
 * interface with the conversation so far and the user can continue there, as with a session started
 * from a terminal; a message from another device switches it to remote mode. When the spawn carries
 * input (a new session's first prompt or goal), the runner starts in remote mode, which runs that
 * input at once. A hidden runner has no window and always starts in remote mode.
 */
export function resolveDaemonRunnerStartingMode(params: {
  launchMode: WindowsRemoteSessionLaunchMode;
  carriesInitialInput: boolean;
}): 'local' | 'remote' {
  const opensWindow = params.launchMode === 'console' || params.launchMode === 'windows_terminal';
  return opensWindow && !params.carriesInitialInput ? 'local' : 'remote';
}
