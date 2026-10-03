import { formatCliCommand } from '@/cli/runtime/cliCommand';

/**
 * Thrown when a command needs a server and this install has none: the product ships no public
 * server, so a fresh install stays serverless until the user adds the Relay they run.
 */
export class NoServerConfiguredError extends Error {
  /** Control-envelope code (`--json` commands): nothing can be signed in to yet; the message names the fix. */
  readonly code = 'not_authenticated';

  constructor() {
    super(
      `No server configured. Run "${formatCliCommand('setup')}" to connect to the Relay you run, `
      + `or "${formatCliCommand('server add --server-url <url> --use')}".`,
    );
    this.name = 'NoServerConfiguredError';
  }
}
