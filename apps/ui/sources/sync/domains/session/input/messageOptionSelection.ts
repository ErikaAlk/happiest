import { createStore } from 'zustand/vanilla';

import type { MessageOptionSelection } from './messageOptionGroupState';
import type { SubmitSessionOutboundHandoff } from './types';

type MessageOptionSelectionState = Readonly<{
    bySessionId: Readonly<Record<string, MessageOptionSelection>>;
}>;

/** In-flight option submissions, one per session. Not persisted: the queued message outlives a reload. */
export const messageOptionSelectionStore = createStore<MessageOptionSelectionState>(() => ({ bySessionId: {} }));

/** Returns the admitted selection, or null when the session already has one in flight. */
export function beginMessageOptionSelection(
    sessionId: string,
    selection: MessageOptionSelection,
): MessageOptionSelection | null {
    if (messageOptionSelectionStore.getState().bySessionId[sessionId]) return null;
    const admitted: MessageOptionSelection = { messageId: selection.messageId, title: selection.title };
    messageOptionSelectionStore.setState((state) => ({
        bySessionId: { ...state.bySessionId, [sessionId]: admitted },
    }));
    return admitted;
}

export function releaseMessageOptionSelection(sessionId: string, selection: MessageOptionSelection): void {
    const state = messageOptionSelectionStore.getState();
    if (state.bySessionId[sessionId] !== selection) return;
    const { [sessionId]: _released, ...rest } = state.bySessionId;
    messageOptionSelectionStore.setState({ bySessionId: rest });
}

/**
 * Submit an option picked from an agent reply.
 *
 * The session's option groups lock synchronously, before the first await, so a second tap or a
 * gesture that ends on another option cannot start another submission. The lock is released at
 * outbound handoff: from then on the queued or committed user message is the canonical evidence
 * that the question was answered. A submission that fails before handoff releases the lock, so
 * the user can choose again; the failure propagates to the caller.
 */
export async function submitMessageOption(params: Readonly<{
    sessionId: string;
    selection: MessageOptionSelection;
    submit: (onOutboundHandoff: (handoff: SubmitSessionOutboundHandoff) => void) => Promise<unknown>;
}>): Promise<'submitted' | 'ignored'> {
    const admitted = beginMessageOptionSelection(params.sessionId, params.selection);
    if (!admitted) return 'ignored';
    const release = () => releaseMessageOptionSelection(params.sessionId, admitted);
    try {
        await params.submit(release);
    } finally {
        release();
    }
    return 'submitted';
}
