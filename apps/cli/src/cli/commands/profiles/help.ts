import chalk from 'chalk';

import { resolveCliCommandName } from '@/cli/runtime/cliCommand';

export function showProfilesHelp(): void {
  const cli = resolveCliCommandName();
  console.log(`
${chalk.bold(`${cli} profiles`)} - Backend profiles

${chalk.bold('Usage:')}
  ${cli} profiles list [--refresh-settings] [--json]

${chalk.bold('Aliases:')}
  ${cli} profile list

${chalk.bold('Notes:')}
  - Use --profile <id-or-name> when starting a session to apply a profile.
  - Run "${cli} auth login" to see custom profiles saved in your account settings.
`);
}

