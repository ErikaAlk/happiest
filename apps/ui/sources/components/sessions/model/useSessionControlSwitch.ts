import * as React from 'react';

import { Modal } from '@/modal';
import { t } from '@/text';
import { fireAndForget } from '@/utils/system/fireAndForget';
import { resumeSession, sessionStopWithServerScope, sessionSwitch, type ResumeSessionOptions } from '@/sync/ops';
import type { Session } from '@/sync/domains/state/storageTypes';
import {
    resolveSessionControlSwitchStatus,
    type SessionControlSwitchPhase,
} from '@/sync/domains/session/control/sessionLocalControl';

type SwitchAttempt = {
    to: 'remote' | 'local';
    phase: SessionControlSwitchPhase;
    resumeOptions: ResumeSessionOptions | null;
};

export function useSessionControlSwitch(params: Readonly<{
    session: Session;
    machineOnline: boolean;
    hasWriteAccess: boolean;
    vendorResumeId: string | null;
    buildReturnResumeOptions: () => ResumeSessionOptions | null;
}>) {
    const attemptRef = React.useRef<SwitchAttempt | null>(null);
    const paramsRef = React.useRef(params);
    paramsRef.current = params;
    const [attempt, setAttempt] = React.useState<SwitchAttempt | null>(null);

    const publishPhase = React.useCallback((current: SwitchAttempt, phase: SessionControlSwitchPhase) => {
        if (attemptRef.current !== current) return;
        current.phase = phase;
        setAttempt({ ...current });
    }, []);

    const finish = React.useCallback((current: SwitchAttempt, failed: boolean) => {
        if (attemptRef.current !== current) return;
        attemptRef.current = null;
        setAttempt(null);
        if (failed) Modal.alert(t('common.error'), t('errors.failedToSwitchControl'));
    }, []);

    const startLocalRunner = React.useCallback(async (current: SwitchAttempt) => {
        if (attemptRef.current !== current) return;
        if (!current.resumeOptions) throw new Error('Missing return-to-computer resume options');
        publishPhase(current, 'starting');
        let accepted = false;
        try {
            const result = await resumeSession(current.resumeOptions);
            accepted = result.type !== 'error';
            if (accepted) publishPhase(current, 'waiting_for_control');
        } finally {
            if (!accepted) finish(current, true);
        }
    }, [finish, publishPhase]);

    React.useEffect(() => {
        const current = attemptRef.current;
        if (!current) return;
        const status = resolveSessionControlSwitchStatus({
            session: params.session,
            to: current.to,
            phase: current.phase,
            machineOnline: params.machineOnline,
            ...(current.resumeOptions?.resume ? {
                expectedVendorResumeId: current.resumeOptions.resume,
                vendorResumeId: params.vendorResumeId,
            } : {}),
        });
        if (status !== 'pending') {
            finish(current, status === 'failed');
        } else if (current.phase === 'waiting_for_exit' && params.session.active !== true) {
            fireAndForget(startLocalRunner(current), { tag: 'SessionControlSwitch.startLocalRunner' });
        }
    }, [attempt, finish, params.machineOnline, params.session, params.vendorResumeId, startLocalRunner]);

    React.useEffect(() => () => {
        attemptRef.current = null;
    }, [params.session.id]);

    const requestSwitch = React.useCallback((to: 'remote' | 'local') => {
        const params = paramsRef.current;
        if (!params.hasWriteAccess) {
            Modal.alert(t('common.error'), t('session.sharing.noEditPermission'));
            return;
        }
        if (attemptRef.current) return;
        const resumeOptions = to === 'local' ? params.buildReturnResumeOptions() : null;
        const current: SwitchAttempt = { to, phase: resumeOptions ? 'stopping' : 'switching', resumeOptions };
        attemptRef.current = current;
        setAttempt({ ...current });
        fireAndForget((async () => {
            let accepted = false;
            try {
                if (resumeOptions) {
                    if (params.session.active) {
                        const result = await sessionStopWithServerScope(params.session.id, { serverId: resumeOptions.serverId });
                        if (!result.success) {
                            if (result.code === 'session_stop_requested') {
                                accepted = true;
                                publishPhase(current, 'waiting_for_exit');
                            }
                            return;
                        }
                    }
                    await startLocalRunner(current);
                    accepted = attemptRef.current === current;
                } else {
                    accepted = await sessionSwitch(params.session.id, to) === true;
                }
            } finally {
                if (!accepted) finish(current, true);
            }
        })(), { tag: 'SessionControlSwitch.requestSwitch' });
    }, [finish, publishPhase, startLocalRunner]);

    const requestRemote = React.useCallback(() => requestSwitch('remote'), [requestSwitch]);
    const requestLocal = React.useCallback(() => requestSwitch('local'), [requestSwitch]);
    return { controlSwitchTo: attempt?.to ?? null, requestRemote, requestLocal };
}
