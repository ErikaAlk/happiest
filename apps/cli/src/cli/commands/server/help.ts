import chalk from 'chalk';

import { configuration } from '@/configuration';
import { resolveCliCommandName } from '@/cli/runtime/cliCommand';

export function showServerHelp(): void {
  const cli = resolveCliCommandName();
  console.log(`
${chalk.bold(`${cli} server`)} - Manage relay profiles

${chalk.bold('Usage:')}
  ${cli} server list
  ${cli} server current
  ${cli} server add [--name <name>] [--server-url <url>] [--public-server-url <url>] [--webapp-url <url>] [--use] [--no-use] [--yes] [--start-daemon] [--install-service]
  ${cli} server use <name-or-id>
  ${cli} server remove <name-or-id> [--force]
  ${cli} server test [<name-or-id>]
  ${cli} server set [--server-id <id>] --server-url <url> [--public-server-url <url>] [--webapp-url <url>]

${chalk.bold('Notes:')}
  • Profiles are stored in ${configuration.settingsFile}
  • Credentials are stored per relay profile under ${configuration.serversDir}
  • Public relay URL is used for QR codes/deep links (defaults to relay URL)
  • add checks the relay answers /v1/version before saving it; --yes saves it without checking
  • Env vars override for one run: HAPPIEST_SERVER_URL / HAPPIEST_PUBLIC_SERVER_URL / HAPPIEST_WEBAPP_URL
`);
}
