import type { CommandContext } from '@/cli/commandRegistry';
import { runBackendSessionCliCommand } from '@/cli/runBackendSessionCliCommand';
import { formatCliCommand } from '@/cli/runtime/cliCommand';
import { readOptionalFlagValue } from '@/cli/sessionStartArgs';

import { runConfiguredAcpBackend } from './runConfiguredAcpBackend';

export async function handleConfiguredAcpCatalogCliCommand(context: CommandContext): Promise<void> {
  const configuredAcpBackendId = readOptionalFlagValue(context.args, '--backend');
  const backendId = typeof configuredAcpBackendId === 'string' ? configuredAcpBackendId.trim() : '';
  if (!backendId) {
    throw new Error(`Usage: ${formatCliCommand('acp-catalog --backend <backend-id> [session options]')}`);
  }

  await runBackendSessionCliCommand({
    context,
    loadAccountSettings: true,
    loadRun: async () => (opts) => runConfiguredAcpBackend({
      ...opts,
      configuredAcpBackendId: backendId,
    }),
  });
}
