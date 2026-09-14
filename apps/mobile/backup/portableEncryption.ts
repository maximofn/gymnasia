import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";

export const PORTABLE_ENCRYPTION_SCHEMA_VERSION = 3 as const;
export const PORTABLE_ENCRYPTION_MIME = "application/vnd.gymnasia.encrypted";
export const PORTABLE_ENCRYPTION_CHUNK_BYTES = 1024 * 1024;
export const PORTABLE_ENCRYPTION_TAG_BYTES = 16;
export const PORTABLE_ENCRYPTION_MAX_PLAINTEXT_BYTES = 220 * 1024 * 1024;
export const PORTABLE_ENCRYPTION_MAX_HEADER_BYTES = 4 * 1024;
export const PORTABLE_PASSWORD_MIN_CODE_POINTS = 12;
export const PORTABLE_PASSWORD_MAX_CODE_POINTS = 128;
export const PORTABLE_PASSWORD_MAX_UTF8_BYTES = 512;

const MAGIC = new Uint8Array([0x47, 0x59, 0x4d, 0x45, 0x4e, 0x43, 0x30, 0x33]); // GYMENC03
const PREFIX_BYTES = MAGIC.byteLength + 4;
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 3;
const SCRYPT_KEY_BYTES = 32;
const SCRYPT_MAX_MEMORY_BYTES = 64 * 1024 * 1024;
const SALT_BYTES = 16;
const NONCE_PREFIX_BYTES = 16;

export type PortableEncryptionHeaderV3 = {
  app: "gymnasia";
  type: "encrypted-portable";
  schemaVersion: typeof PORTABLE_ENCRYPTION_SCHEMA_VERSION;
  kdf: {
    name: "scrypt";
    N: typeof SCRYPT_N;
    r: typeof SCRYPT_R;
    p: typeof SCRYPT_P;
    dkLen: typeof SCRYPT_KEY_BYTES;
    saltHex: string;
  };
  aead: {
    name: "xchacha20-poly1305";
    chunkBytes: typeof PORTABLE_ENCRYPTION_CHUNK_BYTES;
    noncePrefixHex: string;
  };
  plaintextBytes: number;
};

export type PortableByteSource = {
  size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
};

export type PortableRandomBytes = (length: number) => Uint8Array | Promise<Uint8Array>;

export class PortableEncryptionError extends Error {
  readonly code:
    | "invalid-format"
    | "unsupported-version"
    | "invalid-password-or-corrupt"
    | "too-large";

  constructor(
    code: PortableEncryptionError["code"],
    message: string,
  ) {
    super(message);
    this.name = "PortableEncryptionError";
    this.code = code;
  }
}

type ParsedEnvelope = {
  header: PortableEncryptionHeaderV3;
  authenticatedHeader: Uint8Array;
  ciphertextOffset: number;
  chunkCount: number;
};

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function bytesToHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function hexToBytes(value: string, expectedBytes: number): Uint8Array {
  if (!new RegExp(`^[a-f0-9]{${expectedBytes * 2}}$`).test(value)) {
    throw new PortableEncryptionError("invalid-format", "La cabecera cifrada no es válida.");
  }
  const output = new Uint8Array(expectedBytes);
  for (let index = 0; index < expectedBytes; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

function encodeUint32(value: number): Uint8Array {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value, false);
  return output;
}

function encodeUint64(value: number): Uint8Array {
  const output = new Uint8Array(8);
  const view = new DataView(output.buffer);
  view.setUint32(0, Math.floor(value / 2 ** 32), false);
  view.setUint32(4, value >>> 0, false);
  return output;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function canonicalHeader(header: PortableEncryptionHeaderV3): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(header));
}

function makeNonce(prefix: Uint8Array, chunkIndex: number): Uint8Array {
  return concatBytes(prefix, encodeUint64(chunkIndex));
}

function makeAad(authenticatedHeader: Uint8Array, chunkIndex: number): Uint8Array {
  return concatBytes(authenticatedHeader, encodeUint64(chunkIndex));
}

