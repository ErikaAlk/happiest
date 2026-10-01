const githubRepo = 'ErikaAlk/happiest';

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
  /** GitHub repository (`owner/name`) that hosts this product's source, releases and issues. */
  githubRepo,
  /** Where people report problems. */
  issuesUrl: `https://github.com/${githubRepo}/issues`,
  /** Server a fresh install connects to; the same address serves the web app. */
  defaultServerUrl: 'https://happiest.erikaalk.click',
  /** Command installed for the stable ring; other rings append their rolling suffix. */
  commandName: 'happiest',
  /** Home directory under the user's home; `HAPPIEST_HOME_DIR` overrides it. */
  homeDirName: '.happiest',
  /**
   * Directory that holds the CLI's Node entrypoint (`index.mjs`) in the CLI package and in every
   * installed CLI payload. Upstream Happier uses `package-dist`; its `doctor clean` kills processes
   * whose command line contains that name, so this product uses its own.
   */
  cliRuntimeDirName: 'happiest-runtime',
  /** Directory of the pinned session-runner snapshots of the CLI runtime; upstream uses `.runner-snapshots`. */
  runnerSnapshotsDirName: '.happiest-runner-snapshots',
  /** Command of the launcher that runs the CLI from this repository's sources during development. */
  sourceCommandName: 'happiest-source',
  /** Home directory of the source launcher, kept apart from an installed CLI's home. */
  sourceHomeDirName: '.happiest-source',
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
  /**
   * Tauri identifier of the stable desktop app (preview and dev append `.preview` and `.publicdev`).
   * It names the app's data directories and installer registration, so it differs from upstream's
   * `dev.happier.app`.
   */
  desktopAppIdentifier: 'click.erikaalk.happiest',
} as const;

export type ProductIdentity = typeof productIdentity;
