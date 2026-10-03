import { describe, expect, it, vi } from 'vitest';

import { NoServerConfiguredError } from '@/server/noServerConfiguredError';

import { waitForActiveServer } from './waitForActiveServer';

function baseOptions(overrides: Partial<Parameters<typeof waitForActiveServer>[0]> = {}): Parameters<typeof waitForActiveServer>[0] {
  return {
    isInteractive: false,
    waitForAuthEnabled: true,
    waitForAuthTimeoutMs: 0,
    hasActiveServer: () => false,
    refresh: () => {},
    resolvesWhenShutdownRequested: new Promise(() => {}),
    logger: { debug: vi.fn() },
    sleepMs: 0,
    ...overrides,
  };
}

describe('waitForActiveServer', () => {
  it('continues at once when a server is already active', async () => {
    const refresh = vi.fn();

    await expect(waitForActiveServer(baseOptions({ hasActiveServer: () => true, refresh }))).resolves.toBe('continue');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('fails with the setup hint when nobody asked the daemon to wait', async () => {
    await expect(waitForActiveServer(baseOptions({ waitForAuthEnabled: false }))).rejects.toBeInstanceOf(NoServerConfiguredError);
    await expect(waitForActiveServer(baseOptions({ isInteractive: true }))).rejects.toBeInstanceOf(NoServerConfiguredError);
  });

  it('waits for a background service until the user adds a server', async () => {
    const answers = [false, false, true];
    const refresh = vi.fn();

    const result = await waitForActiveServer(baseOptions({
      hasActiveServer: () => answers.shift() ?? true,
      refresh,
    }));

    expect(result).toBe('continue');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('stops waiting when shutdown is requested', async () => {
    const result = await waitForActiveServer(baseOptions({ resolvesWhenShutdownRequested: Promise.resolve() }));

    expect(result).toBe('shutdown');
  });

  it('gives up with the setup hint once the configured wait runs out', async () => {
    await expect(waitForActiveServer(baseOptions({ waitForAuthTimeoutMs: 1, sleepMs: 5 }))).rejects.toBeInstanceOf(NoServerConfiguredError);
  });
});
