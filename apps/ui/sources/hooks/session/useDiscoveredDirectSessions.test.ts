import { describe, expect, it } from 'vitest';
import { createMachineFixture } from '@/dev/testkit/fixtures/machineFixtures';
import { buildDirectSessionDiscoveryTargets } from './useDiscoveredDirectSessions';

describe('direct session discovery readiness', () => {
    it('waits for machine metadata hydration before exposing discovery targets', () => {
        const machine = createMachineFixture({ active: true, daemonStateVersion: 2 });
        expect(buildDirectSessionDiscoveryTargets('server', [{ ...machine, metadata: null, daemonStateVersion: 0 }])).toEqual([]);
        const targets = buildDirectSessionDiscoveryTargets('server', [machine]);
        expect(targets).toHaveLength(1);
        expect(targets[0]).toMatchObject({ serverId: 'server', machineId: machine.id, cacheKeySalt: 2 });
        expect(targets[0]?.machine.metadata?.homeDir).toBe(machine.metadata?.homeDir);
    });
});
