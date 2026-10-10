import type { NativeProviderQuotaSource } from '../quotas/types';
import type { ProviderAccountUsageStore } from './store';
import type { ProviderAccountUsagePersistenceScheduler } from './persistence';
import { buildProviderAccountUsageSnapshotFromConnectedServiceQuotaObservation } from './fromConnectedServiceQuotaObservation';

export function startNativeProviderQuotaLoop(params: Readonly<{
    sources: readonly NativeProviderQuotaSource[];
    store: ProviderAccountUsageStore;
    persistence: ProviderAccountUsagePersistenceScheduler;
    fetchTimeoutMs: number;
    publishRecordIds?: (recordIds: readonly string[]) => Promise<void>;
    onTickError: (error: unknown) => void;
}>) {
    let stopped = false;
    const wakeups = new Set<() => void>();
    const nativeRecordIds = new Map<NativeProviderQuotaSource, string>();
    const runTick = async (source: NativeProviderQuotaSource): Promise<void> => {
        try {
            const quota = await source.fetch(AbortSignal.timeout(params.fetchTimeoutMs));
            if (stopped) return;
            if (quota) {
                const snapshot = buildProviderAccountUsageSnapshotFromConnectedServiceQuotaObservation({ snapshot: quota });
                const recorded = params.store.recordSnapshot(snapshot);
                await params.persistence.recordInBandSnapshot(params.store.resolveRecordId(recorded.recordId)!);
                const flushed = await params.persistence.flush(params.fetchTimeoutMs);
                if (flushed && typeof flushed === 'object' && 'timedOut' in flushed && flushed.timedOut) {
                    throw new Error('原生账号用量没有完成持久化');
                }
                if (!params.persistence.hasPersistedRecord?.(recorded.recordId)) {
                    throw new Error('原生账号用量没有收到服务器保存确认');
                }
                nativeRecordIds.set(source, recorded.recordId);
                await params.publishRecordIds?.([...new Set(nativeRecordIds.values())].sort());
                return;
            }
            if (nativeRecordIds.delete(source)) {
                await params.publishRecordIds?.([...new Set(nativeRecordIds.values())].sort());
            }
        } catch (error) {
            // 限流、网络中断、凭据失效与服务器拒绝保存都属于可能自行恢复的暂时失败，与相邻的用量循环
            // 一致按非致命处理：交给调用方记录后等下一个轮询周期重试，不让一次失败冒泡成无人观察的拒绝。
            if (!stopped) params.onTickError(error);
        }
    };
    const done = Promise.all(params.sources.map(async (source) => {
        while (!stopped) {
            await runTick(source);
            if (stopped) break;
            await new Promise<void>((resolve) => {
                const wake = () => { clearTimeout(timer); wakeups.delete(wake); resolve(); };
                const timer = setTimeout(wake, source.pollIntervalMs);
                wakeups.add(wake);
            });
        }
    }));
    return {
        done,
        async stop() {
            stopped = true;
            for (const wake of wakeups) wake();
            await done;
        },
    };
}
