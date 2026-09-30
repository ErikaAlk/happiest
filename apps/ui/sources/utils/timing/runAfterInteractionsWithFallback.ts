import { Platform } from 'react-native';

/**
 * Defers `fn` off the current render/commit, and returns a canceller.
 *
 * The two platforms schedule differently on purpose:
 *
 * - **Web** yields a real macrotask (`setTimeout(fn, 0)`), so the browser can lay out and paint the
 *   current commit before `fn` runs.
 * - **Native does NOT defer past the current JS task.** Bridgeless React Native installs
 *   `setImmediate` as a shim over `queueMicrotask` (`Libraries/Core/setUpTimers.js`), so the
 *   callback runs at the current task's microtask checkpoint — sooner than `setTimeout(fn, 0)`, and
 *   before the app ever yields to layout or paint.
 *
 * Two consequences worth knowing before reaching for this helper on native:
 *
 * 1. It cannot be starved. There is no interaction queue to wait on, so a saturated JS thread
 *    cannot hold the callback back.
 * 2. It does not relieve a busy frame. Work moved here still lands inside the same JS task, so it
 *    does not make an expensive open/navigation corridor paint any sooner. If you need native work
 *    to land after paint, schedule it explicitly (`requestAnimationFrame`, a real timer, or a
 *    dedicated frame gate) rather than assuming this helper does it.
 */
export function runAfterInteractionsWithFallback(fn: () => void): () => void {
    if (Platform.OS === 'web') {
        let cancelled = false;
        const handle = setTimeout(() => {
            if (cancelled) return;
            fn();
        }, 0);
        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }

    const handle = setImmediate(fn);
    return () => {
        clearImmediate(handle);
    };
}
