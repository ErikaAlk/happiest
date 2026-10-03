import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react-test-renderer';
import { FeaturesResponseSchema } from '@happier-dev/protocol';

import { flushHookEffects } from '@/hooks/server/serverFeatureHookHarness.testHelpers';
import { renderScreen } from '@/dev/testkit';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const activeServerRef = vi.hoisted(() => ({
    current: { serverId: '', serverUrl: '', generation: 0 },
}));

const activeServerListeners = vi.hoisted(() => ({
    listeners: new Set<(snapshot: unknown) => void>(),
}));

vi.mock('@/sync/domains/server/serverRuntime', () => ({
    getActiveServerSnapshot: () => activeServerRef.current,
    subscribeActiveServer: (listener: (snapshot: unknown) => void) => {
        activeServerListeners.listeners.add(listener);
        return () => activeServerListeners.listeners.delete(listener);
    },
}));

function emitActiveServerChanged(next: { serverId: string; serverUrl: string; generation: number }) {
    activeServerRef.current = next;
    for (const listener of activeServerListeners.listeners) {
        listener(next);
    }
}

describe('useServerFeaturesRuntimeSnapshot without an active server', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        activeServerListeners.listeners.clear();
    });

    it('makes no request and keeps the snapshot loading until a server becomes active', async () => {
        vi.resetModules();
        vi.useFakeTimers();
        activeServerRef.current = { serverId: '', serverUrl: '', generation: 0 };

        const fetchMock = vi.fn(async (url: unknown) => {
            if (String(url).startsWith('https://relay.example.test')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => FeaturesResponseSchema.parse({
                        features: { voice: { enabled: true } },
                        capabilities: { voice: { configured: true, provider: 'elevenlabs' } },
                    }),
                } as Response;
            }
            throw new TypeError('Network request failed');
        });
        vi.stubGlobal('fetch', fetchMock);

        const { resetServerFeaturesClientForTests } = await import('@/sync/api/capabilities/serverFeaturesClient');
        resetServerFeaturesClientForTests();
        const { useServerFeaturesRuntimeSnapshot } = await import('./featureDecisionRuntime');

        const seen: Array<{ status: string }> = [];
        function Probe() {
            const snapshot = useServerFeaturesRuntimeSnapshot();
            React.useEffect(() => {
                seen.push(snapshot);
            }, [snapshot]);
            return React.createElement('View');
        }

        await renderScreen(React.createElement(Probe));
        await flushHookEffects(6);
        // Longer than every transient-error retry delay of the features client.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(seen.map((snapshot) => snapshot.status)).toEqual(['loading']);

        await act(async () => {
            emitActiveServerChanged({ serverId: 'relay-1', serverUrl: 'https://relay.example.test', generation: 1 });
            await flushHookEffects(6);
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://relay.example.test/v1/features');
        expect(seen.at(-1)?.status).toBe('ready');
    });
});
