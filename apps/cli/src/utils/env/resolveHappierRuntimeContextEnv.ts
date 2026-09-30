/**
 * Single source of truth for the non-secret Happier runtime-context environment
 * variables that must be made *explicit* for child processes.
 *
 * These values are authoritative: they describe which Happier home directory and
 * which server a child process should use. They are derived from an explicit,
 * already-resolved selection (the daemon's server selection, or the process's
 * resolved `configuration`) rather than relying on whatever a parent happened to
 * inherit. Consumers should let these OVERRIDE inherited env for the same keys.
 *
 * Used by:
 * - the daemon when spawning session runners (`buildSpawnChildProcessEnv`)
 * - the shell-bridge command policy when HAPPIER_SHELL_BRIDGE_CONTEXT_ENV opts in
 *   to command-local context env for environments with stale shell startup exports
 *
 * NO secrets (access/refresh tokens, API keys, credential file contents) belong
 * here. Only home dir, active server id, daemon lifecycle scope, and resolved server/webapp URLs.
 */

export type HappierRuntimeServerContext = Readonly<{
  activeServerId: string;
  /** Canonical / public-facing server URL. */
  canonicalServerUrl: string;
  /** API / local server URL (equals canonical unless it is a split local/public stack). */
  apiServerUrl: string;
  webappUrl: string;
}>;

export type ResolveHappierRuntimeContextEnvInput = Readonly<{
  homeDir?: string | null;
  daemonLifecycleScopeId?: string | null;
  server?: HappierRuntimeServerContext | null;
}>;

/**
 * Canonical Happier runtime-context env keys, in a stable order. Useful for
 * callers that need to clear stale inherited values before applying the
 * authoritative selection.
 */
export const HAPPIER_RUNTIME_CONTEXT_ENV_KEYS = [
  'HAPPIEST_HOME_DIR',
  'HAPPIEST_ACTIVE_SERVER_ID',
  'HAPPIEST_DAEMON_LIFECYCLE_SCOPE_ID',
  'HAPPIEST_SERVER_URL',
  'HAPPIEST_LOCAL_SERVER_URL',
  'HAPPIEST_PUBLIC_SERVER_URL',
  'HAPPIEST_WEBAPP_URL',
] as const;

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Build the canonical map of Happier context env vars to SET.
 *
 * Keys that are not returned should be treated as absent by the caller: for a
 * non-split stack (api URL equals canonical URL) `HAPPIEST_LOCAL_SERVER_URL` and
 * `HAPPIEST_PUBLIC_SERVER_URL` are intentionally omitted, and any stale inherited
 * values for them should be cleared by the caller.
 *
 * Mirrors the daemon's child-process server-selection semantics so a
 * coding-agent subprocess receives exactly the same context the daemon gives a
 * session runner (split stacks point children at the local API while keeping the
 * public URL available for link/QR generation).
 */
export function resolveHappierRuntimeContextEnv(
  input: ResolveHappierRuntimeContextEnvInput,
): Record<string, string> {
  const out: Record<string, string> = {};

  const homeDir = nonEmpty(input.homeDir);
  if (homeDir) out.HAPPIEST_HOME_DIR = homeDir;

  const daemonLifecycleScopeId = nonEmpty(input.daemonLifecycleScopeId);
  if (daemonLifecycleScopeId) {
    out.HAPPIEST_DAEMON_LIFECYCLE_SCOPE_ID = daemonLifecycleScopeId;
  }

  const server = input.server;
  if (server) {
    const activeServerId = nonEmpty(server.activeServerId);
    if (activeServerId) out.HAPPIEST_ACTIVE_SERVER_ID = activeServerId;

    const canonical = nonEmpty(server.canonicalServerUrl);
    const api = nonEmpty(server.apiServerUrl);

    if (canonical && api && api !== canonical) {
      out.HAPPIEST_PUBLIC_SERVER_URL = canonical;
      out.HAPPIEST_LOCAL_SERVER_URL = api;
      out.HAPPIEST_SERVER_URL = api;
    } else if (canonical) {
      out.HAPPIEST_SERVER_URL = canonical;
    } else if (api) {
      out.HAPPIEST_SERVER_URL = api;
    }

    const webapp = nonEmpty(server.webappUrl);
    if (webapp) out.HAPPIEST_WEBAPP_URL = webapp;
  }

  return out;
}
