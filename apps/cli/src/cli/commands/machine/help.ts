import chalk from 'chalk';

import { resolveCliCommandName } from '@/cli/runtime/cliCommand';

export function showMachineHelp(): void {
  const cli = resolveCliCommandName();
  console.log(`
${chalk.bold(`${cli} machine`)} - Bootstrap and manage remote machines

${chalk.bold('Usage:')}
  ${cli} machine setup --ssh <user@host> [--identity-file <path>] [--ssh-config-file <path>] [--known-hosts-path <path>] [--trusted-host-key <line>]
  ${cli} machine setup --ssh <user@host> [--server <name-or-id> | --server-url <url> [--webapp-url <url>] [--public-server-url <url>]]
  ${cli} machine setup --ssh <user@host> [--service-mode <user|none>] [--install-relay-runtime] [--relay-runtime-mode <user|system>] [--yes] [--json]

${chalk.bold('Notes:')}
  • This is a thin wrapper over the canonical remote SSH bootstrap task.
  • Use --json to stream protocol event/result JSON lines.
  • In interactive terminals, SSH host trust and pairing approval prompts are surfaced inline.
  • Use --yes to auto-accept setup prompts in non-interactive runs.
  `);
}
