export async function waitForDaemonRunningWithinBudget(params: {
  isRunning: () => Promise<boolean>;
  timeoutMs: number;
  pollMs: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<boolean> {
  const deadline = performance.now() + params.timeoutMs;
  if (await params.isRunning()) return true;

  const sleep =
    typeof params.sleep === 'function'
      ? params.sleep
      : (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  let remainingMs = deadline - performance.now();
  while (remainingMs > 0) {
    const sleepMs = Math.min(params.pollMs, remainingMs);
    await sleep(sleepMs);
    if (await params.isRunning()) return true;
    remainingMs = deadline - performance.now();
  }

  return false;
}
