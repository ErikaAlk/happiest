import { describe, expect, it } from 'vitest';

import { mapClaudeStatuslineQuotaEvidence } from './statuslineQuota';

describe('Claude statusline quota evidence', () => {
    it('reads both official windows without inventing an absent window', () => {
        const evidence = mapClaudeStatuslineQuotaEvidence({ rate_limits: {
            five_hour: { used_percentage: 23.5, resets_at: 1_800_000_000 },
            seven_day: { used_percentage: 41.2, resets_at: 1_800_500_000 },
        } });
        expect(evidence.map(({ providerLimitId, utilization, resetAtMs }) => ({
            providerLimitId, utilization, resetAtMs,
        }))).toEqual([
            { providerLimitId: 'five_hour', utilization: 23.5, resetAtMs: 1_800_000_000_000 },
            { providerLimitId: 'seven_day', utilization: 41.2, resetAtMs: 1_800_500_000_000 },
        ]);
        expect(mapClaudeStatuslineQuotaEvidence({ rate_limits: {
            seven_day: { used_percentage: 0, resets_at: 1_800_500_000 },
        } }).map((entry) => entry.providerLimitId)).toEqual(['seven_day']);
        expect(mapClaudeStatuslineQuotaEvidence({})).toEqual([]);
    });
});
