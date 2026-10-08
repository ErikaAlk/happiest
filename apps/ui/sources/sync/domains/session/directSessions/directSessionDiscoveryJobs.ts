export type DirectSessionDiscoveryJob = Readonly<{
    fullRefresh: boolean;
    promise: Promise<void>;
}>;

export async function settleDirectSessionDiscoveryJobs(jobs: readonly Promise<void>[], isCancelled: () => boolean): Promise<void> {
    const results = await Promise.allSettled(jobs);
    if (isCancelled()) return;
    const failures = results.flatMap((result) => result.status === 'rejected' ? [result.reason] : []);
    if (failures.length > 0) throw new AggregateError(failures, '电脑会话发现失败');
}

export function runDirectSessionDiscoveryJob(
    jobs: Map<string, DirectSessionDiscoveryJob>,
    key: string,
    fullRefresh: boolean,
    load: (fullRefresh: boolean) => Promise<void>,
): Promise<void> {
    const existing = jobs.get(key);
    if (existing && (!fullRefresh || existing.fullRefresh)) return existing.promise;
    const loading = existing ? existing.promise.then(() => load(true)) : load(fullRefresh);
    const promise = loading.finally(() => {
        if (jobs.get(key)?.promise === promise) jobs.delete(key);
    });
    jobs.set(key, { fullRefresh, promise });
    return promise;
}
