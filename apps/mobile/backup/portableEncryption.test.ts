import { sha256 } from "@noble/hashes/sha2.js";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  createPortableByteSource,
  decryptPortablePayload,
  encryptPortablePayloadToBytes,
  isEncryptedPortablePrefix,
  PORTABLE_ENCRYPTION_CHUNK_BYTES,
  validatePortablePassword,
} from "./portableEncryption";

const PASSWORD = "correct horse battery staple";

function deterministicRandom(): (length: number) => Uint8Array {
  let call = 0;
  return (length) => {
    const seed = call === 0 ? 0x10 : 0xa0;
    call += 1;
    return Uint8Array.from({ length }, (_, index) => (seed + index) & 0xff);
  };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("portable encryption v3", () => {
  it("uses the stable envelope and decrypts a golden vector", async () => {
    const plaintext = new TextEncoder().encode("Gymnasia portable backup fixture\n");
    const encrypted = await encryptPortablePayloadToBytes(plaintext, PASSWORD, deterministicRandom());

    expect(isEncryptedPortablePrefix(encrypted)).toBe(true);
    expect(hex(sha256(encrypted))).toBe("683e2a3280a44e2381f0786841cefe613826232ad98d38656439514af4cec9d0");
    expect(new TextDecoder().decode(encrypted)).not.toContain("Gymnasia portable backup fixture");
    await expect(decryptPortablePayload(createPortableByteSource(encrypted), PASSWORD))
      .resolves.toEqual(plaintext);

    const headerLength = new DataView(encrypted.buffer, encrypted.byteOffset + 8, 4).getUint32(0, false);
    const header = JSON.parse(new TextDecoder().decode(encrypted.subarray(12, 12 + headerLength)));
    expect(header).toEqual({
      app: "gymnasia",
      type: "encrypted-portable",
      schemaVersion: 3,
      kdf: {
        name: "scrypt",
        N: 32768,
        r: 8,
        p: 3,
        dkLen: 32,
        saltHex: "101112131415161718191a1b1c1d1e1f",
      },
      aead: {
        name: "xchacha20-poly1305",
        chunkBytes: 1048576,
        noncePrefixHex: "a0a1a2a3a4a5a6a7a8a9aaabacadaeaf",
      },
      plaintextBytes: plaintext.byteLength,
    });
    expect(JSON.stringify(header)).not.toContain("fixture");
  }, 20_000);

  it("round-trips independently authenticated chunks", async () => {
    const plaintext = Uint8Array.from(
      { length: PORTABLE_ENCRYPTION_CHUNK_BYTES + 37 },
      (_, index) => index % 251,
    );
    const encrypted = await encryptPortablePayloadToBytes(plaintext, PASSWORD, deterministicRandom());
    await expect(decryptPortablePayload(createPortableByteSource(encrypted), PASSWORD))
      .resolves.toEqual(plaintext);
  }, 20_000);

  it("returns the same safe error for a wrong password and ciphertext tampering", async () => {
    const plaintext = new TextEncoder().encode("private health data");
    const encrypted = await encryptPortablePayloadToBytes(plaintext, PASSWORD, deterministicRandom());
    const tampered = encrypted.slice();
    tampered[tampered.byteLength - 17] ^= 0x01;

    await expect(decryptPortablePayload(createPortableByteSource(encrypted), "wrong password"))
      .rejects.toThrow("La contraseña no es correcta o el archivo está dañado.");
    await expect(decryptPortablePayload(createPortableByteSource(tampered), PASSWORD))
      .rejects.toThrow("La contraseña no es correcta o el archivo está dañado.");
  }, 20_000);

  it("rejects truncation and trailing bytes before deriving a key", async () => {
    const encrypted = await encryptPortablePayloadToBytes(
      new TextEncoder().encode("private health data"),
      PASSWORD,
      deterministicRandom(),
    );
    await expect(decryptPortablePayload(createPortableByteSource(encrypted.subarray(0, -1)), PASSWORD))
      .rejects.toThrow("La contraseña no es correcta o el archivo está dañado.");
    const trailing = new Uint8Array(encrypted.byteLength + 1);
    trailing.set(encrypted);
    await expect(decryptPortablePayload(createPortableByteSource(trailing), PASSWORD))
      .rejects.toThrow("La contraseña no es correcta o el archivo está dañado.");
  }, 20_000);

  it("rejects structural mutations across the fixed prefix", async () => {
    const encrypted = await encryptPortablePayloadToBytes(
      new TextEncoder().encode("private health data"),
      PASSWORD,
      deterministicRandom(),
    );
    const mutations = fc.sample(
      fc.record({ index: fc.integer({ min: 0, max: 11 }), bit: fc.integer({ min: 0, max: 7 }) }),
      20,
    );
    for (const mutation of mutations) {
      const changed = encrypted.slice();
      changed[mutation.index] ^= 1 << mutation.bit;
      await expect(decryptPortablePayload(createPortableByteSource(changed), PASSWORD)).rejects.toThrow();
    }
  }, 20_000);

  it("validates password bounds by Unicode code point without trimming it", () => {
    expect(validatePortablePassword("12345678901")).toBe("Usa al menos 12 caracteres.");
    expect(validatePortablePassword("123456789012")).toBeNull();
    expect(validatePortablePassword(" 1234567890 ")).toBeNull();
    expect(validatePortablePassword("🔐".repeat(12))).toBeNull();
    expect(validatePortablePassword("a".repeat(129))).toBe("La contraseña es demasiado larga.");
    expect(validatePortablePassword("🔐".repeat(128))).toBeNull();
  });
});
