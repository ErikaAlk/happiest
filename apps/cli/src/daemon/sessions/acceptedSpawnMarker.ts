import { readProcessInstanceFingerprint } from '@happier-dev/cli-common/processInstance';

import type { SpawnSessionOptions } from '@/rpc/handlers/registerSessionHandlers';

import {
  buildSessionRunnerRespawnDescriptorV1FromSpawnOptions,
  type RespawnDescriptorEncryptionMaterial,
} from '../processSupervision/sessionRunnerRespawnDescriptor';
import { writeSessionMarker } from '../sessionRegistry';

/**
 * Persists custody of a runner the daemon just spawned, before the spawn is acknowledged, so a
 * daemon restart can reattach or respawn it even if the runner never reports its session.
 */
export async function persistAcceptedSpawnMarker(
  params: Readonly<{
    pid: number;
    spawnOptions: SpawnSessionOptions;
    directory: string;
    existingSessionId?: string;
    encryptionMaterial: RespawnDescriptorEncryptionMaterial;
  }>,
  deps: Readonly<{ writeSessionMarkerFn?: typeof writeSessionMarker }> = {},
): Promise<void> {
  const respawn = buildSessionRunnerRespawnDescriptorV1FromSpawnOptions(
    {
      ...params.spawnOptions,
      directory: params.directory,
    },
    { encryptionMaterial: params.encryptionMaterial },
  );
  if (!respawn) {
    throw new Error(`Could not persist accepted spawn custody for PID ${params.pid}`);
  }
  const existingSessionId = typeof params.existingSessionId === 'string'
    ? params.existingSessionId.trim()
    : '';
  const processInstanceFingerprint = (await readProcessInstanceFingerprint(params.pid)) ?? undefined;
  // The runner can report its session while the identity read above is pending.
  await (deps.writeSessionMarkerFn ?? writeSessionMarker)({
    pid: params.pid,
    happySessionId: existingSessionId || `PID-${params.pid}`,
    startedBy: 'daemon',
    cwd: params.directory,
    ...(processInstanceFingerprint ? { processInstanceFingerprint } : {}),
    respawn,
  }, { keepMarkerOfSameProcessInstance: true });
}
