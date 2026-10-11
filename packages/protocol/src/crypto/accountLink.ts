import { openBoxBundle, sealBoxBundle } from './boxBundle.js';

export type AccountLinkEncryptionMaterial =
  | Readonly<{ type: 'legacy'; secret: Uint8Array }>
  | Readonly<{ type: 'dataKey'; publicKey: Uint8Array; machineKey: Uint8Array }>;

const MAGIC = new Uint8Array([0x48, 0x41, 0x4c, 0x4b]); // HALK
const HEADER_BYTES = MAGIC.length + 2;
const DATA_KEY_PAYLOAD_BYTES = HEADER_BYTES + 64;

function assertKeyLength(key: Uint8Array): void {
  if (key.length !== 32) throw new Error(`Invalid account link key length: ${key.length}`);
}

export function sealAccountLinkPayload(params: {
  material: AccountLinkEncryptionMaterial;
  recipientPublicKey: Uint8Array;
  randomBytes: (length: number) => Uint8Array;
}): Uint8Array {
  let plaintext: Uint8Array;
  if (params.material.type === 'legacy') {
    assertKeyLength(params.material.secret);
    plaintext = params.material.secret;
  } else {
    const { publicKey, machineKey } = params.material;
    assertKeyLength(publicKey);
    assertKeyLength(machineKey);
    plaintext = new Uint8Array(DATA_KEY_PAYLOAD_BYTES);
    plaintext.set(MAGIC);
    plaintext[MAGIC.length] = 1;
    plaintext[MAGIC.length + 1] = 1;
    plaintext.set(publicKey, HEADER_BYTES);
    plaintext.set(machineKey, HEADER_BYTES + 32);
  }
  return sealBoxBundle({ ...params, plaintext });
}

export function openAccountLinkPayload(params: {
  payload: Uint8Array;
  recipientSecretKeyOrSeed: Uint8Array;
}): AccountLinkEncryptionMaterial | null {
  const plaintext = openBoxBundle({ bundle: params.payload, recipientSecretKeyOrSeed: params.recipientSecretKeyOrSeed });
  if (!plaintext) return null;
  // 任意 32 字节恢复密钥均保留 legacy 语义，包括与魔数相同的前缀。
  if (plaintext.length === 32) return { type: 'legacy', secret: plaintext };
  if (
    plaintext.length !== DATA_KEY_PAYLOAD_BYTES
    || !MAGIC.every((byte, index) => plaintext[index] === byte)
    || plaintext[MAGIC.length] !== 1
    || plaintext[MAGIC.length + 1] !== 1
  ) {
    throw new Error('Unsupported account link credential payload');
  }
  const publicKey = plaintext.slice(HEADER_BYTES, HEADER_BYTES + 32);
  const machineKey = plaintext.slice(HEADER_BYTES + 32);
  return { type: 'dataKey', publicKey, machineKey };
}
