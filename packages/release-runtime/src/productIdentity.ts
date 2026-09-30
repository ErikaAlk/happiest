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
  /** launchd label prefix of the background daemon service. */
  daemonServiceLaunchdLabelPrefix: 'com.happiest.cli.daemon',
  /** systemd unit and Windows task/wrapper prefix of the background daemon service. */
  daemonServiceUnitPrefix: 'happiest-daemon',
  /** Windows Task Scheduler folder that holds every scheduled task of this product. */
  windowsTaskFolder: 'Happiest',
  /** Directory name under machine-wide locations (`/opt`, `/etc`, `/var/lib`, `/var/log`, `C:\ProgramData`). */
  systemDirName: 'happiest',
  /** Default port of the local relay server; upstream Happier's relay defaults to 3005. */
  relayDefaultPort: 3015,
} as const;

export type ProductIdentity = typeof productIdentity;
