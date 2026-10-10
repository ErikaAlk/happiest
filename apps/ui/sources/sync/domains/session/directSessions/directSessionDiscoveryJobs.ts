export type DirectSessionDiscoveryJob = Readonly<{
    fullRefresh: boolean;
    promise: Promise<void>;
}>;

export async function settleDirectSessionDiscoveryJobs(jobs: readonly Promise<void>[], isCancelled: () => boolean): Promise<AggregateError | null> {
    const results = await Promise.allSettled(jobs);
    if (isCancelled()) return null;
    const failures = results.flatMap((result) => result.status === 'rejected' ? [result.reason] : []);
    return failures.length > 0 ? new AggregateError(failures, '电脑会话发现失败') : null;
}

export function collectUnreportedDirectSessionDiscoveryErrors(failure: AggregateError, reported: Map<string, string>): string[] {
    const messages = new Set<string>();
    for (const error of failure.errors as unknown[]) {
        const message = error instanceof Error ? error.message : String(error);
        const key = error instanceof Error && 'discoveryKey' in error && typeof error.discoveryKey === 'string'
            ? error.discoveryKey : message;
        if (reported.get(key) === message) continue;
        reported.set(key, message);
        messages.add(message);
    }
    return [...messages];
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
