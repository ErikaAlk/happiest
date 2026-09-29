import { resolveSessionReadStateAction } from '@/sync/domains/session/readState/sessionReadState';
import type { Session } from '@/sync/domains/state/storageTypes';
import type { SessionListRenderableSession } from '@/sync/domains/session/listing/sessionListRenderable';
import { resolveTerminalControlServiceabilityPolicy } from '@happier-dev/protocol';
import { resolveSessionComputerContinuation } from '@/sync/domains/session/terminal/sessionComputerContinuation';
import {
    canContinueSessionWithFreshSpawn,
    canResumeSessionWithOptions,
    type ResumeCapabilityOptions,
    type SessionMetadata as ResumeSessionMetadata,
} from '@/agents/runtime/resumeCapabilities';

import type { SessionActionSession, SessionActionTarget, SessionAttentionStandingAction } from './sessionActionTypes';

export function resolveSessionAttentionStandingAction(params: Readonly<{
    session: SessionActionSession;
    enabled: boolean;
    standing: boolean;
}>): SessionAttentionStandingAction {
    if (!params.enabled) {
        return { kind: 'none', visible: false };
    }
    if (params.session.accessLevel === 'view') {
        return { kind: 'none', visible: false };
    }
    return params.standing
        ? { kind: 'clear-standing', visible: true, targetStanding: false }
        : { kind: 'set-standing', visible: true, targetStanding: true };
}

export function createSessionActionTarget(params: Readonly<{
    session: SessionActionSession;
    serverId?: string | null;
    currentUserId?: string | null;
    isConnected?: boolean;
    isPinned?: boolean;
    attentionStandingEnabled?: boolean;
    attentionStanding?: boolean;
    resumeCapabilityOptions?: ResumeCapabilityOptions;
    /** False where no session screen is mounted to run a resume (session info opened on its own). */
    canRequestResume?: boolean;
}>): SessionActionTarget {
    const session = params.session;
    const sessionOwnerId = typeof session.owner === 'string' ? session.owner : null;
    const currentUserOwnsSession = (
        typeof params.currentUserId === 'string'
        && params.currentUserId.length > 0
        && sessionOwnerId === params.currentUserId
    );
    const isOwnedByCurrentUser = currentUserOwnsSession || (
        session.accessLevel == null
        && !sessionOwnerId
    );
    const hasAdminAccess = isOwnedByCurrentUser || session.accessLevel === 'admin';
    const isActive = session.active === true;
    const isArchived = session.archivedAt != null;
    const isListRenderableMetadata = 'terminalControlServiceabilityV1' in (session.metadata ?? {});
    const terminalControlServiceability = isListRenderableMetadata
        ? (session.metadata as SessionListRenderableSession['metadata'])?.terminalControlServiceabilityV1
        : (session as Session).metadata?.terminal?.controlServiceabilityV1;
    const terminalControlPolicy = resolveTerminalControlServiceabilityPolicy(terminalControlServiceability);
    const hasPreservedTerminalHost = terminalControlPolicy.hostPresence === 'preserved';
    const hasStoppableTerminalHost = terminalControlPolicy.canRequestStop;
    const canStop = isOwnedByCurrentUser;
    const canArchive = hasAdminAccess && !isArchived && (!isActive || canStop);
    const hasWriteAccess = !session.accessLevel || session.accessLevel === 'edit' || session.accessLevel === 'admin';
    const resumeMetadata = session.metadata as ResumeSessionMetadata | null;
    const canResume = !isActive
        && hasWriteAccess
        && (
            canResumeSessionWithOptions(resumeMetadata, params.resumeCapabilityOptions)
            || canContinueSessionWithFreshSpawn(resumeMetadata, params.resumeCapabilityOptions)
        );
    // Session-list rows carry a narrow metadata projection without the host fields.
    const fullMetadata = isListRenderableMetadata ? null : (session as Session).metadata;
    const canContinueInTerminal = !isArchived && resolveSessionComputerContinuation({
        sessionId: session.id,
        metadata: fullMetadata,
        canReopen: canStop
            && hasWriteAccess
            && params.canRequestResume !== false
            && canResumeSessionWithOptions(resumeMetadata, params.resumeCapabilityOptions),
    }).kind === 'reopen_in_windows_terminal';

    return {
        session,
        sessionId: session.id,
        serverId: params.serverId ?? null,
        isActive,
        isArchived,
        isConnected: params.isConnected ?? isActive,
        hasStoppableTerminalHost,
        isPinned: params.isPinned === true,
        isOwnedByCurrentUser,
        hasAdminAccess,
        canStop,
        canArchive,
        canRename: hasAdminAccess,
        canResume,
        canContinueInTerminal,
        canDelete: isOwnedByCurrentUser && !isActive && !hasPreservedTerminalHost && params.isConnected !== true,
        readStateAction: isArchived
            ? { kind: 'none', visible: false }
            : resolveSessionReadStateAction(session),
        attentionStandingAction: isArchived
            ? { kind: 'none', visible: false }
            : resolveSessionAttentionStandingAction({
                session,
                enabled: params.attentionStandingEnabled === true,
                standing: params.attentionStanding === true,
            }),
    };
}
