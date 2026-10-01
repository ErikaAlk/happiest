import type { CommandContext } from '@/cli/commandRegistry';
import { formatCliCommand } from '@/cli/runtime/cliCommand';
import { handleServiceRepairCliCommand } from './serviceRepair/handleServiceRepairCliCommand';

export async function handleStatusCliCommand(context: CommandContext): Promise<void> {
  if (context.args.includes('--yes')) {
    throw new Error(`${formatCliCommand('status')} is read-only. Use \`${formatCliCommand('doctor repair --yes')}\` to apply repairs.`);
  }

  await handleServiceRepairCliCommand({
    argv: ['repair', '--report-only', ...context.args.slice(1)],
    commandPath: formatCliCommand('status'),
  });
}
