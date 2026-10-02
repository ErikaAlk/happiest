import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WINDOWS_TERMINAL_WINDOW_NAME,
  normalizeWindowsTerminalWindowName,
  WindowsTerminalWindowNameSchema,
} from './windowsTerminalWindowName.js';

describe('windowsTerminalWindowName', () => {
  it('normalizes empty and reserved Windows Terminal window names to the shared default', () => {
    expect(DEFAULT_WINDOWS_TERMINAL_WINDOW_NAME).toBe('happiest');
    expect(normalizeWindowsTerminalWindowName('')).toBe('happiest');
    expect(normalizeWindowsTerminalWindowName('   ')).toBe('happiest');
    expect(normalizeWindowsTerminalWindowName('new')).toBe('happiest');
    expect(normalizeWindowsTerminalWindowName('0')).toBe('happiest');
  });

  it('preserves explicit named Windows Terminal windows', () => {
    expect(normalizeWindowsTerminalWindowName('  happiest qa  ')).toBe('happiest qa');
    expect(WindowsTerminalWindowNameSchema.parse('happiest-dev')).toBe('happiest-dev');
  });
});
