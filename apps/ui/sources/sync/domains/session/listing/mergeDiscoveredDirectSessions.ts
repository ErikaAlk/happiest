import { buildSessionListViewData, type BuildSessionListViewDataOptions, type SessionListViewItem } from './sessionListViewData';
import { matchesDirectSessionListIdentity, projectDirectSessionListCandidates, type DirectSessionListCandidate, type DirectSessionListIdentity } from '../directSessions/directSessionListCandidates';
import type { MachineDisplayRenderable } from '../../machines/machineDisplayRenderable';
import type { SessionListRenderableSession } from './sessionListRenderable';

export function mergeDiscoveredDirectSessions(
    source: SessionListViewItem[] | null,
    candidates: readonly DirectSessionListCandidate[],
    options: BuildSessionListViewDataOptions,
): SessionListViewItem[] | null {
    if (!source || candidates.length === 0) return source;
    const existing: DirectSessionListIdentity[] = [];
    for (const item of source) {
        const serverId = item.serverId ?? options.serverScope?.serverId;
        if (item.type !== 'session' || !serverId || !item.session.metadata?.vendorIdentity) continue;
        existing.push({ serverId, ...item.session.metadata.vendorIdentity });
    }
    const projected = projectDirectSessionListCandidates(candidates, existing);
    const byServer = new Map<string, { name?: string; sessions: Record<string, SessionListRenderableSession>; machines: Record<string, MachineDisplayRenderable> }>();
    const groupFor = (serverId: string) => {
        let group = byServer.get(serverId);
        if (!group) {
            group = { sessions: {}, machines: {} };
            byServer.set(serverId, group);
        }
        return group;
    };
    for (const item of source) {
        const serverId = item.serverId ?? options.serverScope?.serverId;
        if (!serverId) throw new Error('Session list discovery requires server scope');
        const group = groupFor(serverId);
        group.name = item.serverName;
        if (item.type === 'session') {
            const identity = item.session.metadata?.vendorIdentity;
            const candidate = item.session.metadata?.directSessionV1 && identity
                ? candidates.find((value) => matchesDirectSessionListIdentity(value, { serverId, ...identity })) : undefined;
            group.sessions[item.session.id] = candidate ? {
                ...item.session,
                createdAt: candidate.candidate.createdAtMs ?? candidate.candidate.updatedAtMs,
                updatedAt: candidate.candidate.updatedAtMs,
                meaningfulActivityAt: Math.max(candidate.candidate.updatedAtMs,
                    (item.session.meaningfulActivityAt ?? 0) > item.session.createdAt
                        ? item.session.meaningfulActivityAt ?? 0 : 0),
            } : item.session;
        }
        if (item.type === 'header' && item.machine) group.machines[item.machine.id] = item.machine;
    }
    for (const session of projected) {
        const value = session.directCandidate;
        if (!value) throw new Error('Discovered session is missing its candidate identity');
        const group = groupFor(value.serverId);
        group.sessions[session.id] = session;
        if (value.machine) group.machines[value.machineId] = value.machine;
    }
    return [...byServer].flatMap(([serverId, group]) => buildSessionListViewData(group.sessions, group.machines, {
        ...options, serverScope: { serverId, serverName: group.name },
    }));
}
