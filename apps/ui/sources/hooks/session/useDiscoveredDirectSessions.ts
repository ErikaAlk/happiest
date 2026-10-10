import * as React from 'react';
import { AppState } from 'react-native';
import { useAllMachines, useMachineListByServerId, useProfile, useSetting } from '@/sync/domains/state/storage';
import { useFeatureEnabled } from '@/hooks/server/useFeatureEnabled';
import { useResolvedActiveServerSelection } from '@/hooks/server/useEffectiveServerSelection';
import { machineDirectSessionsCandidatesList } from '@/sync/ops/machineDirectSessions';
import { listDirectBrowseProviderIds, resolveDirectBrowseSourceOptions, resolveDirectBrowseLinkEnsureRequestExtras } from '@/components/sessions/directSessions/browse/resolveDirectBrowseSourceOptions';
import { applyDirectSessionDiscoveryResult, type DirectSessionListCandidate } from '@/sync/domains/session/directSessions/directSessionListCandidates';
import { DirectSessionsSourceSchema } from '@happier-dev/protocol';
import { buildMachineDisplayRenderableFromMachine } from '@/sync/domains/machines/machineDisplayRenderable';
import { Modal } from '@/modal';
import { t } from '@/text';
import { DEFAULT_STALE_MS, getMachineCapabilitiesSnapshot, prefetchMachineCapabilitiesIfStale } from '@/hooks/server/useMachineCapabilitiesCache';
import { resolveDaemonCapabilitiesCacheKeySalt } from '@/hooks/server/useDaemonScopedMachineCapabilitiesCache';
import { buildAgentCliCapabilityId } from '@/capabilities/agentCliCapabilityId';
import type { AgentId } from '@/agents/catalog/catalog';
import { collectUnreportedDirectSessionDiscoveryErrors, runDirectSessionDiscoveryJob, settleDirectSessionDiscoveryJobs, type DirectSessionDiscoveryJob } from '@/sync/domains/session/directSessions/directSessionDiscoveryJobs';
import type { Machine } from '@/sync/domains/state/storageTypes';

const EMPTY_CANDIDATES: readonly DirectSessionListCandidate[] = Object.freeze([]);

export function buildDirectSessionDiscoveryTargets(serverId: string, machines: readonly Machine[]) {
    return machines.filter((machine) => machine.active && machine.metadata != null && !machine.revokedAt && !machine.replacedByMachineId)
        .map((machine) => ({ serverId, machineId: machine.id, activeAt: machine.activeAt, cacheKeySalt: resolveDaemonCapabilitiesCacheKeySalt(machine), machine: buildMachineDisplayRenderableFromMachine(machine) }));
}

