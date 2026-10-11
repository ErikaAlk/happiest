import { describe, expect, it } from 'vitest';
import tweetnacl from 'tweetnacl';
import { sealAccountLinkPayload, openAccountLinkPayload } from './accountLink.js';
import { deriveBoxPublicKeyFromSeed, sealBoxBundle } from './boxBundle.js';

describe('account link payload', () => {
  it('preserves raw and seed content key pairs without deriving a replacement', () => {
    for (const seedMode of [false, true]) {
      const recipient = tweetnacl.box.keyPair();
      const machineKey = tweetnacl.randomBytes(32);
      const publicKey = seedMode ? deriveBoxPublicKeyFromSeed(machineKey) : tweetnacl.box.keyPair.fromSecretKey(machineKey).publicKey;
      const material = { type: 'dataKey' as const, publicKey, machineKey };
      const payload = sealAccountLinkPayload({ material, recipientPublicKey: recipient.publicKey, randomBytes: tweetnacl.randomBytes });
      expect(openAccountLinkPayload({ payload, recipientSecretKeyOrSeed: recipient.secretKey })).toEqual(material);
    }
  });

  it('accepts every 32-byte legacy secret even when the prefix resembles a typed payload', () => {
    const recipient = tweetnacl.box.keyPair();
    const secret = tweetnacl.randomBytes(32);
    secret.set([0x48, 0x41, 0x4c, 0x4b, 1, 1]);
    const material = { type: 'legacy' as const, secret };
    const payload = sealAccountLinkPayload({ material, recipientPublicKey: recipient.publicKey, randomBytes: tweetnacl.randomBytes });
    expect(openAccountLinkPayload({ payload, recipientSecretKeyOrSeed: recipient.secretKey })).toEqual(material);
  });

  it('rejects unknown magic, versions, types and truncated typed payloads', () => {
    const recipient = tweetnacl.box.keyPair();
    const valid = new Uint8Array(70);
    valid.set([0x48, 0x41, 0x4c, 0x4b, 1, 1]);
    for (const index of [0, 4, 5, -1]) {
      const plaintext = index === -1 ? valid.slice(0, 69) : valid.slice();
      if (index !== -1) plaintext[index] = 255;
      const payload = sealBoxBundle({ plaintext, recipientPublicKey: recipient.publicKey, randomBytes: tweetnacl.randomBytes });
      expect(() => openAccountLinkPayload({ payload, recipientSecretKeyOrSeed: recipient.secretKey })).toThrow('Unsupported account link');
    }
  });

  it('fails closed for a different recipient and invalid producer key lengths', () => {
    const recipient = tweetnacl.box.keyPair();
    const material = { type: 'legacy' as const, secret: tweetnacl.randomBytes(32) };
    const payload = sealAccountLinkPayload({ material, recipientPublicKey: recipient.publicKey, randomBytes: tweetnacl.randomBytes });
    expect(openAccountLinkPayload({ payload, recipientSecretKeyOrSeed: tweetnacl.box.keyPair().secretKey })).toBeNull();
    expect(() => sealAccountLinkPayload({ material: { type: 'legacy', secret: new Uint8Array(31) }, recipientPublicKey: recipient.publicKey, randomBytes: tweetnacl.randomBytes })).toThrow('Invalid account link key length');
  });
});
