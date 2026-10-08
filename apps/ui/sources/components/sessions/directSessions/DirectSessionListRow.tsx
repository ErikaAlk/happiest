import * as React from 'react';
import { Item } from '@/components/ui/lists/Item';
import { useNavigateToSession } from '@/hooks/session/useNavigateToSession';
import { machineDirectSessionLinkEnsure } from '@/sync/ops/machineDirectSessions';
import type { DirectSessionListCandidate } from '@/sync/domains/session/directSessions/directSessionListCandidates';
import { getMachineDisplaySubtitle } from '@/sync/domains/machines/machineDisplayRenderable';
import { resolveDirectBrowseLinkEnsureRequestExtras } from './browse/resolveDirectBrowseSourceOptions';
import { buildDirectBrowseCandidateDisplayTitle, readDirectBrowseCandidatePath } from './browse/buildDirectBrowseCandidatePresentation';
import { t } from '@/text';
import { Modal } from '@/modal';

export const DirectSessionListRow = React.memo(({ value }: { value: DirectSessionListCandidate }) => {
    const navigateToSession = useNavigateToSession();
    const [opening, setOpening] = React.useState(false);
    const pending = React.useRef(false);
    const open = async () => {
        if (pending.current) return;
        pending.current = true;
        setOpening(true);
        try {
            const extras = resolveDirectBrowseLinkEnsureRequestExtras(value);
            const directoryHint = readDirectBrowseCandidatePath(value.candidate.details);
            const result = await machineDirectSessionLinkEnsure({
                machineId: value.machineId, providerId: value.providerId,
                remoteSessionId: value.candidate.remoteSessionId,
                ...(value.candidate.title ? { titleHint: value.candidate.title } : {}),
                ...(directoryHint ? { directoryHint } : {}),
                ...extras, source: value.source,
            }, { serverId: value.serverId });
            if (!result.ok) {
                Modal.alert(t('common.error'), result.error);
                throw new Error(result.error);
            }
            await navigateToSession(result.sessionId, { serverId: value.serverId });
        } finally {
            pending.current = false;
            setOpening(false);
        }
    };
    return <Item
        testID={`direct-discovery-${value.machineId}-${value.candidate.remoteSessionId}`}
        title={buildDirectBrowseCandidateDisplayTitle(value.candidate)}
        subtitle={`${getMachineDisplaySubtitle(value.machine, value.machineId)} · ${value.machine?.active === false ? t('status.offline') : value.candidate.activity === 'running' ? t('directSessions.browseActivityRunningNow') : new Date(value.candidate.updatedAtMs).toLocaleString()}`}
        detail={t('sessionsList.storageDirectTab')}
        loading={opening}
        disabled={opening || value.machine?.active === false}
        onPress={() => { void open(); }}
    />;
});
