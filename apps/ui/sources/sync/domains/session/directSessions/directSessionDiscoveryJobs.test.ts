import { describe, expect, it } from 'vitest';
import { runDirectSessionDiscoveryJob, settleDirectSessionDiscoveryJobs, type DirectSessionDiscoveryJob } from './directSessionDiscoveryJobs';
import { createDeferred } from '@/dev/testkit/hooks/createDeferred';

describe('direct session discovery refresh', () => {
    it('settles cancelled discovery failures without reporting an obsolete batch error', async () => {
        const pages = createDeferred<void>();
        let cancelled = false;
        const pending = settleDirectSessionDiscoveryJobs([pages.promise], () => cancelled);
        const settled = expect(pending).resolves.toBeUndefined();
        cancelled = true;
        pages.reject(new Error('discovery transport disconnected'));
        await settled;
    });

    it('reports current discovery failures and preserves their causes', async () => {
        const pages = createDeferred<void>();
        const failure = new Error('discovery transport disconnected');
        const pending = settleDirectSessionDiscoveryJobs([pages.promise], () => false);
        const rejected = expect(pending).rejects.toMatchObject({ errors: [failure] });
        pages.reject(failure);
        await rejected;
    });

    it('finishes a pending first-page observation and then waits for the requested full refresh', async () => {
        const jobs = new Map<string, DirectSessionDiscoveryJob>();
        const firstPage = createDeferred<void>();
        const remainingPages = createDeferred<void>();
        const observations: string[] = [];
        const load = async (fullRefresh: boolean) => {
            if (fullRefresh) {
                await remainingPages.promise;
                observations.push('all-pages');
            } else {
                await firstPage.promise;
                observations.push('first-page');
            }
        };
        const automatic = runDirectSessionDiscoveryJob(jobs, 'machine-source', false, load);
        let refreshed = false;
        const manual = runDirectSessionDiscoveryJob(jobs, 'machine-source', true, load).then(() => { refreshed = true; });
        firstPage.resolve();
        await automatic;
        await Promise.resolve();
        expect(refreshed).toBe(false);
        remainingPages.resolve();
        await manual;
        expect(observations).toEqual(['first-page', 'all-pages']);
        expect(jobs.size).toBe(0);
    });

    it('shares a pending full refresh with later requests', async () => {
        const jobs = new Map<string, DirectSessionDiscoveryJob>();
        const pages = createDeferred<void>();
        const first = runDirectSessionDiscoveryJob(jobs, 'machine-source', true, () => pages.promise);
        const second = runDirectSessionDiscoveryJob(jobs, 'machine-source', true, () => pages.promise);
        expect(second).toBe(first);
        pages.resolve();
        await first;
        expect(jobs.size).toBe(0);
    });

    it('releases a failed request so a later refresh can run', async () => {
        const jobs = new Map<string, DirectSessionDiscoveryJob>();
        const pages = createDeferred<void>();
        const failure = new Error('discovery transport disconnected');
        const pending = runDirectSessionDiscoveryJob(jobs, 'machine-source', true, () => pages.promise);
        const rejected = expect(pending).rejects.toBe(failure);
        pages.reject(failure);
        await rejected;
        expect(jobs.size).toBe(0);
        await runDirectSessionDiscoveryJob(jobs, 'machine-source', true, async () => {});
        expect(jobs.size).toBe(0);
    });
});
