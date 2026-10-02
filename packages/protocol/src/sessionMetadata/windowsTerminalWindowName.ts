import { z } from 'zod';

// Same value as `productIdentity.commandName`, so sessions of an installed upstream Happier (window
// `happier`) never open as tabs of this product's window. Protocol builds before release-runtime, so
// it carries the literal and scripts/release/product_identity_literals.contract.test.mjs compares it.
export const DEFAULT_WINDOWS_TERMINAL_WINDOW_NAME = 'happiest';

const WINDOWS_TERMINAL_RESERVED_WINDOW_NAMES = new Set(['new', '-1', 'last', '0']);

export function normalizeWindowsTerminalWindowName(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return DEFAULT_WINDOWS_TERMINAL_WINDOW_NAME;
  if (WINDOWS_TERMINAL_RESERVED_WINDOW_NAMES.has(trimmed.toLowerCase())) {
    return DEFAULT_WINDOWS_TERMINAL_WINDOW_NAME;
  }
  return trimmed;
}

export const WindowsTerminalWindowNameSchema = z
  .unknown()
  .transform((value) => normalizeWindowsTerminalWindowName(value));
