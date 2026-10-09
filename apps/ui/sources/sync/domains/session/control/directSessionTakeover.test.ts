import { describe, expect, it } from 'vitest';
import type { DirectSessionStatusGetResponse } from '@happier-dev/protocol';

import { requiresDirectSessionStopConfirmation, resolveDirectSessionSendTakeover } from './directSessionTakeover';

const idle = {
    ok: true,
    machineOnline: true,
    runnerActive: false,
    activity: 'idle',
    canTakeOverDirect: true,
    canTakeOverPersist: true,
    canForceStop: false,
    externalProcessActive: false,
} satisfies Extract<DirectSessionStatusGetResponse, { ok: true }>;

describe('direct session send takeover', () => {
    it('continues an idle computer session directly without a mode confirmation', () => {
        expect(resolveDirectSessionSendTakeover(idle)).toBe('direct');
    });

    it('requires confirmation only when a computer process will be stopped', () => {
        expect(requiresDirectSessionStopConfirmation({ ...idle, canForceStop: true })).toBe(false);
        expect(requiresDirectSessionStopConfirmation({ ...idle, externalProcessActive: true, canForceStop: true })).toBe(true);
        expect(requiresDirectSessionStopConfirmation({ ...idle, trustedPid: 123, canForceStop: true })).toBe(true);
    });

    it('reuses the current runner while requiring takeover for an external writer', () => {
        expect(resolveDirectSessionSendTakeover({ ...idle, runnerActive: true })).toBe('ready');
        expect(resolveDirectSessionSendTakeover({ ...idle, runnerActive: true, externalProcessActive: true })).toBe('direct');
    });

    it('uses only advertised takeover capabilities and reports offline machines', () => {
        expect(resolveDirectSessionSendTakeover({ ...idle, canTakeOverDirect: false })).toBe('unavailable');
        expect(resolveDirectSessionSendTakeover({ ...idle, canTakeOverDirect: false, canTakeOverPersist: false })).toBe('unavailable');
        expect(resolveDirectSessionSendTakeover({ ...idle, machineOnline: false, runnerActive: true })).toBe('offline');
    });
});
