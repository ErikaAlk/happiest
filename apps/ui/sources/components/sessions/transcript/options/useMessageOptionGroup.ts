import * as React from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { Option } from '@/components/markdown/MarkdownView';
import { Modal } from '@/modal';
import {
    resolveMessageOptionGroupState,
    type MessageOptionGroupState,
    type MessageOptionSelection,
} from '@/sync/domains/session/input/messageOptionGroupState';
import {
    messageOptionSelectionStore,
    submitMessageOption,
} from '@/sync/domains/session/input/messageOptionSelection';
import { storage } from '@/sync/domains/state/storage';
import type { PendingMessage } from '@/sync/domains/state/storageTypes';
import { sync } from '@/sync/sync';
import { t } from '@/text';
import { fireAndForget } from '@/utils/system/fireAndForget';

type StorageSnapshot = ReturnType<typeof storage.getState>;

const READ_ONLY: MessageOptionGroupState = Object.freeze({ kind: 'readOnly' });
const EMPTY_PENDING: readonly PendingMessage[] = Object.freeze([]);

function readOptionGroupState(
    state: StorageSnapshot,
    params: Readonly<{ sessionId: string; messageId: string; canSendMessages: boolean }>,
    selection: MessageOptionSelection | null,
): MessageOptionGroupState {
    const transcript = state.sessionMessages[params.sessionId];
    if (!transcript) return READ_ONLY;
    return resolveMessageOptionGroupState({
        messageId: params.messageId,
        canSendMessages: params.canSendMessages,
        messageIdsOldestFirst: transcript.messageIdsOldestFirst,
        messagesById: transcript.messagesById,
        pendingMessages: state.sessionPending[params.sessionId]?.messages ?? EMPTY_PENDING,
        selection,
    });
}

export type MessageOptionGroup = Readonly<{
    state: MessageOptionGroupState;
    /** Present only while the group may submit. */
    onOptionPress: ((option: Option) => void) | undefined;
}>;

/**
 * Option interaction for one transcript message. Rows without option markup pass `enabled: false`
 * and never subscribe to transcript or queue changes.
 */
export function useMessageOptionGroup(params: Readonly<{
    sessionId: string;
    messageId: string;
    canSendMessages: boolean;
    enabled: boolean;
}>): MessageOptionGroup {
    const { sessionId, messageId, canSendMessages, enabled } = params;
    const selection = useStore(
        messageOptionSelectionStore,
        (state) => (enabled ? state.bySessionId[sessionId] ?? null : null),
    );
    const state = storage(useShallow((storageState) => (
        enabled
            ? readOptionGroupState(storageState, { sessionId, messageId, canSendMessages }, selection)
            : READ_ONLY
    )));

    const handleOptionPress = React.useCallback((option: Option) => {
        // Decide from current state rather than the rendered snapshot: the queue or transcript may
        // have advanced since this row last rendered.
        const current = readOptionGroupState(
            storage.getState(),
            { sessionId, messageId, canSendMessages },
            messageOptionSelectionStore.getState().bySessionId[sessionId] ?? null,
        );
        if (current.kind !== 'selectable') return;
        fireAndForget((async () => {
            try {
                await submitMessageOption({
                    sessionId,
                    selection: { messageId, title: option.title },
                    submit: (onOutboundHandoff) => sync.submitMessage(sessionId, option.title, undefined, undefined, {
                        callerSurface: 'message_option',
                        onOutboundHandoff,
                    }),
                });
            } catch (error) {
                Modal.alert(t('common.error'), error instanceof Error ? error.message : t('errors.failedToSendMessage'));
            }
        })(), { tag: 'MessageView.optionPress' });
    }, [canSendMessages, messageId, sessionId]);

    return {
        state,
        onOptionPress: state.kind === 'selectable' ? handleOptionPress : undefined,
    };
}
