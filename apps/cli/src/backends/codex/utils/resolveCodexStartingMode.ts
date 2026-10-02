import { isWindowsHostedTerminalMode } from '@/terminal/runtime/terminalConfig';

export function resolveCodexStartingMode(params: Readonly<{
  explicitStartingMode?: 'local' | 'remote';
  startedBy: 'daemon' | 'cli';
  /** The `--happy-terminal-mode` the runner was started with. */
  terminalMode?: string | null;
  hasTtyForLocal: boolean;
  localControlEnabled: boolean;
}>): 'local' | 'remote' {
  if (params.startedBy === 'daemon') {
    // The daemon starts local mode only in a window it opened for the runner.
    return params.explicitStartingMode === 'local' && isWindowsHostedTerminalMode(params.terminalMode)
      ? 'local'
      : 'remote';
  }

  if (params.explicitStartingMode) {
    return params.explicitStartingMode;
  }

  if (params.localControlEnabled && params.hasTtyForLocal) {
    return 'local';
  }

  return 'remote';
}