function chunkCountFor(plaintextBytes: number): number {
  return Math.ceil(plaintextBytes / PORTABLE_ENCRYPTION_CHUNK_BYTES);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length
    && expected.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

export function validatePortablePassword(password: string): string | null {
  const codePoints = [...password].length;
  const utf8Bytes = new TextEncoder().encode(password).byteLength;
  if (codePoints < PORTABLE_PASSWORD_MIN_CODE_POINTS) {
    return `Usa al menos ${PORTABLE_PASSWORD_MIN_CODE_POINTS} caracteres.`;
  }
  if (codePoints > PORTABLE_PASSWORD_MAX_CODE_POINTS || utf8Bytes > PORTABLE_PASSWORD_MAX_UTF8_BYTES) {
    return "La contraseña es demasiado larga.";
  }
  return null;
}

export function createPortableByteSource(bytes: Uint8Array): PortableByteSource {
  return {
    size: bytes.byteLength,
    async read(offset, length) {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0) {
        throw new PortableEncryptionError("invalid-format", "El archivo cifrado no es válido.");
      }
      return bytes.slice(offset, offset + length);
    },
  };
}

export function isEncryptedPortablePrefix(bytes: Uint8Array): boolean {
  return bytes.byteLength >= MAGIC.byteLength && equalBytes(bytes.subarray(0, MAGIC.byteLength), MAGIC);
}

export function encryptedPortableMaximumFileBytes(): number {
  const chunks = chunkCountFor(PORTABLE_ENCRYPTION_MAX_PLAINTEXT_BYTES);
  return PREFIX_BYTES
    + PORTABLE_ENCRYPTION_MAX_HEADER_BYTES
    + PORTABLE_ENCRYPTION_MAX_PLAINTEXT_BYTES
    + chunks * PORTABLE_ENCRYPTION_TAG_BYTES;
}

function assertHeader(raw: unknown): PortableEncryptionHeaderV3 {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PortableEncryptionError("invalid-format", "La cabecera cifrada no es válida.");
  }
  const candidate = raw as Record<string, unknown>;
  if (candidate.schemaVersion !== PORTABLE_ENCRYPTION_SCHEMA_VERSION) {
    throw new PortableEncryptionError(
      "unsupported-version",
      "Esta copia cifrada requiere una versión más reciente de Gymnasia.",
    );
  }
  const kdf = candidate.kdf as Record<string, unknown> | null;
  const aead = candidate.aead as Record<string, unknown> | null;
  if (
    !hasExactKeys(candidate, ["app", "type", "schemaVersion", "kdf", "aead", "plaintextBytes"])
    || candidate.app !== "gymnasia"
    || candidate.type !== "encrypted-portable"
    || !kdf
    || Array.isArray(kdf)
    || !hasExactKeys(kdf, ["name", "N", "r", "p", "dkLen", "saltHex"])
    || kdf.name !== "scrypt"
    || kdf.N !== SCRYPT_N
    || kdf.r !== SCRYPT_R
    || kdf.p !== SCRYPT_P
    || kdf.dkLen !== SCRYPT_KEY_BYTES
    || typeof kdf.saltHex !== "string"
    || !aead
    || Array.isArray(aead)
    || !hasExactKeys(aead, ["name", "chunkBytes", "noncePrefixHex"])
    || aead.name !== "xchacha20-poly1305"
    || aead.chunkBytes !== PORTABLE_ENCRYPTION_CHUNK_BYTES
    || typeof aead.noncePrefixHex !== "string"
    || !Number.isSafeInteger(candidate.plaintextBytes)
    || (candidate.plaintextBytes as number) <= 0
    || (candidate.plaintextBytes as number) > PORTABLE_ENCRYPTION_MAX_PLAINTEXT_BYTES
  ) {
    throw new PortableEncryptionError("invalid-format", "La cabecera cifrada no es válida.");
  }
  hexToBytes(kdf.saltHex, SALT_BYTES);
  hexToBytes(aead.noncePrefixHex, NONCE_PREFIX_BYTES);
  return candidate as PortableEncryptionHeaderV3;
}

