import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Scheduling model of the mocked boundary — React Native 0.88, New Architecture (bridgeless).
 * Verified in the package sources rather than assumed:
 *
 * - Bridgeless RN installs `setImmediate` / `clearImmediate` from `Libraries/Core/Timers/immediateShim.js`
 *   (`Libraries/Core/setUpTimers.js`).
 * - The shim queues the callback with `global.queueMicrotask` and skips it when its id was cleared first.
 *
 * Node's own `setImmediate` is a check-phase macrotask, so the native tests install the shim model as
 * the platform timer boundary. On native the callback runs in the *current* JS task's microtask
 * checkpoint. The web path is the deliberate opposite: `setTimeout(fn, 0)` is a real macrotask. These
 * tests assert that difference by ordering the callback against an already-queued timer, so they fail
 * if either platform silently adopts the other's scheduling.
 */

function mockPlatform(os: 'web' | 'ios'): void {
    vi.doMock('react-native', async () => {
        const stub = await import('@/dev/reactNativeStub');
        return {
            ...stub,
            Platform: { ...stub.Platform, OS: os },
        };
    });
}

function installBridgelessImmediateShim(): void {
    let nextId = 1;
    const cleared = new Set<number>();
    vi.stubGlobal('setImmediate', (callback: () => void) => {
        const id = nextId++;
        queueMicrotask(() => {
            if (cleared.has(id)) {
                cleared.delete(id);
                return;
            }
            callback();
        });
        return id;
    });
    vi.stubGlobal('clearImmediate', (id: number) => {
        cleared.add(id);
    });
}

function nextMacrotask(): Promise<void> {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });
}

async function importHelper() {
    const module = await import('./runAfterInteractionsWithFallback');
    return module.runAfterInteractionsWithFallback;
}

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.clearAllMocks();
});

describe('runAfterInteractionsWithFallback', () => {
    it('web: yields a real macrotask, running after an already-queued timer', async () => {
        mockPlatform('web');
        const runAfterInteractionsWithFallback = await importHelper();

        const order: string[] = [];
        setTimeout(() => order.push('queued-timer'), 0);
        runAfterInteractionsWithFallback(() => order.push('deferred'));

        await Promise.resolve();
        expect(order).toEqual([]);

        await nextMacrotask();
        expect(order).toEqual(['queued-timer', 'deferred']);
    });

    it('web: cancel prevents the callback', async () => {
        mockPlatform('web');
        const runAfterInteractionsWithFallback = await importHelper();

        const fn = vi.fn();
        runAfterInteractionsWithFallback(fn)();

        await nextMacrotask();
        expect(fn).not.toHaveBeenCalled();
    });

    it('native: runs in the current JS task, before an already-queued macrotask', async () => {
        mockPlatform('ios');
        installBridgelessImmediateShim();
        const runAfterInteractionsWithFallback = await importHelper();

        const order: string[] = [];
        setTimeout(() => order.push('queued-timer'), 0);
        runAfterInteractionsWithFallback(() => order.push('deferred'));

        await Promise.resolve();
        expect(order).toEqual(['deferred']);

        await nextMacrotask();
        expect(order).toEqual(['deferred', 'queued-timer']);
    });

    it('native: leaves no pending timer behind', async () => {
        mockPlatform('ios');
        installBridgelessImmediateShim();
        const runAfterInteractionsWithFallback = await importHelper();

        const fn = vi.fn();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
        runAfterInteractionsWithFallback(fn);

        expect(vi.getTimerCount()).toBe(0);

        await Promise.resolve();
        expect(fn).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('native: cancel prevents the callback', async () => {
        mockPlatform('ios');
        installBridgelessImmediateShim();
        const runAfterInteractionsWithFallback = await importHelper();

        const fn = vi.fn();
        runAfterInteractionsWithFallback(fn)();

        await Promise.resolve();
        await nextMacrotask();
        expect(fn).not.toHaveBeenCalled();
    });
});
