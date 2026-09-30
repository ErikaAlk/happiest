export function sanitizeCliTestEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const sanitized = { ...env };
  // Fixtures select their own relay and credential namespace. Ambient stack
  // selection takes precedence over the fixture URL unless it is removed.
  delete sanitized.HAPPIEST_ACTIVE_SERVER_ID;
  delete sanitized.HAPPIEST_DAEMON_SERVICE_INSTANCE_ID;
  delete sanitized.HAPPIEST_DAEMON_SERVICE_SERVER_URL;
  return sanitized;
}
