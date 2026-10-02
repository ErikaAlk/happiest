import { describe, expect, it, vi } from 'vitest';

import type { StreamedTranscriptWriterSession } from '@/api/session/streamedTranscriptWriter/types';
import { MessageBuffer } from '@/ui/ink/messageBuffer';

import { mirrorCommittedRepliesToTerminal } from './mirrorCommittedRepliesToTerminal';

describe('mirrorCommittedRepliesToTerminal', () => {
  it('shows each committed reply in the terminal after the transcript accepts it', async () => {
    const commits: string[] = [];
    // Session transcript boundary: records what reaches the server.
    const port: StreamedTranscriptWriterSession = {
      sendAgentMessageCommitted: vi.fn(async (_provider, body) => {
        commits.push(body.type);
      }),
      sendAgentMessageCommittedExact: vi.fn(async (_provider, body) => {
        commits.push(body.type);
        return { type: 'committed' } as never;
      }),
      enqueueAgentMessageCommitted: vi.fn(async (_provider, body) => {
        commits.push(body.type);
        return { persisted: true, delivered: true };
      }),
    };
    const messageBuffer = new MessageBuffer();
    const mirrored = mirrorCommittedRepliesToTerminal(port, messageBuffer);

    await mirrored.sendAgentMessageCommitted?.('codex', { type: 'message', message: 'first reply' }, { localId: 'a' });
    await mirrored.sendAgentMessageCommittedExact?.('codex', { type: 'message', message: 'second reply' }, { localId: 'b' });
    await mirrored.enqueueAgentMessageCommitted?.('codex', { type: 'message', message: 'third reply' }, {
      localId: 'c',
      provenance: {} as never,
    });
    await mirrored.sendAgentMessageCommitted?.('codex', { type: 'reasoning', message: 'thinking' } as never, { localId: 'd' });

    expect(commits).toEqual(['message', 'message', 'message', 'reasoning']);
    expect(messageBuffer.getMessages().map((entry) => [entry.type, entry.content])).toEqual([
      ['assistant', 'first reply'],
      ['assistant', 'second reply'],
      ['assistant', 'third reply'],
    ]);
  });

  it('shows a reply committed again as it grows once, with its latest text', async () => {
    const port: StreamedTranscriptWriterSession = {
      sendAgentMessageCommittedExact: vi.fn(async () => ({ type: 'committed' }) as never),
    };
    const messageBuffer = new MessageBuffer();
    const mirrored = mirrorCommittedRepliesToTerminal(port, messageBuffer);

    await mirrored.sendAgentMessageCommittedExact?.('codex', { type: 'message', message: 'not' }, { localId: 'segment-1' });
    await mirrored.sendAgentMessageCommittedExact?.('codex', { type: 'message', message: 'noted LARCH' }, { localId: 'segment-1' });
    await mirrored.sendAgentMessageCommittedExact?.('codex', { type: 'message', message: 'noted LARCH' }, { localId: 'segment-1' });

    expect(messageBuffer.getMessages().map((entry) => entry.content)).toEqual(['noted LARCH']);
  });
});
