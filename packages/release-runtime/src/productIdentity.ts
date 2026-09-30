/**
 * The product this repository builds and installs on a machine.
 *
 * Every name that lets this product coexist with an installed upstream Happier on one
 * machine (its command, home directory, background services and release source) is read
 * from here. Artifacts that cannot import TypeScript (installer scripts, Tauri config and
 * Rust constants, Dockerfiles, workflows) carry the same literals and are checked against
 * this module by a contract test.
 */
export const productIdentity = {
  /** Display name shown to people. */
  productName: 'Happiest',
  /** Command installed for the stable ring; other rings append their rolling suffix. */
  commandName: 'happiest',
  /** Home directory under the user's home; `HAPPIEST_HOME_DIR` overrides it. */
  homeDirName: '.happiest',
} as const;

export type ProductIdentity = typeof productIdentity;
