import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { waitForDaemonRunningWithinBudget } from './waitForDaemonRunningWithinBudget';

describe('waitForDaemonRunningWithinBudget', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('performs one final readiness check when the timeout budget is exhausted', async () => {
    let checks = 0;
    const result = waitForDaemonRunningWithinBudget({
      isRunning: async () => ++checks === 3,
      timeoutMs: 200,
      pollMs: 100,
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(await result).toBe(true);
    expect(checks).toBe(3);
  });

  it('counts slow readiness checks against elapsed time and returns false near the deadline', async () => {
    let checks = 0;
    let completed = false;
    const startedAt = performance.now();
    let elapsedMs = 0;
    const result = waitForDaemonRunningWithinBudget({
      isRunning: async () => {
        checks++;
        await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
        return false;
      },
      timeoutMs: 120_000,
      pollMs: 100,
    }).then((running) => {
      completed = true;
      elapsedMs = performance.now() - startedAt;
      return running;
    });
    await vi.advanceTimersByTimeAsync(121_000);
    expect(completed).toBe(true);
    expect(await result).toBe(false);
    expect(elapsedMs).toBeGreaterThanOrEqual(120_000);
    expect(elapsedMs).toBeLessThanOrEqual(121_000);
    expect(checks).toBeLessThanOrEqual(111);
  });

  it('includes the initial readiness check in the budget', async () => {
    let checks = 0;
    let completed = false;
    const result = waitForDaemonRunningWithinBudget({
      isRunning: async () => {
        checks++;
        await new Promise<void>((resolve) => setTimeout(resolve, 300));
        return false;
      },
      timeoutMs: 200,
      pollMs: 100,
    }).then((running) => { completed = true; return running; });
    await vi.advanceTimersByTimeAsync(300);
    expect(completed).toBe(true);
    expect(await result).toBe(false);
    expect(checks).toBe(1);
  });

  it('returns false at the deadline when readiness checks are fast', async () => {
    let checks = 0;
    const result = waitForDaemonRunningWithinBudget({
      isRunning: async () => { checks++; return false; },
      timeoutMs: 250,
      pollMs: 100,
    });
    await vi.advanceTimersByTimeAsync(250);
    expect(await result).toBe(false);
    expect(checks).toBe(4);
  });

  it('returns immediately when already running', async () => {
    expect(await waitForDaemonRunningWithinBudget({
      isRunning: async () => true,
      timeoutMs: 200,
      pollMs: 100,
    })).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
