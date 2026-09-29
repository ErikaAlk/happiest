import { describe, expect, it } from 'vitest';

import { createPendingMessageFixture, createToolCallMessageFixture } from '@/dev/testkit/fixtures/transcriptFixtures';
import type { AgentTextMessage, Message, UserTextMessage } from '@/sync/domains/messages/messageTypes';
import type { PendingMessage } from '@/sync/domains/state/storageTypes';

import {
    resolveMessageOptionGroupState,
    type MessageOptionGroupStateInput,
    type MessageOptionSelection,
} from './messageOptionGroupState';

const OPTIONS_TEXT = '要安装吗？\n<options><option>安装</option><option>先不安装</option></options>';

function agentText(id: string, overrides: Partial<AgentTextMessage> = {}): AgentTextMessage {
    return { kind: 'agent-text', id, localId: null, createdAt: 1, text: OPTIONS_TEXT, ...overrides };
}

function userText(id: string, text: string): UserTextMessage {
    return { kind: 'user-text', id, localId: `local-${id}`, createdAt: 2, text };
}

function transcript(messages: readonly Message[]): Pick<MessageOptionGroupStateInput, 'messageIdsOldestFirst' | 'messagesById'> {
    return {
        messageIdsOldestFirst: messages.map((message) => message.id),
        messagesById: Object.fromEntries(messages.map((message) => [message.id, message])),
    };
}

function resolve(params: Readonly<{
    messageId?: string;
    messages: readonly Message[];
    pendingMessages?: readonly PendingMessage[];
    selection?: MessageOptionSelection | null;
    canSendMessages?: boolean;
}>) {
    return resolveMessageOptionGroupState({
        messageId: params.messageId ?? 'agent-1',
        canSendMessages: params.canSendMessages ?? true,
        pendingMessages: params.pendingMessages ?? [],
        selection: params.selection ?? null,
        ...transcript(params.messages),
    });
}

describe('resolveMessageOptionGroupState', () => {
    it('offers the options of the latest completed agent reply', () => {
        expect(resolve({ messages: [userText('user-1', '装个依赖'), agentText('agent-1')] })).toEqual({ kind: 'selectable' });
    });

    it('keeps the group selectable when only tool activity or thinking follows the reply', () => {
        const messages = [
            agentText('agent-1'),
            createToolCallMessageFixture({ id: 'tool-1', createdAt: 2 }),
            agentText('thinking-1', { isThinking: true, text: '考虑中' }),
        ];
        expect(resolve({ messages })).toEqual({ kind: 'selectable' });
    });

    it('retires the group once the user has answered in the transcript', () => {
        const messages = [agentText('agent-1'), userText('user-2', '安装')];
        expect(resolve({ messages })).toEqual({ kind: 'readOnly' });
    });

    it('retires the group once a newer agent reply exists', () => {
        const messages = [agentText('agent-1'), agentText('agent-2', { text: '好的' })];
        expect(resolve({ messages })).toEqual({ kind: 'readOnly' });
        expect(resolve({ messageId: 'agent-2', messages })).toEqual({ kind: 'selectable' });
    });

    it('retires the group while user input is queued for the session', () => {
        const pendingMessages = [createPendingMessageFixture({ source: 'local_outbound', text: '安装' })];
        expect(resolve({ messages: [agentText('agent-1')], pendingMessages })).toEqual({ kind: 'readOnly' });
    });

    it('stays read-only while a queued answer is being cancelled', () => {
        // Until the server confirms the cancel, the queued answer may already have reached the agent.
        const pendingMessages = [createPendingMessageFixture({ id: 'p-1', pendingOutboxOperation: 'cancel' })];
        expect(resolve({ messages: [agentText('agent-1')], pendingMessages })).toEqual({ kind: 'readOnly' });
    });

    it('ignores queued rows that are not user input', () => {
        const pendingMessages = [createPendingMessageFixture({ id: 'p-2', messageRole: 'non_user' })];
        expect(resolve({ messages: [agentText('agent-1')], pendingMessages })).toEqual({ kind: 'selectable' });
    });

    it('does not offer options while the reply is still streaming', () => {
        const streaming = agentText('agent-1', {
            meta: { happierStreamSegmentV1: { v: 1, segmentKind: 'assistant', segmentLocalId: 's-1', segmentState: 'streaming', updatedAtMs: 1 } },
        });
        expect(resolve({ messages: [streaming] })).toEqual({ kind: 'readOnly' });
    });

    it('shows the chosen option as submitting and locks every other group in the session', () => {
        const selection: MessageOptionSelection = { messageId: 'agent-1', title: '安装' };
        const messages = [agentText('agent-0'), userText('user-1', '继续'), agentText('agent-1')];
        expect(resolve({ messages, selection })).toEqual({ kind: 'submitting', title: '安装' });
        expect(resolve({ messageId: 'agent-0', messages, selection })).toEqual({ kind: 'readOnly' });
    });

    it('never offers options in a read-only session, in user messages, or in thinking', () => {
        expect(resolve({ messages: [agentText('agent-1')], canSendMessages: false })).toEqual({ kind: 'readOnly' });
        expect(resolve({ messageId: 'user-1', messages: [userText('user-1', OPTIONS_TEXT)] })).toEqual({ kind: 'readOnly' });
        expect(resolve({ messages: [agentText('agent-1', { isThinking: true })] })).toEqual({ kind: 'readOnly' });
    });
});
