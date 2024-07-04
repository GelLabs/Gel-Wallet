export * from "./base58";
export * from "./base58Check";
export * from "./bech32";
export * from "./hex";
export * from "./base64";
export * from "./hash";
export * from "./hmac";
export * from "./utf8";
export * from "./bignumber-plus";
export * from "./precondtion";
export * as rlp from "../abi/rlp";
export * from "./helper";
export * as md5 from "./md5";
export * as aes from "./aes";
export * as rsa from "./rsa";

export * from "@scure/base";
export * from "@noble/hashes/sha256";
export * from "@noble/hashes/hmac";
export * from "@noble/hashes/ripemd160";
export * from "@noble/hashes/sha512";
export * from "@noble/hashes/sha3";
export * from "@noble/hashes/blake2b";
export * from "@noble/hashes/blake2s";
export * from "@noble/hashes/pbkdf2";
export * from "@noble/hashes/scrypt";
export * from "@noble/hashes/blake3";

import * as utils from "@noble/hashes/utils";

export function reverseBuffer(buffer: Buffer): Buffer {
  if (buffer.length < 1) return buffer;
  let j = buffer.length - 1;
  let tmp = 0;
  for (let i = 0; i < buffer.length / 2; i++) {
    tmp = buffer[i];
    buffer[i] = buffer[j];
    buffer[j] = tmp;
    j--;
  }
  return buffer;
}

export function concatBytes(b1: Uint8Array | Buffer, b2: Uint8Array | Buffer): Uint8Array {
  return utils.concatBytes(Uint8Array.from(b1), Uint8Array.from(b2));
}

export function randomBytes(size: number): Buffer {
  const MAX_BYTES = 65536;
  const MAX_UINT32 = 4294967295;

  const _global = typeof globalThis !== "undefined" ? globalThis : window || global;
  const crypto = _global.crypto;

  if (!crypto || !crypto.getRandomValues) {
    throw new Error("Secure random number generation is not supported by this browser.");
  }

  if (size > MAX_UINT32) throw new RangeError("requested too many random bytes");

  const bytes = Buffer.allocUnsafe(size);

  if (size > 0) {
    // getRandomValues fails on IE if size == 0
    if (size > MAX_BYTES) {
      // this is the max bytes crypto.getRandomValues
      // can do at once see https://developer.mozilla.org/en-US/docs/Web/API/window.crypto.getRandomValues
      for (let generated = 0; generated < size; generated += MAX_BYTES) {
        // buffer.slice automatically checks if the end is past the end of
        // the buffer so we don't have to here
        crypto.getRandomValues(bytes.slice(generated, generated + MAX_BYTES));
      }
    } else {
      crypto.getRandomValues(bytes);
    }
  }

  return bytes;
}
