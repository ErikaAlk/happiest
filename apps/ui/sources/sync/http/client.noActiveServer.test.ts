import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
    vi.doUnmock('@/sync/domains/server/serverRuntime');
    vi.doUnmock('@/auth/storage/tokenStorage');
    vi.unstubAllGlobals();
    vi.resetModules();
});

async function importWithNoActiveServer() {
    vi.resetModules();
    vi.doMock('@/sync/domains/server/serverRuntime', () => ({
        getActiveServerSnapshot: () => ({ serverId: '', serverUrl: '', generation: 0 }),
        subscribeActiveServer: () => () => {},
    }));
    vi.doMock('@/auth/storage/tokenStorage', () => ({
        TokenStorage: {
            getCredentials: vi.fn(async () => null),
            invalidateCredentialsTokenForServerUrl: vi.fn(async () => false),
        },
    }));
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => (
        new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } })
    ));
    const client = await import('./client');
    client.setRuntimeFetch(fetchMock);
    return { client, fetchMock };
}

describe('serverFetch without an active server', () => {
    it('refuses a path relative to the active server instead of requesting the app origin', async () => {
        const { client, fetchMock } = await importWithNoActiveServer();

        await expect(client.serverFetch('/v1/features', undefined, { includeAuth: false, retry: 'none' }))
            .rejects.toBeInstanceOf(client.NoActiveServerError);
        expect(fetchMock).not.toHaveBeenCalled();

        await client.serverFetch('https://other.example.test/v1/features', undefined, { includeAuth: false, retry: 'none' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('lets the features probe fail by name, without caching or retrying it as a network error', async () => {
        const { client, fetchMock } = await importWithNoActiveServer();
        const features = await import('@/sync/api/capabilities/serverFeaturesClient');
        features.resetServerFeaturesClientForTests();

        await expect(features.getServerFeaturesSnapshot()).rejects.toBeInstanceOf(client.NoActiveServerError);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(features.getCachedServerFeaturesSnapshot()).toBeNull();
    });
});
