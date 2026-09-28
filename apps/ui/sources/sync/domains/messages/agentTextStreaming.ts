import { readStreamSegmentMetaV1 } from '@/sync/reducer/helpers/streamSegmentMeta';

import type { Message } from './messageTypes';

/**
 * Whether an agent text message is still being produced by its stream segment.
 *
 * An assistant segment without a recorded state is treated as streaming: the
 * producer only writes a terminal state once the segment is complete.
 */
export function isAgentTextMessageStreaming(message: Message): boolean {
    if (message.kind !== 'agent-text') return false;
    const streamSegmentMeta = readStreamSegmentMetaV1(message.meta);
    if (!streamSegmentMeta) return false;
    if (streamSegmentMeta.segmentState === 'streaming') return true;
    return streamSegmentMeta.segmentKind === 'assistant' && streamSegmentMeta.segmentState === null;
}
