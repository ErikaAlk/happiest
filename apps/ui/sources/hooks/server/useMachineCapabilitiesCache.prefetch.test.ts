import { describe, expect, it } from 'vitest';
import { getMachineCapabilitiesCacheState, prefetchMachineCapabilities, prefetchMachineCapabilitiesIfStale } from './useMachineCapabilitiesCache';

describe('capability prefetch completion', () => {
    it('waits for a running capability detection before completing a stale prefetch', async () => {
        const params = {
            machineId: 's11-unconfigured-machine',
            serverId: 's11-unconfigured-server',
            request: { requests: [{ id: 'cli.codex' as const }] },
        };
        const detection = prefetchMachineCapabilities(params);
        await Promise.resolve();
        expect(getMachineCapabilitiesCacheState(params.machineId, params.serverId)?.status).toBe('loading');
        await prefetchMachineCapabilitiesIfStale({ ...params, staleMs: 24 * 60 * 60 * 1000 });
        const state = getMachineCapabilitiesCacheState(params.machineId, params.serverId);
        expect(state).not.toBeNull();
        expect(state?.status).not.toBe('loading');
        await detection;
    });
});