export function useDiscoveredDirectSessions(dataActive: boolean): Readonly<{
    candidates: readonly DirectSessionListCandidate[];
    refresh: () => Promise<void>;
}> {
    const enabled = useFeatureEnabled('sessions.direct');
    const selection = useResolvedActiveServerSelection();
    const activeMachines = useAllMachines();
    const machinesByServer = useMachineListByServerId();
    const profile = useProfile();
    const connectedServicesProfileLabelByKey = useSetting('connectedServicesProfileLabelByKey');
    const completed = React.useRef(new Set<string>());
    const reportedErrors = React.useRef(new Map<string, string>());
    const [foreground, setForeground] = React.useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    const [observations, setObservations] = React.useState<Readonly<{ scope: string; candidates: readonly DirectSessionListCandidate[] }>>({ scope: '', candidates: EMPTY_CANDIDATES });
    const serverIds = selection.enabled ? selection.allowedServerIds : [selection.activeServerId];
    const scope = serverIds.join('\u0000');
    const targets = React.useMemo(() => serverIds.flatMap((serverId) => buildDirectSessionDiscoveryTargets(serverId, (
        serverId === selection.activeServerId ? activeMachines : machinesByServer[serverId] ?? []
    ))),
    [scope, selection.activeServerId, activeMachines, machinesByServer]);
    const sources = React.useMemo(() => listDirectBrowseProviderIds().flatMap((providerId) => resolveDirectBrowseSourceOptions({ providerId, profile, settings: { connectedServicesProfileLabelByKey } }).map((option) => ({ providerId, source: option.source }))),
    [profile, connectedServicesProfileLabelByKey]);
    const sourceScope = JSON.stringify(sources);
    const targetsRef = React.useRef(targets);
    targetsRef.current = targets;
    const refreshRef = React.useRef<((fullRefresh?: boolean) => Promise<void>) | null>(null);
    const refresh = React.useCallback(async () => { await refreshRef.current?.(true); }, []);

    React.useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') completed.current.clear();
            setForeground(state === 'active');
        });
        return () => subscription.remove();
    }, []);

    React.useEffect(() => {
        if (!enabled || !dataActive || !foreground) {
            completed.current.clear();
            return;
        }
        let cancelled = false;
        const observationScope = `${scope}\u0000${sourceScope}`;
        const jobs = new Map<string, DirectSessionDiscoveryJob>();
        const start = async (forceFullRefresh = false) => {
        const targets = targetsRef.current;
        const capabilityLoads = new Map(targets.map((target) => [JSON.stringify([target.serverId, target.machineId]), prefetchMachineCapabilitiesIfStale({
            machineId: target.machineId, serverId: target.serverId,
            cacheKeySalt: target.cacheKeySalt,
            staleMs: DEFAULT_STALE_MS,
            request: { requests: sources.map(({ providerId }) => ({ id: buildAgentCliCapabilityId(providerId as AgentId) })) },
        })]));
        const requestedJobs: Promise<void>[] = [];
        for (const target of targets) for (const { providerId, source } of sources) {
            const key = JSON.stringify([observationScope, target.serverId, target.machineId, providerId, source]);
            const fullRefresh = forceFullRefresh || !completed.current.has(key);
            function fail(message: string): never {
                throw Object.assign(new Error(message), { discoveryKey: key });
            }
            const publish = (available: boolean, out: readonly DirectSessionListCandidate[]) => {
                completed.current.add(key);
                reportedErrors.current.delete(key);
                setObservations((previous) => {
                    const candidates = applyDirectSessionDiscoveryResult(previous.scope === observationScope ? previous.candidates : [], {
                        discoveryKey: key, available, fullRefresh, candidates: out,
                    });
                    return previous.scope === observationScope && JSON.stringify(previous.candidates) === JSON.stringify(candidates)
                        ? previous : { scope: observationScope, candidates };
                });
            };
            const load = async (fullRefresh: boolean) => {
                await capabilityLoads.get(JSON.stringify([target.serverId, target.machineId]));
                if (cancelled) return;
                const capability = getMachineCapabilitiesSnapshot(target.machineId, target.serverId, target.cacheKeySalt)?.response.results[buildAgentCliCapabilityId(providerId as AgentId)];
                if (!capability?.ok) {
                    const message = `${providerId} · ${target.machine.metadata?.displayName ?? target.machineId}：电脑代理能力检测失败`;
                    fail(message);
                }
                const capabilityData = capability.data;
                if (capabilityData && typeof capabilityData === 'object' && 'available' in capabilityData && capabilityData.available === false) {
                    publish(false, []);
                    return;
                }
                const out: DirectSessionListCandidate[] = [];
                let cursor: string | undefined;
                const visited = new Set<string>();
                do {
                    if (cancelled) return;
                    const result = await machineDirectSessionsCandidatesList({ machineId: target.machineId, providerId, source, limit: 500, ...(cursor ? { cursor } : {}) }, { serverId: target.serverId });
                    if (cancelled) return;
                    if (!result.ok) {
                        const message = `${providerId} · ${target.machine.metadata?.displayName ?? target.machineId}：会话发现失败（${result.errorCode}）`;
                        fail(message);
                    }
                    for (const candidate of result.candidates) {
                        const extras = resolveDirectBrowseLinkEnsureRequestExtras({ providerId, source, candidate });
                        const effectiveSource = extras.source ? DirectSessionsSourceSchema.parse(extras.source) : source;
                        out.push({ ...target, discoveryKey: key, providerId, source: effectiveSource, candidate });
                    }
                    cursor = result.nextCursor ?? undefined;
                    if (cursor && visited.has(cursor)) fail('会话发现返回重复的分页游标');
                    if (cursor) visited.add(cursor);
                } while (cursor && fullRefresh);
                if (cancelled) return;
                publish(true, out);
            };
            requestedJobs.push(runDirectSessionDiscoveryJob(jobs, key, fullRefresh, load));
        }
        const failure = await settleDirectSessionDiscoveryJobs(requestedJobs, () => cancelled);
        if (failure) {
            const messages = collectUnreportedDirectSessionDiscoveryErrors(failure, reportedErrors.current);
            if (messages.length > 0) Modal.alert(t('common.error'), messages.join('\n'));
        } else if (!cancelled) {
            reportedErrors.current.clear();
        }
        };
        refreshRef.current = start;
        void start();
        return () => {
            cancelled = true;
            if (refreshRef.current === start) refreshRef.current = null;
        };
    }, [dataActive, enabled, foreground, scope, sourceScope, sources]);

    React.useEffect(() => { void refreshRef.current?.(); }, [targets]);
    const candidates = React.useMemo(() => {
        if (!enabled || observations.scope !== `${scope}\u0000${sourceScope}`) return EMPTY_CANDIDATES;
        return observations.candidates.flatMap((candidate) => {
            const machines = candidate.serverId === selection.activeServerId ? activeMachines : machinesByServer[candidate.serverId] ?? [];
            const machine = machines.find((value) => value.id === candidate.machineId);
            if (machine?.revokedAt || machine?.replacedByMachineId) return [];
            const current = machine ? buildMachineDisplayRenderableFromMachine(machine) : candidate.machine ? { ...candidate.machine, active: false } : undefined;
            return current?.active === candidate.machine?.active && current?.metadata?.displayName === candidate.machine?.metadata?.displayName
                ? [candidate] : [{ ...candidate, machine: current }];
        });
    }, [activeMachines, enabled, machinesByServer, observations, scope, selection.activeServerId, sourceScope]);
    return React.useMemo(() => ({ candidates, refresh }), [candidates, refresh]);
}
