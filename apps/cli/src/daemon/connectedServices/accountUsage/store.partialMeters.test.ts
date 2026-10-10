import { describe, expect, it } from 'vitest';
import { buildProviderAccountUsageSnapshotFromConnectedServiceQuotaObservation } from './fromConnectedServiceQuotaObservation';
import { createProviderAccountUsageStore } from './store';

function snapshot(window: string, usedPct: number, fetchedAt: number) {
    return buildProviderAccountUsageSnapshotFromConnectedServiceQuotaObservation({ snapshot: {
        v: 1, serviceId: 'claude-subscription', providerId: 'claude', profileId: 'native:test',
        activeAccountId: 'account-one', fetchedAt, staleAfterMs: 300_000,
        source: 'in_band_provider_snapshot', confidence: 'exact', planLabel: null, accountLabel: null,
        meters: [{ meterId: window, label: window, used: null, limit: null, unit: 'unknown',
            utilizationPct: usedPct, remainingPct: 100 - usedPct, resetsAt: fetchedAt + 100_000,
            status: 'ok', details: {} }],
    } });
}

describe('partial account usage observations', () => {
    it('removes an expired window when another window advances', () => {
        const store = createProviderAccountUsageStore();
        const now = Date.now();
        const first = snapshot('five_hour', 20, now - 200_000);
        store.recordSnapshot(first, { partialMeters: true });
        store.recordSnapshot(snapshot('seven_day', 40, now), { partialMeters: true });
        expect(store.resolveRecordId(first.recordId)?.meters.map((meter) => meter.meterId)).toEqual(['seven_day']);
    });
    it('retains the other window and rejects an older partial update', () => {
        const store = createProviderAccountUsageStore();
        const now = Date.now();
        const first = snapshot('five_hour', 20, now - 3_000);
        store.recordSnapshot(first, { partialMeters: true });
        store.recordSnapshot(snapshot('seven_day', 40, now - 2_000), { partialMeters: true });
        store.recordSnapshot(snapshot('five_hour', 30, now - 1_000), { partialMeters: true });
        store.recordSnapshot(snapshot('five_hour', 10, now - 4_000), { partialMeters: true });
        expect(store.resolveRecordId(first.recordId)?.meters.map((meter) => [meter.meterId, meter.utilizationPct]))
            .toEqual([['five_hour', 30], ['seven_day', 40]]);
        store.recordSnapshot(snapshot('seven_day', 50, now));
        expect(store.resolveRecordId(first.recordId)?.meters.map((meter) => meter.meterId)).toEqual(['seven_day']);
    });
});
