import chalk from 'chalk';

import { resolveCliCommandName } from '@/cli/runtime/cliCommand';

import { listRootHelpCommands } from './commandSurfaceManifest';

const HELP_LABEL_WIDTH = 27;

function formatHelpEntry(label: string, description: string): string {
  return `  ${label.padEnd(HELP_LABEL_WIDTH)} ${description}`;
}

export function buildRootHelpText(): string {
  const cli = resolveCliCommandName();
  const helpEntries = listRootHelpCommands();
  return `
${chalk.bold(cli)} - AI CLI On the Go

${chalk.bold('Usage:')}
${helpEntries.map((entry) => {
    const label = entry.rootHelpLabel ?? '';
    const description = entry.rootHelpDescription ?? '';
    const firstLine = formatHelpEntry(label, description);
    if (!entry.rootHelpDetail) return firstLine;
    return `${firstLine}\n${formatHelpEntry('', entry.rootHelpDetail)}`;
  }).join('\n')}

${chalk.bold('Examples:')}
  ${cli}                    Start session
  ${cli} --refresh-settings  Force-refresh account settings before starting
  ${cli} --launch-profile <id-or-name> Start with a launch profile from your settings
  ${cli} --auth cs:<id>    Start with an exact Connected Services profile or pool
  ${cli} --auth native     Start with native provider authentication
  ${cli} --yolo             Start with bypassing permissions
                              ${cli} sugar for --dangerously-skip-permissions
  ${cli} --chrome           Enable Chrome browser access for this session
  ${cli} --no-chrome        Disable Chrome even if default is on
  ${cli} --js-runtime bun   Use bun instead of node to spawn JavaScript-backed CLIs
  ${cli} auth login --force Authenticate
  ${cli} profiles list      List available backend profiles
  ${cli} doctor             Run diagnostics

${chalk.bold('Server selection (global flags; prefix-only; no persistence):')}
  ${cli} --server <name-or-id> ...
  ${cli} --server-url <url> [--webapp-url <url>] [--public-server-url <url>] ...
`;
}
