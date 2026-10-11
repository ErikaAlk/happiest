import { describe, expect, it } from 'vitest';
import tweetnacl from 'tweetnacl';
import { encodeBase64 } from '@/encryption/base64';
import { decryptBox } from '@/encryption/libsodium';
import { buildAccountLinkResponse } from './buildAccountLinkResponse';

describe('account link credential handoff', () => {
    it('transfers the content public key and machine key with an unambiguous versioned type', () => {
        const content = tweetnacl.box.keyPair();
        const recipient = tweetnacl.box.keyPair();
        const payload = buildAccountLinkResponse({
            token: 'account-token',
            encryption: { publicKey: encodeBase64(content.publicKey), machineKey: encodeBase64(content.secretKey) },
        }, recipient.publicKey);
        const opened = decryptBox(payload, recipient.secretKey);
        expect(opened).not.toBeNull();
        expect(opened!.length).toBe(70);
        expect(opened!.slice(0, 6)).toEqual(new Uint8Array([0x48, 0x41, 0x4c, 0x4b, 1, 1]));
        expect(opened!.slice(6, 38)).toEqual(content.publicKey);
        expect(opened!.slice(38)).toEqual(content.secretKey);
    });

    it('keeps a legacy recovery secret byte for byte, including a matching magic prefix', () => {
        const secret = tweetnacl.randomBytes(32);
        secret.set([0x48, 0x41, 0x4c, 0x4b, 1, 1]);
        const recipient = tweetnacl.box.keyPair();
        const payload = buildAccountLinkResponse({ token: 'account-token', secret: encodeBase64(secret, 'base64url') }, recipient.publicKey);
        expect(decryptBox(payload, recipient.secretKey)).toEqual(secret);
    });
});
