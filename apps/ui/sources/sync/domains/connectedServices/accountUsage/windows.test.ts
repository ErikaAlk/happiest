import { describe, expect, it } from 'vitest';
import type { ConnectedServiceQuotaMeterV1 } from '@happier-dev/protocol';
import { selectAccountUsageWindows } from './windows';

function meter(windowDurationMs: number, utilizationPct: number | null): ConnectedServiceQuotaMeterV1 {
    return { meterId: String(windowDurationMs), label: '窗口', used: null, limit: null, unit: 'count',
        utilizationPct, resetsAt: 123456, status: 'ok', windowDurationMs, details: { limitCategory: 'usage_limit' } };
}

describe('selectAccountUsageWindows', () => {
    it('按窗口时长识别并同时显示两个窗口，保留重置时间', () => {
        const result = selectAccountUsageWindows([
            meter(604800000, 60), meter(18000000, 20), meter(86400000, 99),
        ]);
        expect(result.map((row) => [row.kind, row.usedPct, row.resetsAt])).toEqual([
            ['fiveHour', 20, 123456], ['weekly', 60, 123456],
        ]);
    });
    it('缺失数据保持缺失，零用量仍然显示', () => {
        expect(selectAccountUsageWindows([meter(18000000, 0), meter(604800000, null)])
            .map((row) => row.usedPct)).toEqual([0, null]);
        expect(selectAccountUsageWindows([])).toEqual([]);
    });
    it('官方只提供每周窗口时，显示实际提供的窗口', () => {
        expect(selectAccountUsageWindows([meter(604800000, 67)]).map((row) => [row.kind, row.usedPct]))
            .toEqual([['weekly', 67]]);
    });
});
