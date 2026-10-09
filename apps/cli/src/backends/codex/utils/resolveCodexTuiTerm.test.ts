import { describe, expect, it } from 'vitest';

import { resolveCodexTuiTerm } from './resolveCodexTuiTerm';

describe('Codex TUI terminal environment', () => {
  it('uses the Windows interactive console capabilities when the daemon inherited TERM=dumb', () => {
    expect(resolveCodexTuiTerm({ term: 'dumb', platform: 'win32', interactive: true })).toBe('xterm-256color');
    expect(resolveCodexTuiTerm({ term: undefined, platform: 'win32', interactive: true })).toBe('xterm-256color');
  });

  it('preserves an explicit terminal and non-interactive or other-platform capabilities', () => {
    expect(resolveCodexTuiTerm({ term: 'vt100', platform: 'win32', interactive: true })).toBe('vt100');
    expect(resolveCodexTuiTerm({ term: 'dumb', platform: 'win32', interactive: false })).toBe('dumb');
    expect(resolveCodexTuiTerm({ term: 'dumb', platform: 'linux', interactive: true })).toBe('dumb');
  });
});
