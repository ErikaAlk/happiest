import type { ACPMessageData } from '@/api/session/sessionMessageTypes';
import type { StreamedTranscriptWriterSession } from '@/api/session/streamedTranscriptWriter/types';
import type { MessageBuffer } from '@/ui/ink/messageBuffer';

/**
 * The Codex app-server runtime writes its replies only to the session transcript. Wrapping the
 * transcript port it writes through lets the terminal display (the window of a session the daemon
 * opened in a console or Windows Terminal, or a terminal-started session in remote mode) show the
 * same replies once committed. A streamed segment is committed again under the same `localId` as
 * it grows, so the display keeps one entry per segment with its latest text.
 */
export function mirrorCommittedRepliesToTerminal(
  port: StreamedTranscriptWriterSession,
  messageBuffer: MessageBuffer,
): StreamedTranscriptWriterSession {
  const show = (body: ACPMessageData, localId: string): void => {
    if (body.type === 'message' && body.message.trim().length > 0) {
      messageBuffer.upsertMessage(localId, body.message, 'assistant');
    }
  };
  const { sendAgentMessageCommitted, sendAgentMessageCommittedExact, enqueueAgentMessageCommitted } = port;

  return {
    ...port,
    ...(sendAgentMessageCommitted
      ? {
        sendAgentMessageCommitted: async (provider, body, opts) => {
          await sendAgentMessageCommitted(provider, body, opts);
          show(body, opts.localId);
        },
      }
      : {}),
    ...(sendAgentMessageCommittedExact
      ? {
        sendAgentMessageCommittedExact: async (provider, body, opts) => {
          const result = await sendAgentMessageCommittedExact(provider, body, opts);
          show(body, opts.localId);
          return result;
        },
      }
      : {}),
    ...(enqueueAgentMessageCommitted
      ? {
        enqueueAgentMessageCommitted: async (provider, body, opts) => {
          const result = await enqueueAgentMessageCommitted(provider, body, opts);
          show(body, opts.localId);
          return result;
        },
      }
      : {}),
  };
}
