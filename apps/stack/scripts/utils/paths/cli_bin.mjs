import { join } from 'node:path';
import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

// Kept out of paths.mjs: the bundled-workspace preflight imports paths.mjs before the bundled
// workspace packages (including release-runtime) are guaranteed to exist.

/** The launcher script of the CLI package (`<cliDir>/bin/<command>.mjs`). */
export function getCliBinPath(cliDir) {
  return join(cliDir, 'bin', `${productIdentity.commandName}.mjs`);
}
