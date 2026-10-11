import { beforeAll, describe, expect, it, vi } from 'vitest';

import sodium from '@/encryption/libsodium.lib';
import { encodeBase64 } from '@/encryption/base64';
import { encryptBox } from '@/encryption/libsodium';
import { generateAuthKeyPair } from './qrStart';
import { authQRWait } from './qrWait';
import { serverFetch } from '@/sync/http/client';
import { getActiveServerSnapshot, upsertAndActivateServer } from '@/sync/domains/server/serverRuntime';
import { listServerProfiles } from '@/sync/domains/server/serverProfiles';
import { buildAccountLinkResponse } from './buildAccountLinkResponse';
import tweetnacl from 'tweetnacl';

vi.mock('@/sync/http/client', () => ({
    serverFetch: vi.fn(),
}));

function makeJsonResponse(status: number, payload: unknown): Response {
    return new Response(JSON.stringify(payload), { status });
}

describe('authQRWait v2 fallback', () => {
    beforeAll(async () => {
        await sodium.ready;
    });

    it('uses /v2/auth/account/request when available', async () => {
        const keypair = generateAuthKeyPair();
        const expectedToken = 'tkn-test-1';
        const expectedSecret = tweetnacl.randomBytes(32);

        const tokenEncrypted = encodeBase64(encryptBox(new TextEncoder().encode(expectedToken), keypair.publicKey));
        const responseEncrypted = encodeBase64(encryptBox(expectedSecret, keypair.publicKey));

        const fetchMock = vi.mocked(serverFetch);
        fetchMock.mockReset();
        fetchMock.mockResolvedValueOnce(
            makeJsonResponse(200, { state: 'authorized', tokenEncrypted, response: responseEncrypted }),
        );

        const out = await authQRWait(keypair);
        expect(out?.token).toBe(expectedToken);
        expect(out).toEqual({ token: expectedToken, secret: encodeBase64(expectedSecret, 'base64url') });
        expect(fetchMock.mock.calls[0]?.[0]).toBe('/v2/auth/account/request');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('falls back to /v1/auth/account/request when /v2 is missing', async () => {
        const keypair = generateAuthKeyPair();
        const expectedToken = 'tkn-test-2';
        const expectedSecret = tweetnacl.randomBytes(32);

        const responseEncrypted = encodeBase64(encryptBox(expectedSecret, keypair.publicKey));

        const fetchMock = vi.mocked(serverFetch);
        fetchMock.mockReset();
        fetchMock.mockResolvedValueOnce(makeJsonResponse(404, { error: 'Not Found' }));
        fetchMock.mockResolvedValueOnce(
            makeJsonResponse(200, { state: 'authorized', token: expectedToken, response: responseEncrypted }),
        );

        const out = await authQRWait(keypair);
        expect(out?.token).toBe(expectedToken);
        expect(out).toEqual({ token: expectedToken, secret: encodeBase64(expectedSecret, 'base64url') });
        expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
            '/v2/auth/account/request',
            '/v1/auth/account/request',
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('stores server identity from authorized auth responses', async () => {
        const keypair = generateAuthKeyPair();
        const expectedToken = 'tkn-test-identity';
        const expectedSecret = tweetnacl.randomBytes(32);
        const responseEncrypted = encodeBase64(encryptBox(expectedSecret, keypair.publicKey));

        upsertAndActivateServer({ serverUrl: 'https://relay.example.test' });
        const serverUrl = getActiveServerSnapshot().serverUrl;
        const fetchMock = vi.mocked(serverFetch);
        fetchMock.mockReset();
        fetchMock.mockResolvedValueOnce(
            makeJsonResponse(200, {
                state: 'authorized',
                token: expectedToken,
                response: responseEncrypted,
                serverIdentityId: 'srv_auth_identity',
            }),
        );

        const out = await authQRWait(keypair);

        expect(out?.token).toBe(expectedToken);
        expect(listServerProfiles().find(profile => profile.serverUrl === serverUrl)?.serverIdentityId).toBe('srv_auth_identity');
    });

    it('returns complete dataKey credentials through the existing v1 relay contract', async () => {
        const keypair = generateAuthKeyPair();
        const content = tweetnacl.box.keyPair();
        const credentials = { token: 'data-key-token', encryption: { publicKey: encodeBase64(content.publicKey), machineKey: encodeBase64(content.secretKey) } };
        const responseEncrypted = encodeBase64(buildAccountLinkResponse(credentials, keypair.publicKey));
        const fetchMock = vi.mocked(serverFetch);
        fetchMock.mockReset();
        fetchMock.mockResolvedValueOnce(makeJsonResponse(404, {}));
        fetchMock.mockResolvedValueOnce(makeJsonResponse(200, { state: 'authorized', token: credentials.token, response: responseEncrypted }));
        expect(await authQRWait(keypair)).toEqual(credentials);
    });
});
