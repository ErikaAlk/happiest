import * as React from 'react';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { Item } from '@/components/ui/lists/Item';
import { AgentIcon } from '@/agents/registry/AgentIcon';
import { getItemGroupRowCornerRadii } from '@/components/ui/lists/itemGroupRowCorners';
import type { SessionListRowModelAdjacency } from '../shell/row/buildSessionListRowModels';
import { SESSION_LIST_ROW_CORNER_RADIUS } from '../shell/sessionListRowDensity';
import { useNavigateToSession } from '@/hooks/session/useNavigateToSession';
import { machineDirectSessionLinkEnsure } from '@/sync/ops/machineDirectSessions';
import type { DirectSessionListCandidate } from '@/sync/domains/session/directSessions/directSessionListCandidates';
import { getMachineDisplaySubtitle } from '@/sync/domains/machines/machineDisplayRenderable';
import { resolveDirectBrowseLinkEnsureRequestExtras } from './browse/resolveDirectBrowseSourceOptions';
import { buildDirectBrowseCandidateDisplayTitle, readDirectBrowseCandidatePath } from './browse/buildDirectBrowseCandidatePresentation';
import { t } from '@/text';
import { Modal } from '@/modal';

export const DirectSessionListRow = React.memo(({ value, adjacency }: { value: DirectSessionListCandidate; adjacency: SessionListRowModelAdjacency }) => {
    const { theme } = useUnistyles();
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
    return <View style={{
        marginHorizontal: 16,
        marginBottom: adjacency.isLast ? 12 : 1,
        overflow: 'hidden',
        backgroundColor: theme.colors.surface.base,
        ...getItemGroupRowCornerRadii({ hasBackground: true, position: adjacency, radius: SESSION_LIST_ROW_CORNER_RADIUS }),
    }}><Item
        testID={`direct-discovery-${value.machineId}-${value.candidate.remoteSessionId}`}
        title={buildDirectBrowseCandidateDisplayTitle(value.candidate)}
        subtitle={`${getMachineDisplaySubtitle(value.machine, value.machineId)} · ${value.machine?.active === false ? t('status.offline') : value.candidate.activity === 'running' ? t('directSessions.browseActivityRunningNow') : new Date(value.candidate.updatedAtMs).toLocaleString()}`}
        detail={t('sessionsList.storageDirectTab')}
        icon={<AgentIcon agentId={value.providerId} size={28} />}
        loading={opening}
        disabled={opening || value.machine?.active === false}
        onPress={() => { void open(); }}
    /></View>;
});
