import { isAgentTextMessageStreaming } from '@/sync/domains/messages/agentTextStreaming';
import type { Message } from '@/sync/domains/messages/messageTypes';
import type { PendingMessage } from '@/sync/domains/state/storageTypes';

/** The option a user picked from an agent reply while its submission is still in flight. */
export type MessageOptionSelection = Readonly<{
    messageId: string;
    title: string;
}>;

export type MessageOptionGroupState =
    | Readonly<{ kind: 'selectable' }>
    | Readonly<{ kind: 'submitting'; title: string }>
    | Readonly<{ kind: 'readOnly' }>;

export type MessageOptionGroupStateInput = Readonly<{
    /** The message that renders the option group. */
    messageId: string;
    canSendMessages: boolean;
    messageIdsOldestFirst: readonly string[];
    messagesById: Readonly<Record<string, Message | undefined>>;
    pendingMessages: readonly PendingMessage[];
    /** The session's in-flight option submission, if any. */
    selection: MessageOptionSelection | null;
}>;

const SELECTABLE: MessageOptionGroupState = Object.freeze({ kind: 'selectable' });
const READ_ONLY: MessageOptionGroupState = Object.freeze({ kind: 'readOnly' });

/** A row being cancelled still counts: until the cancel is confirmed, the answer may have been delivered. */
function hasQueuedUserInput(pendingMessages: readonly PendingMessage[]): boolean {
    return pendingMessages.some((pending) => pending.messageRole !== 'non_user');
}

/**
 * The agent reply whose options are still an open question: the newest non-thinking agent text,
 * provided no user message follows it. Tool activity and thinking after the reply do not answer it.
 */
function resolveOpenOptionOwnerMessageId(
    messageIdsOldestFirst: readonly string[],
    messagesById: Readonly<Record<string, Message | undefined>>,
): string | null {
    for (let index = messageIdsOldestFirst.length - 1; index >= 0; index -= 1) {
        const message = messagesById[messageIdsOldestFirst[index]!];
        if (!message) continue;
        if (message.kind === 'user-text') return null;
        if (message.kind === 'agent-text' && message.isThinking !== true) return message.id;
    }
    return null;
}

/**
 * Canonical decision for whether an option group rendered from agent markdown may submit.
 *
 * Only the open question of the conversation is selectable. Once any answer has been handed to
 * the session (queued or committed), or another option submission is in flight, every group is
 * read-only, so a second tap or a gesture that lands on a different option cannot send.
 */
export function resolveMessageOptionGroupState(input: MessageOptionGroupStateInput): MessageOptionGroupState {
    if (!input.canSendMessages) return READ_ONLY;
    if (input.selection) {
        return input.selection.messageId === input.messageId
            ? { kind: 'submitting', title: input.selection.title }
            : READ_ONLY;
    }

    const message = input.messagesById[input.messageId];
    if (!message || message.kind !== 'agent-text' || message.isThinking === true) return READ_ONLY;
    if (isAgentTextMessageStreaming(message)) return READ_ONLY;
    if (hasQueuedUserInput(input.pendingMessages)) return READ_ONLY;

    return resolveOpenOptionOwnerMessageId(input.messageIdsOldestFirst, input.messagesById) === input.messageId
        ? SELECTABLE
        : READ_ONLY;
}
