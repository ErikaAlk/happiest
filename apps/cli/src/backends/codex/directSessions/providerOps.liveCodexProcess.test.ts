import { describe, expect, it } from 'vitest';

import { codexDirectSessionProviderOps } from './providerOps';
import { isPidAliveBySignal } from '@/daemon/processRunState';

const sessionId = process.env.HAPPIER_TEST_LIVE_CODEX_SESSION_ID;
const expectedPid = Number(process.env.HAPPIER_TEST_LIVE_CODEX_PID);

describe.skipIf(!sessionId || !Number.isInteger(expectedPid) || expectedPid <= 0)('Codex direct-session native terminal', () => {
    it('reports the real terminal that owns the selected session', async () => {
        const getActivity = codexDirectSessionProviderOps.getActivity!;
        const activity = await getActivity({ source: { kind: 'codexHome', home: 'user' }, remoteSessionId: sessionId! });
        expect(activity.isRunning).toBe(true);
        expect(activity.runningProcesses.map(process => process.pid)).toEqual([expectedPid]);
    });

    it.skipIf(process.env.HAPPIER_TEST_LIVE_CODEX_ALLOW_STOP !== '1')('rejects an expired native process observation before termination', async () => {
        const activity = await codexDirectSessionProviderOps.getActivity!({ source: { kind: 'codexHome', home: 'user' }, remoteSessionId: sessionId! });
        expect(activity.runningProcesses.map(process => process.pid)).toEqual([expectedPid]);
        const observed = activity.runningProcesses[0]!;
        await observed.verifyBeforeStop?.();
        process.kill(expectedPid);
        while (isPidAliveBySignal(expectedPid)) await new Promise(resolve => setTimeout(resolve, 25));
        await expect(async () => { await observed.verifyBeforeStop?.(); }).rejects.toThrow();
    }, 60_000);
});
