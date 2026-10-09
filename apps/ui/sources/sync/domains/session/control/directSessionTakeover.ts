import type { DirectSessionStatusGetResponse } from '@happier-dev/protocol';

type Status = Extract<DirectSessionStatusGetResponse, { ok: true }>;

export function resolveDirectSessionSendTakeover(status: Status): 'ready' | 'offline' | 'direct' | 'unavailable' {
    if (!status.machineOnline) return 'offline';
    if (status.runnerActive && status.externalProcessActive !== true) return 'ready';
    if (status.runnerActive || status.canTakeOverDirect) return 'direct';
    return 'unavailable';
}

export function requiresDirectSessionStopConfirmation(status: Status): boolean {
    return status.externalProcessActive === true || (typeof status.trustedPid === 'number' && status.trustedPid > 0);
}
