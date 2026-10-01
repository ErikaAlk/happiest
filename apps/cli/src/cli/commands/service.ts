import type { CommandContext } from '@/cli/commandRegistry';
import { formatCliCommand } from '@/cli/runtime/cliCommand';
import { runDaemonServiceCliCommand } from '@/daemon/service/cli';
import { handleServiceRepairCliCommand } from './serviceRepair/handleServiceRepairCliCommand';

export async function handleServiceCliCommand(context: CommandContext): Promise<void> {
  const commandPath = formatCliCommand('service');

  if (context.args[1] === 'repair') {
    await handleServiceRepairCliCommand({
      argv: context.args.slice(1),
      commandPath,
    });
    return;
  }

  await runDaemonServiceCliCommand({
    argv: context.args.slice(1),
    commandPath,
  });
}
