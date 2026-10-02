import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

/**
 * Commands the app shows people to type. The app recommends only the stable ring, so every command
 * starts with the product's own command, whatever variant this app build is.
 */
export function formatCliCommand(args?: string): string {
    return args ? `${productIdentity.commandName} ${args}` : productIdentity.commandName;
}

const STABLE_INSTALL_SCRIPT_URL = `https://github.com/${productIdentity.githubRepo}/releases/download/cli-stable/install.sh`;

/**
 * Installs the stable command line from this product's own releases. `--yes` skips the installer's
 * own setup handoff, because the app always follows the install with a setup command bound to the
 * relay the person is connecting.
 */
export function formatCliInstallCommand(): string {
    return `curl -fsSL ${STABLE_INSTALL_SCRIPT_URL} | bash -s -- --yes`;
}
