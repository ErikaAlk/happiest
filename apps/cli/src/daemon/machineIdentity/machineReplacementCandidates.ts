import type { MachineReplacementReason } from '@happier-dev/protocol';

import { configuration } from '@/configuration';
import { readSettings, updateSettings, type MachineReplacementCandidate, type Settings } from '@/persistence';

function normalizeAccountId(accountId: string | null | undefined): string {
  return typeof accountId === 'string' ? accountId.trim() : '';
}

function normalizeMachineId(machineId: string | null | undefined): string {
  return typeof machineId === 'string' ? machineId.trim() : '';
}

function removeMachineReplacementCandidate(
  settings: Settings,
  activeServerId: string,
  accountId: string,
): Settings {
  const byServer = { ...(settings.machineReplacementCandidatesByServerIdByAccountId ?? {}) };
  const byAccount = { ...(byServer[activeServerId] ?? {}) };
  if (!(accountId in byAccount)) return settings;
  delete byAccount[accountId];
  if (Object.keys(byAccount).length) byServer[activeServerId] = byAccount;
  else delete byServer[activeServerId];
  return {
    ...settings,
    machineReplacementCandidatesByServerIdByAccountId: Object.keys(byServer).length ? byServer : {},
  };
}

function removeAcknowledgedMachineReplacementCandidate(
  settings: Settings,
  activeServerId: string,
  accountId: string,
  replacesMachineId: string,
): Settings {
  const byServer = { ...(settings.machineReplacementCandidatesByServerIdByAccountId ?? {}) };
  let didRemove = false;

  const serverIds = new Set<string>([
    activeServerId,
    ...Object.keys(byServer),
  ]);

  for (const serverId of serverIds) {
    const byAccount = { ...(byServer[serverId] ?? {}) };
    const existing = byAccount[accountId];
    if (!existing || existing.machineId !== replacesMachineId) continue;
    delete byAccount[accountId];
    didRemove = true;
    if (Object.keys(byAccount).length) byServer[serverId] = byAccount;
    else delete byServer[serverId];
  }

  if (!didRemove) return settings;
  return {
    ...settings,
    machineReplacementCandidatesByServerIdByAccountId: Object.keys(byServer).length ? byServer : {},
  };
}

function findUnambiguousMachineReplacementCandidateForAccount(
  settings: Settings,
  activeServerId: string,
  accountId: string,
): MachineReplacementCandidate | null {
  const byServer = settings.machineReplacementCandidatesByServerIdByAccountId ?? {};
  const activeCandidate = byServer[activeServerId]?.[accountId];
  if (activeCandidate?.machineId) return activeCandidate;

  const fallbackCandidates = Object.entries(byServer)
    .filter(([serverId]) => serverId !== activeServerId)
    .map(([, byAccount]) => byAccount?.[accountId])
    .filter((candidate): candidate is MachineReplacementCandidate => Boolean(candidate?.machineId));

  return fallbackCandidates.length === 1 ? fallbackCandidates[0] : null;
}

export async function recordMachineReplacementCandidateForActiveServer(params: Readonly<{
  accountId: string | null | undefined;
  machineId: string | null | undefined;
  replacementReason: MachineReplacementReason;
  now?: number;
}>): Promise<void> {
  const accountId = normalizeAccountId(params.accountId);
  const machineId = normalizeMachineId(params.machineId);
  if (!accountId || !machineId) return;

  const activeServerId = configuration.activeServerId;
  await updateSettings((settings) => {
    const byServer = { ...(settings.machineReplacementCandidatesByServerIdByAccountId ?? {}) };
    const byAccount = { ...(byServer[activeServerId] ?? {}) };
    byAccount[accountId] = {
      machineId,
      replacementReason: params.replacementReason,
      createdAt: params.now ?? Date.now(),
    };
    byServer[activeServerId] = byAccount;
    return {
      ...settings,
      machineReplacementCandidatesByServerIdByAccountId: byServer,
    };
  });
}

export async function readMachineReplacementCandidateForActiveServer(params: Readonly<{
  accountId: string | null | undefined;
}>): Promise<MachineReplacementCandidate | null> {
  const accountId = normalizeAccountId(params.accountId);
  if (!accountId) return null;
  const activeServerId = configuration.activeServerId;
  const settings = await readSettings();
  return findUnambiguousMachineReplacementCandidateForAccount(settings, activeServerId, accountId);
}

export async function clearMachineReplacementCandidateForActiveServer(params: Readonly<{
  accountId: string | null | undefined;
}>): Promise<void> {
  const accountId = normalizeAccountId(params.accountId);
  if (!accountId) return;
  const activeServerId = configuration.activeServerId;
  await updateSettings((settings) => removeMachineReplacementCandidate(settings, activeServerId, accountId));
}

export async function consumeMachineReplacementCandidateAfterRegistration(params: Readonly<{
  accountId: string | null | undefined;
  didRegister: boolean;
  replacesMachineId: string | null | undefined;
}>): Promise<void> {
  if (!params.didRegister) return;
  const accountId = normalizeAccountId(params.accountId);
  const replacesMachineId = normalizeMachineId(params.replacesMachineId);
  if (!accountId || !replacesMachineId) return;

  const activeServerId = configuration.activeServerId;
  await updateSettings((settings) => {
    return removeAcknowledgedMachineReplacementCandidate(
      settings,
      activeServerId,
      accountId,
      replacesMachineId,
    );
  });
}
