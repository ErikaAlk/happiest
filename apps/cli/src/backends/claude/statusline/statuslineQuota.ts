import { z } from 'zod';
import type { NormalizedProviderUsageLimitDetailsV1 } from '../connectedServices/mapClaudeRateLimitEventToUsageDetails';
import type { ClaudeStatuslinePayload } from './statuslinePayload';

const windowSchema = z.object({
    used_percentage: z.number().finite().min(0).max(100),
    resets_at: z.number().finite().nonnegative(),
});

export function mapClaudeStatuslineQuotaEvidence(payload: ClaudeStatuslinePayload): NormalizedProviderUsageLimitDetailsV1[] {
    const limits = payload.rate_limits;
    if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return [];
    const result: NormalizedProviderUsageLimitDetailsV1[] = [];
    for (const providerLimitId of ['five_hour', 'seven_day'] as const) {
        const parsed = windowSchema.safeParse(limits[providerLimitId]);
        if (!parsed.success) continue;
        result.push({
            v: 1, providerLimitId, utilization: parsed.data.used_percentage,
            resetAtMs: parsed.data.resets_at * 1_000, retryAfterMs: null,
            quotaScope: 'account', recoverability: 'wait', planType: null,
            overage: null, action: null, connectedService: null,
        });
    }
    return result;
}
