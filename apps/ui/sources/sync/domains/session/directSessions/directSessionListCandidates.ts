import { DirectSessionsSourceSchema, readAgentRuntimeDescriptorV1ForProvider, type DirectSessionCandidateV1, type DirectSessionsProviderId, type DirectSessionsSource } from '@happier-dev/protocol';
import type { SessionListRenderableSession } from '../listing/sessionListRenderable';
import { AGENTS_CORE, resolveAgentIdFromSessionMetadata, type AgentResumeConfig } from '@happier-dev/agents';
import type { Metadata } from '../../state/storageTypes';
import { readDirectSessionLink } from './readDirectSessionLink';
import { normalizeLocalPathForComparison } from '@/utils/path/resolvePathRelativeToRoot';
import { resolveAbsolutePath } from '@/utils/path/pathUtils';

export type DirectSessionListCandidate = Readonly<{
    discoveryKey?: string;
    machine?: import('../../machines/machineDisplayRenderable').MachineDisplayRenderable;
    serverId: string;
    machineId: string;
    providerId: DirectSessionsProviderId;
    source: DirectSessionsSource;
    candidate: DirectSessionCandidateV1;
}>;

export type DirectSessionListIdentity = Readonly<{
    serverId: string;
    machineId: string;
    providerId: string;
    remoteSessionId: string;
    source?: DirectSessionsSource;
}>;

export function readSessionVendorIdentity(metadata: Metadata): Omit<DirectSessionListIdentity, 'serverId'> | null {
    const direct = readDirectSessionLink(metadata);
    if (direct) return { machineId: direct.machineId, providerId: direct.providerId, remoteSessionId: direct.remoteSessionId, source: direct.source };
    const providerId = resolveAgentIdFromSessionMetadata(metadata);
    if (!providerId || !metadata.machineId) return null;
    const resume: AgentResumeConfig = AGENTS_CORE[providerId].resume;
    const field = resume && 'vendorResumeIdField' in resume ? resume.vendorResumeIdField : null;
    const descriptor = readAgentRuntimeDescriptorV1ForProvider(metadata.agentRuntimeDescriptorV1, providerId);
    const descriptorSessionId = descriptor?.provider.vendorSessionId;
    const remoteSessionId = typeof descriptorSessionId === 'string' && descriptorSessionId.trim()
        ? descriptorSessionId.trim() : field ? metadata[field] : null;
    if (typeof remoteSessionId !== 'string' || !remoteSessionId) return null;
    const source = resume.resolveVendorSessionSource?.(metadata);
    return { machineId: metadata.machineId, providerId, remoteSessionId, ...(source ? { source } : {}) };
}

function sourceIdentity(source: DirectSessionsSource, homeDir?: string | null): string {
    const normalized = DirectSessionsSourceSchema.parse(source);
    const values = Object.entries(normalized).filter(([, value]) => value != null).map(([key, value]) => [key,
        typeof value === 'string' && ['configDir', 'homePath', 'agentDir', 'directory', 'cwd'].includes(key)
            ? normalizeLocalPathForComparison(resolveAbsolutePath(value, homeDir ?? undefined))
            : value,
    ]).sort(([left], [right]) => String(left).localeCompare(String(right)));
    return JSON.stringify(values);
}

export function buildDirectSessionListCandidateKey(value: DirectSessionListCandidate): string {
    return `direct-candidate:${JSON.stringify([value.serverId, value.machineId, value.providerId, sourceIdentity(value.source, value.machine?.metadata?.homeDir), value.candidate.remoteSessionId])}`;
}

export function applyDirectSessionDiscoveryResult(
    previous: readonly DirectSessionListCandidate[],
    result: Readonly<{
        discoveryKey: string;
        available: boolean;
        fullRefresh: boolean;
        candidates: readonly DirectSessionListCandidate[];
    }>,
): readonly DirectSessionListCandidate[] {
    if (!result.available) return previous.filter((item) => item.discoveryKey !== result.discoveryKey);
    const retained = previous.filter((item) => !result.fullRefresh || item.discoveryKey !== result.discoveryKey);
    const merged = new Map(retained.map((item) => [buildDirectSessionListCandidateKey(item), item]));
    for (const item of result.candidates) {
        const id = buildDirectSessionListCandidateKey(item);
        if (item.candidate.archived) merged.delete(id); else merged.set(id, item);
    }
    return [...merged.values()];
}

export function matchesDirectSessionListIdentity(value: DirectSessionListCandidate, existing: DirectSessionListIdentity): boolean {
    if (value.serverId !== existing.serverId || value.machineId !== existing.machineId
        || value.providerId !== existing.providerId || value.candidate.remoteSessionId !== existing.remoteSessionId) return false;
    if (existing.source) {
        return sourceIdentity(value.source, value.machine?.metadata?.homeDir) === sourceIdentity(existing.source, value.machine?.metadata?.homeDir);
    }
    const source = value.source;
    return source.kind === 'claudeConfig' && !source.configDir
        || source.kind === 'codexHome' && source.home === 'user' && !source.homePath
        || source.kind === 'piAgentDir' && !source.agentDir
        || source.kind === 'opencodeServer' && !source.baseUrl;
}

export function projectDirectSessionListCandidates(
    candidates: readonly DirectSessionListCandidate[],
    existing: readonly DirectSessionListIdentity[],
): SessionListRenderableSession[] {
    const unique = new Map<string, DirectSessionListCandidate>();
    for (const value of candidates) {
        if (value.candidate.archived || existing.some((identity) => matchesDirectSessionListIdentity(value, identity))) continue;
        unique.set(buildDirectSessionListCandidateKey(value), value);
    }
    return [...unique.values()].map((value) => ({
        id: buildDirectSessionListCandidateKey(value),
        seq: 0,
        createdAt: value.candidate.createdAtMs ?? value.candidate.updatedAtMs,
        updatedAt: value.candidate.updatedAtMs,
        meaningfulActivityAt: value.candidate.updatedAtMs,
        active: value.machine?.active !== false && value.candidate.activity === 'running',
        activeAt: value.candidate.updatedAtMs,
        metadataVersion: 0,
        agentStateVersion: 0,
        directCandidate: value,
        metadata: {
            name: value.candidate.title ?? value.candidate.remoteSessionId,
            path: typeof value.candidate.details?.cwd === 'string' ? value.candidate.details.cwd : '',
            machineId: value.machineId,
            flavor: value.providerId,
            directSessionV1: { v: 1, providerId: value.providerId },
        },
        thinking: false,
        thinkingAt: 0,
        presence: value.candidate.updatedAtMs,
    }));
}
