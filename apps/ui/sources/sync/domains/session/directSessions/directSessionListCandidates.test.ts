import { describe, expect, it } from 'vitest';
import { applyDirectSessionDiscoveryResult, projectDirectSessionListCandidates, readSessionVendorIdentity, type DirectSessionListCandidate } from './directSessionListCandidates';
import type { Metadata } from '../../state/storageTypes';

const candidate: DirectSessionListCandidate = {
    serverId: 'server-a', machineId: 'machine-a', providerId: 'claude', source: { kind: 'claudeConfig' },
    candidate: { remoteSessionId: 'vendor-a', updatedAtMs: 100, activity: 'active_recently' },
};

describe('direct session list discovery projection', () => {
    it('removes an unavailable provider while retaining another source', () => {
        const unavailable = { ...candidate, discoveryKey: 'source-a' };
        const retained = { ...candidate, discoveryKey: 'source-b', serverId: 'server-b' };
        expect(applyDirectSessionDiscoveryResult([unavailable, retained], {
            discoveryKey: 'source-a', available: false, fullRefresh: false, candidates: [],
        })).toEqual([retained]);
    });
    it('deduplicates a canonical managed vendor identity without legacy metadata fields', () => {
        const metadata = {
            path: '/work', host: 'computer', machineId: 'machine-a', flavor: 'codex',
            agentRuntimeDescriptorV1: { v: 1, providerId: 'codex', provider: { backendMode: 'appServer', vendorSessionId: 'vendor-a', home: 'user' } },
        } satisfies Metadata;
        expect(readSessionVendorIdentity(metadata)?.remoteSessionId).toBe('vendor-a');
    });
    it('matches equivalent Windows source paths without collapsing distinct homes', () => {
        const custom = { ...candidate, source: { kind: 'claudeConfig' as const, configDir: 'C:\\Users\\alice\\.claude' } };
        expect(projectDirectSessionListCandidates([custom], [{
            serverId: 'server-a', machineId: 'machine-a', providerId: 'claude', remoteSessionId: 'vendor-a',
            source: { kind: 'claudeConfig', configDir: 'C:/Users/alice/.claude/' },
        }])).toHaveLength(0);
    });

    it('preserves managed Codex connected-service source affinity', () => {
        const metadata = {
            path: '/work', host: 'computer', machineId: 'machine-a', flavor: 'codex', codexSessionId: 'vendor-a',
            agentRuntimeDescriptorV1: { v: 1, providerId: 'codex', provider: { backendMode: 'appServer', home: 'connectedService', connectedServiceId: 'openai-codex', connectedServiceProfileId: 'work' } },
        } satisfies Metadata;
        expect(readSessionVendorIdentity(metadata)?.source).toEqual({ kind: 'codexHome', home: 'connectedService', connectedServiceId: 'openai-codex', connectedServiceProfileId: 'work' });
    });
    it('removes an already managed vendor session without hiding the same id on another machine or server', () => {
        const rows = projectDirectSessionListCandidates([
            candidate,
            { ...candidate, serverId: 'server-b' },
            { ...candidate, machineId: 'machine-b' },
        ], [{ serverId: 'server-a', machineId: 'machine-a', providerId: 'claude', remoteSessionId: 'vendor-a' }]);
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.metadata?.machineId)).toEqual(['machine-a', 'machine-b']);
    });

    it('keeps different source identities and uses vendor activity time', () => {
        const custom = { ...candidate, source: { kind: 'claudeConfig' as const, configDir: 'C:/custom' } };
        const rows = projectDirectSessionListCandidates([candidate, custom], [{
            serverId: 'server-a', machineId: 'machine-a', providerId: 'claude', remoteSessionId: 'vendor-a',
            source: candidate.source,
        }]);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.meaningfulActivityAt).toBe(100);
    });

    it('merges duplicate discovery results without creating a persistent session', () => {
        const rows = projectDirectSessionListCandidates([candidate, candidate], []);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.id.startsWith('direct-candidate:')).toBe(true);
    });
});
