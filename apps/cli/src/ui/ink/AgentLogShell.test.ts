import { EventEmitter } from 'node:events';

import { render } from 'ink';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { MessageBuffer } from '@/ui/ink/messageBuffer';

import { AgentLogShell } from './AgentLogShell';

class FakeTerminalOutput extends EventEmitter {
  public frames: string[] = [];

  constructor(public columns: number, public rows: number) {
    super();
  }

  write(chunk: string | Uint8Array): boolean {
    this.frames.push(String(chunk));
    return true;
  }

  lastFrame(): string {
    return this.frames.at(-1) ?? '';
  }
}

class FakeTerminalInput extends EventEmitter {
  public isTTY = true;

  setRawMode(): this {
    return this;
  }

  setEncoding(): this {
    return this;
  }

  resume(): this {
    return this;
  }

  pause(): this {
    return this;
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }

  read(): null {
    return null;
  }
}

describe('AgentLogShell', () => {
  it('keeps a message taller than the log from drawing over the newest messages', async () => {
    const messageBuffer = new MessageBuffer();
    messageBuffer.addMessage(`Tools: ${Array.from({ length: 150 }, (_, index) => `tool_${index}`).join(', ')}`, 'status');
    messageBuffer.addMessage('ALPHA reply', 'assistant');
    messageBuffer.addMessage('BETA reply', 'assistant');
    const stdout = new FakeTerminalOutput(60, 24);
    const stdin = new FakeTerminalInput();

    // Ink boundary: a terminal with a known size whose frames the test reads back.
    const instance = render(React.createElement(AgentLogShell, { messageBuffer, title: 'Gemini' }), {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      debug: true,
      patchConsole: false,
      exitOnCtrlC: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const lines = stdout.lastFrame().split('\n');
    instance.unmount();

    expect(lines.some((line) => line.includes('BETA reply'))).toBe(true);
    for (const line of lines.filter((candidate) => candidate.includes('ALPHA') || candidate.includes('BETA'))) {
      expect(line).not.toMatch(/tool_\d/);
    }
  });
});
