import type { ConnectedServiceQuotaMeterV1 } from '@happier-dev/protocol';
import { deriveQuotaUtilizationPct } from '../deriveQuotaUtilizationPct';

export function selectAccountUsageWindows(meters: readonly ConnectedServiceQuotaMeterV1[]) {
    return (['fiveHour', 'weekly'] as const).flatMap((kind) => {
        const duration = kind === 'fiveHour' ? 18_000_000 : 604_800_000;
        const meter = meters.find((candidate) => candidate.windowDurationMs === duration);
        return meter ? [{ kind, meterId: meter.meterId, usedPct: deriveQuotaUtilizationPct(meter), resetsAt: meter.resetsAt }] : [];
    });
}
