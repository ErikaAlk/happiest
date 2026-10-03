import { NoServerConfiguredError } from '@/server/noServerConfiguredError';

/**
 * The server gate in front of daemon startup.
 *
 * The product ships no built-in server, so a background service installed by a fresh install can
 * start before the user has added one. Such a daemon waits for a server the same way it waits for
 * credentials (`HAPPIER_DAEMON_WAIT_FOR_AUTH`, same timeout), re-reading settings until one is
 * active; every later step of startup then runs for that server. A daemon nobody asked to wait
 * fails with the setup hint instead.
 */
export async function waitForActiveServer(opts: {
  isInteractive: boolean;
  waitForAuthEnabled: boolean;
  waitForAuthTimeoutMs: number;
  hasActiveServer: () => boolean;
  refresh: () => void;
  resolvesWhenShutdownRequested: Promise<unknown>;
  logger: { debug: (message: string) => void };
  sleepMs?: number;
}): Promise<'continue' | 'shutdown'> {
  if (opts.hasActiveServer()) return 'continue';
  if (opts.isInteractive || !opts.waitForAuthEnabled) throw new NoServerConfiguredError();

  let shutdownRequested = false;
  void opts.resolvesWhenShutdownRequested.then(() => {
    shutdownRequested = true;
  });

  opts.logger.debug('[DAEMON RUN] No server configured yet; waiting for one to be added');
  const sleepMs = typeof opts.sleepMs === 'number' ? opts.sleepMs : 250;
  const startWait = Date.now();
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
    if (shutdownRequested) {
      opts.logger.debug('[DAEMON RUN] Shutdown requested while waiting for a server');
      return 'shutdown';
    }
    opts.refresh();
    if (opts.hasActiveServer()) {
      opts.logger.debug('[DAEMON RUN] Server added, continuing daemon startup');
      return 'continue';
    }
    if (opts.waitForAuthTimeoutMs > 0 && Date.now() - startWait > opts.waitForAuthTimeoutMs) {
      opts.logger.debug('[DAEMON RUN] Timed out waiting for a server');
      throw new NoServerConfiguredError();
    }
  }
}
