import { describe, expect, it } from 'vitest';
import { startNativeProviderQuotaLoop } from './nativeQuotaLoop';
import { createProviderAccountUsageStore } from './store';
import { createProviderAccountUsagePersistenceScheduler, type ProviderAccountUsageApi } from './persistence';
import type { NativeProviderQuotaSource } from '../quotas/types';

function quotaSnapshot(fetchedAt: number, usedPct: number) {
    return {
        v: 1, serviceId: 'claude-subscription', providerId: 'claude', profileId: 'native:test',
        activeAccountId: 'account-one', fetchedAt, staleAfterMs: 300_000,
        source: 'provider_api', confidence: 'exact', planLabel: null, accountLabel: null,
        meters: [{
            meterId: 'five_hour', label: '5-hour', used: null, limit: null, unit: 'unknown',
            utilizationPct: usedPct, remainingPct: 100 - usedPct, resetsAt: fetchedAt + 100_000,
            status: 'ok', details: {},
        }],
    } as const;
}

// 真实的内存实现：按接口语义接受并保留写入的快照，供真实持久化调度器确认保存结果。
function createInMemoryApi(options?: { rejectWrites?: boolean }) {
    const acceptedRecordIds = new Set<string>();
    const api: ProviderAccountUsageApi = {
        getAccountEncryptionMode: async () => 'plain',
        registerProviderAccountUsageSnapshotPlain: async ({ recordId }) => {
            if (options?.rejectWrites) throw new Error('服务器拒绝了保存请求');
            acceptedRecordIds.add(recordId);
        },
    };
    return { api, acceptedRecordIds };
}

const FINGERPRINT_KEY = new Uint8Array(32).fill(7);

// 真实的内存实现：把查询结果按调用次序交给循环，用于提供确定性的输入数据。
function createScriptedSource(results: readonly (unknown | Error)[]): NativeProviderQuotaSource {
    let callIndex = 0;
    return {
        pollIntervalMs: 5,
        fetch: async () => {
            const result = results[Math.min(callIndex, results.length - 1)];
            callIndex += 1;
            if (result instanceof Error) throw result;
            return result;
        },
    } as unknown as NativeProviderQuotaSource;
}

async function waitFor(predicate: () => boolean, timeoutMs = 4_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error('等待条件超时');
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
}

describe('native provider quota loop', () => {
    it('reports a transient fetch failure through onTickError and keeps polling', async () => {
        const store = createProviderAccountUsageStore();
        const { api, acceptedRecordIds } = createInMemoryApi();
        const persistence = createProviderAccountUsagePersistenceScheduler({
            api,
            now: () => Date.now(),
            fingerprintKey: FINGERPRINT_KEY,
            minFreshnessMs: 0,
        });
        const tickErrors: unknown[] = [];
        const loop = startNativeProviderQuotaLoop({
            sources: [createScriptedSource([new Error('HTTP 503 服务暂时不可用'), quotaSnapshot(Date.now(), 20)])],
            store,
            persistence,
            fetchTimeoutMs: 1_000,
            onTickError: (error) => { tickErrors.push(error); },
        });
        try {
            await waitFor(() => acceptedRecordIds.size === 1);
            expect(tickErrors).toHaveLength(1);
            expect((tickErrors[0] as Error).message).toBe('HTTP 503 服务暂时不可用');
            const [recordId] = [...acceptedRecordIds];
            expect(store.resolveRecordId(recordId)?.meters.map((meter) => meter.meterId)).toEqual(['five_hour']);
        } finally {
            await loop.stop();
            persistence.dispose();
        }
    });

    it('keeps reporting repeated failures instead of letting the loop reject', async () => {
        const store = createProviderAccountUsageStore();
        const { api, acceptedRecordIds } = createInMemoryApi();
        const persistence = createProviderAccountUsagePersistenceScheduler({
            api,
            now: () => Date.now(),
            fingerprintKey: FINGERPRINT_KEY,
            minFreshnessMs: 0,
        });
        const tickErrors: unknown[] = [];
        const loop = startNativeProviderQuotaLoop({
            sources: [createScriptedSource([new Error('凭据已失效')])],
            store,
            persistence,
            fetchTimeoutMs: 1_000,
            onTickError: (error) => { tickErrors.push(error); },
        });
        try {
            await waitFor(() => tickErrors.length >= 2);
            expect(acceptedRecordIds.size).toBe(0);
        } finally {
            await loop.stop();
            persistence.dispose();
        }
    });

    it('reports a rejected server write and keeps polling instead of rejecting the loop', async () => {
        const store = createProviderAccountUsageStore();
        const { api, acceptedRecordIds } = createInMemoryApi({ rejectWrites: true });
        const persistence = createProviderAccountUsagePersistenceScheduler({
            api,
            now: () => Date.now(),
            fingerprintKey: FINGERPRINT_KEY,
            minFreshnessMs: 0,
        });
        const tickErrors: unknown[] = [];
        const loop = startNativeProviderQuotaLoop({
            sources: [createScriptedSource([quotaSnapshot(Date.now(), 30)])],
            store,
            persistence,
            fetchTimeoutMs: 1_000,
            onTickError: (error) => { tickErrors.push(error); },
        });
        try {
            await waitFor(() => tickErrors.length >= 2);
            expect(acceptedRecordIds.size).toBe(0);
        } finally {
            await loop.stop();
            persistence.dispose();
        }
        // 失败按非致命处理后，后台循环自行退出而不把拒绝留给无人观察的 done。
        await expect(loop.done).resolves.toBeDefined();
    });
});
