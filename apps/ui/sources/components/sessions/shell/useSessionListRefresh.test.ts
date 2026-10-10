import { createServer, type ServerResponse } from 'node:http';
import { act } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';

import { renderHook, standardCleanup } from '@/dev/testkit';

const sentryBoundary = vi.hoisted(() => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));
// Sentry SDK 是外部上报边界，诊断封装与刷新逻辑使用真实实现。
vi.mock('@sentry/react-native', async (importOriginal) => ({
    ...await importOriginal<typeof import('@sentry/react-native')>(),
    ...sentryBoundary,
}));

afterEach(async () => {
    await standardCleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

it('reports a real transport failure without rejecting across onRefresh, clears refreshing and permits recovery', async () => {
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', 'https://public@example.test/1');
    const { useSessionListRefresh } = await import('./useSessionListRefresh');
    const loggedErrors = vi.spyOn(console, 'error');
    let pendingResponse: ServerResponse | undefined;
    let requests = 0;
    let shouldFail = true;
    const server = createServer((_request, response) => {
        requests += 1;
        if (shouldFail) pendingResponse = response;
        else response.end('{}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('测试 HTTP 服务没有 TCP 地址');
    const refreshSessions = async () => { await fetch(`http://127.0.0.1:${address.port}/sessions`); };
    try {
        const hook = await renderHook(() => useSessionListRefresh({ dataActiveRef: { current: true }, refreshSessions }));
        let escapedFailure: Promise<unknown> = Promise.resolve();
        await act(async () => {
            escapedFailure = Promise.resolve(hook.getCurrent().handleRefreshSessions()).then(
                () => undefined,
                (error: unknown) => error,
            );
            void hook.getCurrent().handleRefreshSessions();
        });
        await vi.waitFor(() => expect(pendingResponse).toBeDefined());
        expect(hook.getCurrent().refreshingSessions).toBe(true);
        expect(requests).toBe(1);
        await act(async () => {
            pendingResponse?.destroy();
            expect(await escapedFailure).toBeUndefined();
            await vi.waitFor(() => expect(sentryBoundary.captureException).toHaveBeenCalled());
        });
        expect(hook.getCurrent().refreshingSessions).toBe(false);
        const [error, context] = sentryBoundary.captureException.mock.calls[0];
        expect(error).toBeInstanceOf(AggregateError);
        expect(error.errors).toEqual([expect.objectContaining({ name: 'TypeError' })]);
        expect(context.tags).toMatchObject({ 'happier.ui.diagnostic': 'refresh_failure', 'happier.ui.screen': 'session_list' });
        expect(loggedErrors).toHaveBeenCalledWith('[fireAndForget] SessionsList.refreshSessions', error);
        shouldFail = false;
        await act(async () => {
            void hook.getCurrent().handleRefreshSessions();
            await vi.waitFor(() => expect(requests).toBe(2));
        });
        await act(async () => { await vi.waitFor(() => expect(hook.getCurrent().refreshingSessions).toBe(false)); });
    } finally {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
});
