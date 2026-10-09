import * as React from 'react';

import { Modal } from '@/modal';
import type { UseDirectSessionRuntimeResult } from '@/components/sessions/model/useDirectSessionRuntime';
import { machineDirectSessionTakeover, machineDirectSessionTakeoverPersist } from '@/sync/ops/machineDirectSessions';
import { resolvePreferredServerIdForSessionId } from '@/sync/runtime/orchestration/serverScopedRpc/resolvePreferredServerIdForSessionId';
import { sync } from '@/sync/sync';
import { t } from '@/text';
import { requiresDirectSessionStopConfirmation, resolveDirectSessionSendTakeover } from '@/sync/domains/session/control/directSessionTakeover';

type DirectTakeoverMode = 'direct' | 'persisted';

type UseDirectSessionTakeoverParams = Readonly<{
    sessionId: string;
    hasWriteAccess: boolean;
    directSessionRuntime: Pick<UseDirectSessionRuntimeResult, 'directSessionLink' | 'status' | 'refreshNow'>;
}>;

type UseDirectSessionTakeoverResult = Readonly<{
    takeoverInFlight: DirectTakeoverMode | null;
    requestTakeover: (mode: DirectTakeoverMode) => Promise<boolean>;
    ensureReadyForSend: () => Promise<boolean>;
}>;

function resolveServerId(sessionId: string): string | undefined {
    return resolvePreferredServerIdForSessionId(sessionId);
}

export function useDirectSessionTakeover(params: UseDirectSessionTakeoverParams): UseDirectSessionTakeoverResult {
    const [takeoverInFlight, setTakeoverInFlight] = React.useState<DirectTakeoverMode | null>(null);
    const takeoverBusyRef = React.useRef(false);

    const readLatestStatus = React.useCallback(async () => {
        return await params.directSessionRuntime.refreshNow();
    }, [params.directSessionRuntime]);

    const requestTakeover = React.useCallback(async (
        mode: DirectTakeoverMode,
    ): Promise<boolean> => {
        if (!params.hasWriteAccess) {
            Modal.alert(t('common.error'), t('session.sharing.noEditPermission'));
            return false;
        }

        const directSessionLink = params.directSessionRuntime.directSessionLink;
        if (!directSessionLink) {
            return false;
        }

        if (takeoverBusyRef.current) return false;
        takeoverBusyRef.current = true;
        setTakeoverInFlight(mode);
        try {
            const latestStatus = await readLatestStatus();
            if (!latestStatus) {
                Modal.alert(t('common.error'), t('errors.failedToSwitchControl'));
                return false;
            }
            if (!latestStatus.machineOnline) {
                Modal.alert(t('common.error'), t('chatFooter.directSessionMachineOffline'));
                return false;
            }

            let forceStop = false;
            if (requiresDirectSessionStopConfirmation(latestStatus)) {
                const confirmed = latestStatus.externalProcessActive === true
                    ? await Modal.confirm(
                        t('chatFooter.directSessionRunningOnComputerTitle'),
                        t('chatFooter.directSessionRunningOnComputerBody'),
                        {
                            confirmText: t('chatFooter.directSessionRunningOnComputerAction'),
                            cancelText: t('common.cancel'),
                        },
                    )
                    : await Modal.confirm(
                        t('chatFooter.directTakeoverForceStopConfirmTitle'),
                        t('chatFooter.directTakeoverForceStopConfirmBody'),
                        {
                            confirmText: t('chatFooter.directTakeoverForceStopConfirmAction'),
                            cancelText: t('common.cancel'),
                        },
                    );
                if (!confirmed) return false;
                forceStop = true;
            }

            const request = {
                machineId: directSessionLink.machineId,
                sessionId: params.sessionId,
                ...(forceStop ? { forceStop: true } : {}),
            };
            const serverId = resolveServerId(params.sessionId);
            const result = mode === 'persisted'
                ? await machineDirectSessionTakeoverPersist(request, { serverId })
                : await machineDirectSessionTakeover(request, { serverId });

            if (!result.ok) {
                Modal.alert(t('common.error'), result.error);
                return false;
            }

            await Promise.all([
                params.directSessionRuntime.refreshNow(),
                sync.refreshSessionMessages(params.sessionId),
                mode === 'persisted' ? sync.refreshSessions() : Promise.resolve(),
            ]);

            return true;
        } finally {
            takeoverBusyRef.current = false;
            setTakeoverInFlight(null);
        }
    }, [params, readLatestStatus]);

    const ensureReadyForSend = React.useCallback(async (): Promise<boolean> => {
        const directSessionLink = params.directSessionRuntime.directSessionLink;
        if (!directSessionLink) {
            return true;
        }

        const latestStatus = await readLatestStatus();
        if (!latestStatus) {
            Modal.alert(t('common.error'), t('errors.failedToSwitchControl'));
            return false;
        }
        const intent = resolveDirectSessionSendTakeover(latestStatus);
        if (intent === 'ready') {
            return true;
        }
        if (intent === 'offline') {
            Modal.alert(t('common.error'), t('chatFooter.directSessionMachineOffline'));
            return false;
        }
        if (intent === 'direct') return requestTakeover('direct');
        Modal.alert(t('common.error'), t('errors.failedToSwitchControl'));
        return false;
    }, [params.directSessionRuntime, readLatestStatus, requestTakeover]);

    return {
        takeoverInFlight,
        requestTakeover,
        ensureReadyForSend,
    };
}
