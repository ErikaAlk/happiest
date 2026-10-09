import type { DirectSessionsProviderId, DirectSessionsSource } from '@happier-dev/protocol';

import { killProcessTree } from '@/agent/runtime/process/killProcessTree';
import { getDirectSessionProviderOps } from '@/backends/catalog';
import type { DirectSessionRunningProcess } from '@/backends/directSessions/providerOps';
import type { DaemonSessionMarker } from '@/daemon/sessionRegistry';

/**
 * Provider processes that hold a direct session but were not started by the Happier runner of that
 * same Happier session: Claude Desktop, a terminal, or another Happier session. Resuming the
 * provider session while one of them runs forks it into two writers of one conversation.
 * A process whose parent is unknown counts as external.
 */
export function selectExternalDirectSessionProcesses(params: Readonly<{
  runningProcesses: readonly DirectSessionRunningProcess[];
  liveMarkers: readonly DaemonSessionMarker[];
  sessionId: string;
}>): DirectSessionRunningProcess[] {
  const ownRunnerPids = new Set(
    params.liveMarkers.filter((marker) => marker.happySessionId === params.sessionId).map((marker) => marker.pid),
  );
  return params.runningProcesses.filter((running) => running.parentPid === null || !ownRunnerPids.has(running.parentPid));
}

export async function readExternalDirectSessionProcesses(params: Readonly<{
  providerId: DirectSessionsProviderId;
  source: DirectSessionsSource;
  remoteSessionId: string;
  sessionId: string;
  liveMarkers: readonly DaemonSessionMarker[];
}>): Promise<DirectSessionRunningProcess[]> {
  const ops = await getDirectSessionProviderOps(params.providerId);
  if (!ops.getActivity) return [];
  const activity = await ops.getActivity({ source: params.source, remoteSessionId: params.remoteSessionId });
  return selectExternalDirectSessionProcesses({
    runningProcesses: activity.runningProcesses,
    liveMarkers: params.liveMarkers,
    sessionId: params.sessionId,
  });
}

/** Ends processes just returned by {@link readExternalDirectSessionProcesses}, whose identity it verified. */
export async function stopExternalDirectSessionProcesses(processes: readonly DirectSessionRunningProcess[]): Promise<void> {
  for (const running of processes) {
    await running.verifyBeforeStop?.();
    await killProcessTree({ pid: running.pid });
  }
}
