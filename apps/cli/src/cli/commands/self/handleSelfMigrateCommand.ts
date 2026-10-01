import { formatCliCommand } from '@/cli/runtime/cliCommand';

export async function handleSelfMigrateCommand(argv: readonly string[]): Promise<void> {
  const forwardedArgv = ['repair', ...argv];
  const { handleServiceRepairCliCommand } = await import('../serviceRepair/handleServiceRepairCliCommand');
  await handleServiceRepairCliCommand({
    argv: forwardedArgv,
    commandPath: formatCliCommand('doctor'),
  });
}
