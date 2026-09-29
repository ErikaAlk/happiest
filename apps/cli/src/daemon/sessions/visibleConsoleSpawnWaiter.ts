import type { SpawnSessionResult } from '@/rpc/handlers/registerSessionHandlers';
import { SPAWN_SESSION_ERROR_CODES } from '@/rpc/handlers/registerSessionHandlers';
import type { ChildExit } from './onChildExited';
import type { TrackedSession } from '../types';
import { waitForSessionWebhook } from '../spawn/waitForSessionWebhook';
import { logger } from '@/ui/logger';

export function waitForVisibleConsoleSessionWebhook(params: Readonly<{
  pid: number;
  pollMs: number;
  /**
   * The spawned PID is a launcher that exits once it hands the runner off (`wt.exe`). Its exit
   * is only watched after the runner reports, to hand tracking over to the runner.
   */
  pollOnlyAfterReport?: boolean;
  pidToAwaiter: Map<number, (session: TrackedSession) => void>;
  pidToSpawnResultResolver: Map<number, (result: SpawnSessionResult) => void>;
  pidToSpawnWebhookTimeout: Map<number, ReturnType<typeof setTimeout>>;
  onChildExited: (pid: number, exit: ChildExit) => void | Promise<void>;
}>): Promise<SpawnSessionResult> {
  const { pid, pollMs, pidToAwaiter, pidToSpawnResultResolver, pidToSpawnWebhookTimeout, onChildExited } = params;
  let interval: ReturnType<typeof setInterval> | null = null;
  const stopExitPoll = () => {
    if (interval) clearInterval(interval);
    interval = null;
  };
  const startExitPoll = () => setInterval(() => {
    try {
      process.kill(pid, 0);
    } catch {
      stopExitPoll();
      const resolveSpawn = pidToSpawnResultResolver.get(pid);
      if (resolveSpawn) {
        pidToSpawnResultResolver.delete(pid);
        const timeout = pidToSpawnWebhookTimeout.get(pid);
        if (timeout) clearTimeout(timeout);
        pidToSpawnWebhookTimeout.delete(pid);
        pidToAwaiter.delete(pid);
      }
      void (async () => {
        try {
          await onChildExited(pid, { reason: 'process-exited', code: null, signal: null });
        } catch (error) {
          logger.warn('[DAEMON RUN] Failed to complete visible-console exit cleanup; retaining tracked custody', { pid, error });
          resolveSpawn?.({
            type: 'error',
            errorCode: SPAWN_SESSION_ERROR_CODES.SPAWN_FAILED,
            errorMessage: 'startup_retirement_incomplete:exit_cleanup_incomplete',
          });
          return;
        }
        resolveSpawn?.({
          type: 'error',
          errorCode: SPAWN_SESSION_ERROR_CODES.CHILD_EXITED_BEFORE_WEBHOOK,
          errorMessage: `Child process exited before session webhook (pid=${pid})`,
        });
      })();
    }
  }, pollMs);
  const watchExit = () => {
    interval = startExitPoll();
    if (typeof interval.unref === 'function') {
      interval.unref();
    }
  };
  if (params.pollOnlyAfterReport !== true) watchExit();

  const completion = waitForSessionWebhook({
    pid,
    pidToAwaiter,
    pidToSpawnResultResolver,
    pidToSpawnWebhookTimeout,
    timeoutErrorMessage: `Session webhook timeout for PID ${pid}`,
    onTimeout: stopExitPoll,
  });
  if (params.pollOnlyAfterReport === true) {
    void completion.then((result) => {
      if (result.type === 'success') watchExit();
    });
  }
  return completion;
}
