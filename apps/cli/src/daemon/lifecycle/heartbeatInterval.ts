const DEFAULT_DAEMON_HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * The daemon heartbeat period. It also bounds the Windows process-table probe: the heartbeat
 * skips its ticks while one is still running, so a probe that outlives a period would stall
 * every later heartbeat.
 */
export function readDaemonHeartbeatIntervalMs(): number {
  const parsed = Number.parseInt(process.env.HAPPIER_DAEMON_HEARTBEAT_INTERVAL ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAEMON_HEARTBEAT_INTERVAL_MS;
}
