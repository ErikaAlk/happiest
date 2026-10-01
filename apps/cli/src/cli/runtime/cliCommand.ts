import { basename } from 'node:path';

import { resolveManagedCliReleaseChannelSync } from '@happier-dev/cli-common/firstPartyRuntime';
import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

/**
 * The command people type to run this CLI. Every "run this command" line the CLI prints
 * (help, hints, errors, agent instructions) is built from it, so a dev-ring install says
 * `happiest-dev daemon start` and a source checkout says `happiest-source daemon start`.
 *
 * Resolution order:
 *  1. `HAPPIER_CLI_INVOKER_NAME`, set by wrappers that know the name they were installed under.
 *  2. The source launcher's command, when this process runs from the repository's sources;
 *     it uses its own home directory, so the installed command would act on another install.
 *  3. The product command the process was invoked as (`happiest`, `happiest-preview`, `happiest-dev`).
 *  4. The command the process's release ring installs, when the entrypoint names no command
 *     (the background daemon runs `happiest-runtime/index.mjs` under the managed Node).
 */
export function resolveCliCommandName(): string {
  const reportedName = normalizeCommandName(process.env.HAPPIER_CLI_INVOKER_NAME);
  if (reportedName) return reportedName;

  if (process.argv.slice(0, 2).some((arg) => normalizeCommandName(arg) === productIdentity.sourceCommandName)) {
    return productIdentity.sourceCommandName;
  }

  // The default-channel marker only decides which ring an unsuffixed `happiest` follows; the
  // command people type is still `happiest`, so it is not read here.
  const channel = resolveManagedCliReleaseChannelSync({
    processEnv: process.env,
    argv: process.argv,
    markerFallback: 'never',
  });
  return channel.invokedToolName ?? channel.channelToolName;
}

/** `args` behind the command people type to run this CLI, e.g. `happiest daemon start`. */
export function formatCliCommand(args: string): string {
  return `${resolveCliCommandName()} ${args}`;
}

function normalizeCommandName(raw: string | undefined | null): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const name = basename(value.replaceAll('\\', '/'))
    .replace(/\.exe$/i, '')
    .replace(/\.m?js$/i, '')
    .trim();
  return name || null;
}
