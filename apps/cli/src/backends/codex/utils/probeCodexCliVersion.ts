import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';

import { resolveWindowsCommandInvocation } from '@happier-dev/cli-common/process';

import { parseCodexVersionInfo, type CodexVersionInfo } from '../mcp/version';
import { resolveCodexCliInvocation } from './resolveCodexCliInvocation';

export type CodexCliVersionProbeDependencies = Readonly<{
  resolveInvocation: typeof resolveCodexCliInvocation;
  execute: (
    command: string,
    args: readonly string[],
    options: Readonly<{ env: NodeJS.ProcessEnv; windowsVerbatimArguments?: boolean }>,
  ) => string;
}>;

/** The version of the Codex CLI that a launch resolving the same overrides would run. */
export async function probeCodexCliVersion(params: Readonly<{
  cwd: string;
  processEnv: NodeJS.ProcessEnv;
  overrideEnvVarKeys: readonly string[];
  dependencies?: Partial<CodexCliVersionProbeDependencies>;
}>): Promise<CodexVersionInfo> {
  const resolveInvocation = params.dependencies?.resolveInvocation ?? resolveCodexCliInvocation;
  const execute = params.dependencies?.execute ?? ((command, args, options) => {
    // Node honors windowsVerbatimArguments for execFileSync; its typings omit it.
    const execOptions: ExecFileSyncOptionsWithStringEncoding & Readonly<{ windowsVerbatimArguments?: boolean }> = {
      encoding: 'utf8',
      env: options.env,
      windowsHide: true,
      windowsVerbatimArguments: options.windowsVerbatimArguments,
      stdio: ['ignore', 'pipe', 'pipe'],
    };
    return execFileSync(command, args, execOptions);
  });
  const resolved = await resolveInvocation({
    args: ['--version'],
    cwd: params.cwd,
    processEnv: params.processEnv,
    overrideEnvVarKeys: params.overrideEnvVarKeys,
    targetLabel: 'Codex CLI',
  });
  const invocation = resolveWindowsCommandInvocation({
    command: resolved.command,
    args: resolved.args,
    env: params.processEnv,
    resolveCommandOnPath: true,
  });
  return parseCodexVersionInfo(execute(invocation.command, invocation.args, {
    env: params.processEnv,
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
  }));
}