async function parseEnvelope(source: PortableByteSource): Promise<ParsedEnvelope> {
  if (source.size < PREFIX_BYTES + 1 + PORTABLE_ENCRYPTION_TAG_BYTES) {
    throw new PortableEncryptionError("invalid-format", "El archivo cifrado está incompleto.");
  }
  const prefix = await source.read(0, PREFIX_BYTES);
  if (prefix.byteLength !== PREFIX_BYTES || !isEncryptedPortablePrefix(prefix)) {
    throw new PortableEncryptionError("invalid-format", "El archivo no es una copia cifrada de Gymnasia.");
  }
  const headerBytesLength = new DataView(prefix.buffer, prefix.byteOffset + MAGIC.byteLength, 4)
    .getUint32(0, false);
  if (headerBytesLength <= 0 || headerBytesLength > PORTABLE_ENCRYPTION_MAX_HEADER_BYTES) {
    throw new PortableEncryptionError("invalid-format", "La cabecera cifrada no es válida.");
  }
  const headerBytes = await source.read(PREFIX_BYTES, headerBytesLength);
  if (headerBytes.byteLength !== headerBytesLength) {
    throw new PortableEncryptionError("invalid-format", "El archivo cifrado está incompleto.");
  }
  let rawHeader: unknown;
  try {
    rawHeader = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(headerBytes));
  } catch {
    throw new PortableEncryptionError("invalid-format", "La cabecera cifrada no es válida.");
  }
  const header = assertHeader(rawHeader);
  if (!equalBytes(headerBytes, canonicalHeader(header))) {
    throw new PortableEncryptionError("invalid-format", "La cabecera cifrada no es canónica.");
  }
  const chunkCount = chunkCountFor(header.plaintextBytes);
  const ciphertextOffset = PREFIX_BYTES + headerBytesLength;
  const expectedSize = ciphertextOffset
    + header.plaintextBytes
    + chunkCount * PORTABLE_ENCRYPTION_TAG_BYTES;
  if (source.size !== expectedSize) {
    throw new PortableEncryptionError("invalid-format", "El archivo cifrado está truncado o tiene datos sobrantes.");
  }
  return {
    header,
    authenticatedHeader: concatBytes(prefix, headerBytes),
    ciphertextOffset,
    chunkCount,
  };
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const passwordBytes = new TextEncoder().encode(password);
  if (passwordBytes.byteLength === 0 || passwordBytes.byteLength > PORTABLE_PASSWORD_MAX_UTF8_BYTES) {
    passwordBytes.fill(0);
    throw new PortableEncryptionError(
      "invalid-password-or-corrupt",
      "La contraseña no es correcta o el archivo está dañado.",
    );
  }
  try {
    return await scryptAsync(passwordBytes, salt, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      dkLen: SCRYPT_KEY_BYTES,
      maxmem: SCRYPT_MAX_MEMORY_BYTES,
      asyncTick: 10,
    });
  } finally {
    passwordBytes.fill(0);
  }
}

