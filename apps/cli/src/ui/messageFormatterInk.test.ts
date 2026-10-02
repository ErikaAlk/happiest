import { describe, expect, it } from 'vitest';

import type { SDKMessage } from '@/backends/claude/sdk';

import { MessageBuffer } from './ink/messageBuffer';
import { formatClaudeMessageForInk } from './messageFormatterInk';

function format(...messages: unknown[]): string[] {
  const buffer = new MessageBuffer();
  buffer.addMessage('👤 User: say the word', 'user');
  for (const message of messages) {
    formatClaudeMessageForInk(message as SDKMessage, buffer);
  }
  return buffer.getMessages().slice(1).map((entry) => entry.content);
}

const successResult = {
  type: 'result',
  subtype: 'success',
  result: 'noted BIRCH',
  num_turns: 1,
  duration_ms: 5475,
  total_cost_usd: 0.2076,
  usage: { input_tokens: 2, output_tokens: 176, cache_read_input_tokens: 19916, cache_creation_input_tokens: 24886 },
};

describe('formatClaudeMessageForInk', () => {
  it('names the session in one line without listing every available tool', () => {
    const lines = format({
      type: 'system',
      subtype: 'init',
      session_id: 'claude-session-1',
      model: 'claude-opus-5-5',
      cwd: 'C:\\work',
      tools: Array.from({ length: 150 }, (_, index) => `tool_${index}`),
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('claude-session-1');
    expect(lines[0]).toContain('claude-opus-5-5');
    expect(lines[0]).not.toMatch(/tool_\d/);
  });

  it('shows the reply from the result when the streamed assistant messages carried no text', () => {
    const lines = format(
      { type: 'assistant', message: { content: [{ type: 'thinking', thinking: '' }] } },
      { type: 'assistant', message: { content: [] } },
      successResult,
    );

    expect(lines.filter((line) => line.includes('noted BIRCH'))).toHaveLength(1);
    expect(lines.filter((line) => line.includes('Assistant'))).toHaveLength(1);
    expect(lines.at(-1)).toContain('5.5s');
    expect(lines.at(-1)).toContain('$0.2076');
  });

  it('shows a reply the assistant message already carried only once', () => {
    const lines = format(
      { type: 'assistant', message: { content: [{ type: 'text', text: 'noted BIRCH' }] } },
      successResult,
    );

    expect(lines.filter((line) => line.includes('noted BIRCH'))).toHaveLength(1);
  });
});
