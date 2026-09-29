import { describe, expect, it } from 'vitest';

import { mapClaudeJsonlLineToDirectMessages } from './mapClaudeJsonlLineToDirectMessages';

describe('mapClaudeJsonlLineToDirectMessages', () => {
  it.each([
    ['message-less assistant', { type: 'assistant', uuid: 'assistant-api-error', isApiErrorMessage: true }, 'event'],
    [
      'assistant text with missing nested role',
      { type: 'assistant', uuid: 'assistant-missing-role', message: { content: [{ type: 'text', text: 'hello' }] } },
      'agent',
    ],
  ] as const)('carries canonical role metadata for %s', (_name, lineValue, expectedRole) => {
    const [item] = mapClaudeJsonlLineToDirectMessages({
      fileRelPath: 'project/session.jsonl',
      lineStartOffsetBytes: 10,
      lineValue,
    });

    expect(item?.messageRole).toBe(expectedRole);
  });

  it('maps a prompt sent through the Agent SDK (text blocks) to a user text row', () => {
    // Shape observed in Claude Code 2.1.284 JSONL for a prompt Happier sends through the Agent SDK.
    const [item] = mapClaudeJsonlLineToDirectMessages({
      fileRelPath: 'project/session.jsonl',
      lineStartOffsetBytes: 253427,
      lineValue: {
        parentUuid: 'efa95029-9ae9-4cf9-be6a-7433094906a0',
        isSidechain: false,
        promptId: 'e25c3104-2133-471e-9512-2bf443fed433',
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: 'Reply with the single word: taken' }] },
        uuid: '9ab6e90c-f669-4406-9974-416e6883e252',
        timestamp: '2026-09-29T06:28:31.345Z',
        promptSource: 'sdk',
        entrypoint: 'sdk-ts',
        sessionId: '4ba60556-1975-4f9e-baf1-35be87d7f566',
      },
    });

    expect(item?.raw).toEqual({ role: 'user', content: { type: 'text', text: 'Reply with the single word: taken' } });
    expect(item?.messageRole).toBe('user');
  });

  it.each([
    ['interrupt marker', [{ type: 'text', text: '[Request interrupted by user]' }]],
    ['tool-use interrupt marker', [{ type: 'text', text: '[Request interrupted by user for tool use]' }]],
    ['tool result', [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'done' }]],
  ] as const)('keeps a user line carrying a %s out of the user text rows', (_name, content) => {
    const [item] = mapClaudeJsonlLineToDirectMessages({
      fileRelPath: 'project/session.jsonl',
      lineStartOffsetBytes: 10,
      lineValue: { type: 'user', uuid: 'user-array', message: { role: 'user', content } },
    });

    expect((item?.raw as any)?.role).toBe('agent');
  });

  it('carries canonical role metadata on the schema-mismatch fallback', () => {
    // A known row type whose body cannot be parsed at all still reaches managed storage as an opaque
    // record; without the role it is the one direct-session path that stays unclassified.
    const [item] = mapClaudeJsonlLineToDirectMessages({
      fileRelPath: 'project/session.jsonl',
      lineStartOffsetBytes: 10,
      lineValue: { type: 'assistant', uuid: 42, isApiErrorMessage: true },
    });

    expect((item?.raw as any)?.content?.data?.reason).toBe('schema_mismatch');
    expect(item?.messageRole).toBe('event');
  });
});
