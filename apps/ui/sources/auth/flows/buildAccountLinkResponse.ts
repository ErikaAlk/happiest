import type { AuthCredentials } from '@/auth/storage/tokenStorage';
import { isLegacyAuthCredentials } from '@/auth/storage/tokenStorage';
import { decodeBase64 } from '@/encryption/base64';
import { sealAccountLinkPayload } from '@happier-dev/protocol';
import { getRandomBytes } from '@/platform/cryptoRandom';

export function buildAccountLinkResponse(credentials: AuthCredentials, recipientPublicKey: Uint8Array): Uint8Array {
    return sealAccountLinkPayload({
        material: isLegacyAuthCredentials(credentials)
            ? { type: 'legacy', secret: decodeBase64(credentials.secret, 'base64url') }
            : {
                type: 'dataKey',
                publicKey: decodeBase64(credentials.encryption.publicKey, 'base64'),
                machineKey: decodeBase64(credentials.encryption.machineKey, 'base64'),
            },
        recipientPublicKey,
        randomBytes: getRandomBytes,
    });
}