export async function* encryptPortablePayload(
  plaintext: Uint8Array,
  password: string,
  randomBytes: PortableRandomBytes,
): AsyncGenerator<Uint8Array> {
  const passwordError = validatePortablePassword(password);
  if (passwordError) throw new Error(passwordError);
  if (plaintext.byteLength <= 0 || plaintext.byteLength > PORTABLE_ENCRYPTION_MAX_PLAINTEXT_BYTES) {
    throw new PortableEncryptionError("too-large", "El contenido supera el límite cifrable de 220 MiB.");
  }
  const salt = await randomBytes(SALT_BYTES);
  const noncePrefix = await randomBytes(NONCE_PREFIX_BYTES);
  if (salt.byteLength !== SALT_BYTES || noncePrefix.byteLength !== NONCE_PREFIX_BYTES) {
    throw new Error("La fuente aleatoria no devolvió suficientes bytes.");
  }
  const header: PortableEncryptionHeaderV3 = {
    app: "gymnasia",
    type: "encrypted-portable",
    schemaVersion: PORTABLE_ENCRYPTION_SCHEMA_VERSION,
    kdf: {
      name: "scrypt",
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      dkLen: SCRYPT_KEY_BYTES,
      saltHex: bytesToHex(salt),
    },
    aead: {
      name: "xchacha20-poly1305",
      chunkBytes: PORTABLE_ENCRYPTION_CHUNK_BYTES,
      noncePrefixHex: bytesToHex(noncePrefix),
    },
    plaintextBytes: plaintext.byteLength,
  };
  const headerBytes = canonicalHeader(header);
  if (headerBytes.byteLength > PORTABLE_ENCRYPTION_MAX_HEADER_BYTES) {
    throw new Error("La cabecera cifrada supera el límite interno.");
  }
  const authenticatedHeader = concatBytes(MAGIC, encodeUint32(headerBytes.byteLength), headerBytes);
  const key = await deriveKey(password, salt);
  try {
    yield authenticatedHeader;
    for (let chunkIndex = 0; chunkIndex < chunkCountFor(plaintext.byteLength); chunkIndex += 1) {
      const offset = chunkIndex * PORTABLE_ENCRYPTION_CHUNK_BYTES;
      const chunk = plaintext.subarray(
        offset,
        Math.min(offset + PORTABLE_ENCRYPTION_CHUNK_BYTES, plaintext.byteLength),
      );
      yield xchacha20poly1305(
        key,
        makeNonce(noncePrefix, chunkIndex),
        makeAad(authenticatedHeader, chunkIndex),
      ).encrypt(chunk);
    }
  } finally {
    key.fill(0);
    salt.fill(0);
    noncePrefix.fill(0);
  }
}

export async function encryptPortablePayloadToBytes(
  plaintext: Uint8Array,
  password: string,
  randomBytes: PortableRandomBytes,
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for await (const part of encryptPortablePayload(plaintext, password, randomBytes)) parts.push(part);
  return concatBytes(...parts);
}

export async function decryptPortablePayload(
  source: PortableByteSource,
  password: string,
): Promise<Uint8Array> {
  let envelope: ParsedEnvelope;
  try {
    envelope = await parseEnvelope(source);
  } catch (error) {
    if (error instanceof PortableEncryptionError && error.code === "unsupported-version") throw error;
    throw new PortableEncryptionError(
      "invalid-password-or-corrupt",
      "La contraseña no es correcta o el archivo está dañado.",
    );
  }
  const salt = hexToBytes(envelope.header.kdf.saltHex, SALT_BYTES);
  const noncePrefix = hexToBytes(envelope.header.aead.noncePrefixHex, NONCE_PREFIX_BYTES);
  const plaintext = new Uint8Array(envelope.header.plaintextBytes);
  let key: Uint8Array | null = null;
  try {
    key = await deriveKey(password, salt);
    let ciphertextOffset = envelope.ciphertextOffset;
    for (let chunkIndex = 0; chunkIndex < envelope.chunkCount; chunkIndex += 1) {
      const plaintextOffset = chunkIndex * PORTABLE_ENCRYPTION_CHUNK_BYTES;
      const plaintextLength = Math.min(
        PORTABLE_ENCRYPTION_CHUNK_BYTES,
        envelope.header.plaintextBytes - plaintextOffset,
      );
      const ciphertextLength = plaintextLength + PORTABLE_ENCRYPTION_TAG_BYTES;
      const ciphertext = await source.read(ciphertextOffset, ciphertextLength);
      if (ciphertext.byteLength !== ciphertextLength) {
        throw new Error("truncated");
      }
      const chunk = xchacha20poly1305(
        key,
        makeNonce(noncePrefix, chunkIndex),
        makeAad(envelope.authenticatedHeader, chunkIndex),
      ).decrypt(ciphertext);
      plaintext.set(chunk, plaintextOffset);
      chunk.fill(0);
      ciphertextOffset += ciphertextLength;
    }
    return plaintext;
  } catch (error) {
    plaintext.fill(0);
    if (error instanceof PortableEncryptionError && error.code === "unsupported-version") throw error;
    throw new PortableEncryptionError(
      "invalid-password-or-corrupt",
      "La contraseña no es correcta o el archivo está dañado.",
    );
  } finally {
    key?.fill(0);
    salt.fill(0);
    noncePrefix.fill(0);
  }
}
