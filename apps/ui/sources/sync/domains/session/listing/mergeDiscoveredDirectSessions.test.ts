import { expect, it } from 'vitest';
import { mergeDiscoveredDirectSessions } from './mergeDiscoveredDirectSessions';
import type { SessionListRenderableSession } from './sessionListRenderable';
import type { SessionListViewItem } from './sessionListViewData';

it('keeps a newly linked direct session at its original vendor activity time', () => {
    const linked: SessionListRenderableSession = {
        id: 'linked', seq: 0, createdAt: 1000, updatedAt: 1000, meaningfulActivityAt: 1000, active: false, activeAt: 1000,
        metadataVersion: 0, agentStateVersion: 0, metadata: {
            path: '/project', machineId: 'machine', directSessionV1: { v: 1, providerId: 'claude' },
            vendorIdentity: { machineId: 'machine', providerId: 'claude', remoteSessionId: 'vendor', source: { kind: 'claudeConfig' } },
        }, thinking: false, thinkingAt: 0, presence: 1000,
    };
    const merged = mergeDiscoveredDirectSessions([{ type: 'session', serverId: 'server', session: linked }], [{
        serverId: 'server', machineId: 'machine', providerId: 'claude', source: { kind: 'claudeConfig' },
        candidate: { remoteSessionId: 'vendor', updatedAtMs: 20, activity: 'active_recently' },
    }], { groupInactiveSessionsByProject: false });
    const rows = merged?.filter((row) => row.type === 'session');
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.session.id).toBe('linked');
    expect(rows?.[0]?.session.meaningfulActivityAt).toBe(20);
    const imported = mergeDiscoveredDirectSessions([{ type: 'session', serverId: 'server', session: { ...linked, seq: 50 } }], [{
        serverId: 'server', machineId: 'machine', providerId: 'claude', source: { kind: 'claudeConfig' },
        candidate: { remoteSessionId: 'vendor', updatedAtMs: 20, activity: 'active_recently' },
    }], { groupInactiveSessionsByProject: false });
    expect(imported?.find((row) => row.type === 'session')?.session.meaningfulActivityAt).toBe(20);
    const managedActivity = mergeDiscoveredDirectSessions([{ type: 'session', serverId: 'server', session: {
        ...linked, seq: 0, meaningfulActivityAt: 2000,
    } }], [{
        serverId: 'server', machineId: 'machine', providerId: 'claude', source: { kind: 'claudeConfig' },
        candidate: { remoteSessionId: 'vendor', updatedAtMs: 20, activity: 'active_recently' },
    }], { groupInactiveSessionsByProject: false });
    expect(managedActivity?.find((row) => row.type === 'session')?.session.meaningfulActivityAt).toBe(2000);
});

it('preserves unscoped persisted sessions when adding discovery to the active server', () => {
    const managed: SessionListRenderableSession = {
        id: 'managed', seq: 0, createdAt: 10, updatedAt: 10, active: false, activeAt: 10,
        metadataVersion: 0, agentStateVersion: 0, metadata: { path: '/project', machineId: 'machine' },
        thinking: false, thinkingAt: 0, presence: 10,
    };
    const source: SessionListViewItem[] = [{ type: 'session', session: managed }];
    const merged = mergeDiscoveredDirectSessions(source, [{
        serverId: 'server', machineId: 'machine', providerId: 'claude', source: { kind: 'claudeConfig' },
        candidate: { remoteSessionId: 'vendor', updatedAtMs: 20, activity: 'active_recently' },
    }], { groupInactiveSessionsByProject: false, serverScope: { serverId: 'server' } });
    const rows = merged?.filter((row) => row.type === 'session');
    expect(rows?.map((row) => row.session.id)).toContain('managed');
    expect(rows?.find((row) => row.session.id === 'managed')?.session).toBe(managed);
});
