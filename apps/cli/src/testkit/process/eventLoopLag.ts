/**
 * Runs `work` and reports the longest stretch in which the event loop could not run a timer.
 * The final stretch counts too: a fully synchronous `work` never lets the timer fire at all.
 */
export async function measureMaxEventLoopLagMs<T>(
  work: () => Promise<T>,
): Promise<Readonly<{ result: T; maxLagMs: number }>> {
  const tickMs = 20
  let maxLagMs = 0
  let lastTurnAt = performance.now()
  const recordTurn = () => {
    const now = performance.now()
    maxLagMs = Math.max(maxLagMs, now - lastTurnAt - tickMs)
    lastTurnAt = now
  }
  const timer = setInterval(recordTurn, tickMs)
  try {
    const result = await work()
    recordTurn()
    return { result, maxLagMs }
  } finally {
    clearInterval(timer)
  }
}
