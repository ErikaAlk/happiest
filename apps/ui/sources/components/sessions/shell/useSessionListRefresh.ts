import * as React from 'react';

import { runRefreshDiagnosticAction } from '@/utils/system/userInteractionDiagnostics';
import { fireAndForget } from '@/utils/system/fireAndForget';

export function useSessionListRefresh(params: Readonly<{
    dataActiveRef: React.RefObject<boolean>;
    refreshSessions: () => Promise<void>;
    refreshDirectSessions?: () => Promise<void>;
}>) {
    const [refreshingSessions, setRefreshingSessions] = React.useState(false);
    const refreshingSessionsRef = React.useRef(false);
    const { dataActiveRef, refreshSessions, refreshDirectSessions } = params;
    const handleRefreshSessions = React.useCallback(() => {
        if (!dataActiveRef.current) return;
        if (refreshingSessionsRef.current) return;
        refreshingSessionsRef.current = true;
        setRefreshingSessions(true);
        fireAndForget((async () => {
            try {
                await runRefreshDiagnosticAction(
                    { action: 'pull_to_refresh', screen: 'session_list' },
                    async () => {
                        const results = await Promise.allSettled([refreshSessions(), refreshDirectSessions?.()]);
                        const failures = results.flatMap((result) => result.status === 'rejected' ? [result.reason] : []);
                        if (failures.length > 0) throw new AggregateError(failures, '会话列表刷新失败');
                    },
                );
            } finally {
                refreshingSessionsRef.current = false;
                setRefreshingSessions(false);
            }
        })(), { tag: 'SessionsList.refreshSessions' });
    }, [dataActiveRef, refreshSessions, refreshDirectSessions]);
    return { handleRefreshSessions, refreshingSessions };
}
