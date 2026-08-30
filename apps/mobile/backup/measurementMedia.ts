import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Image, Platform } from "react-native";

import { MAX_BACKUP_PHOTO_BYTES, stripJpegMetadata } from "./backupFormat";

export const MEASUREMENT_MEDIA_DIRECTORY_NAME = "gymnasia_measurement_media_v1";
export const MAX_MEASUREMENT_PHOTO_EDGE = 2048;
export const MEASUREMENT_PHOTO_QUALITY = 0.8;

export type PortableMeasurementPhoto = {
  uri: string;
  bytes: Uint8Array;
  sha256: string;
  owned: boolean;
};

function measurementMediaDirectory(): Directory {
  return new Directory(Paths.document, MEASUREMENT_MEDIA_DIRECTORY_NAME);
}

function ensureMeasurementMediaDirectory(): Directory {
  const directory = measurementMediaDirectory();
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function measurementPhotoSha256(bytes: Uint8Array): Promise<string> {
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, digestInput.buffer);
  return bytesToHex(new Uint8Array(digest));
}

function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

async function readUriBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("No se pudo leer la foto seleccionada.");
    return new Uint8Array(await response.arrayBuffer());
  }
  return new File(uri).bytes();
}

async function renderNormalizedPhoto(uri: string): Promise<Uint8Array> {
  const { width, height } = await getImageDimensions(uri);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("La foto no tiene dimensiones válidas.");
  }
  const context = ImageManipulator.manipulate(uri);
  const longestEdge = Math.max(width, height);
  if (longestEdge > MAX_MEASUREMENT_PHOTO_EDGE) {
    if (width >= height) {
      context.resize({ width: MAX_MEASUREMENT_PHOTO_EDGE, height: null });
    } else {
      context.resize({ width: null, height: MAX_MEASUREMENT_PHOTO_EDGE });
    }
  }
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    compress: MEASUREMENT_PHOTO_QUALITY,
    format: SaveFormat.JPEG,
  });
  try {
    return stripJpegMetadata(await readUriBytes(result.uri));
  } finally {
    if (Platform.OS !== "web") {
      try {
        const temporary = new File(result.uri);
        if (temporary.exists) temporary.delete();
      } catch {
        // La caché de ImageManipulator puede limpiarse después sin afectar al recurso persistente.
      }
    }
  }
}

function assertPortablePhotoSize(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) throw new Error("La foto seleccionada está vacía.");
  if (bytes.byteLength > MAX_BACKUP_PHOTO_BYTES) {
    throw new Error("La foto sigue superando 5 MiB después de optimizarla.");
  }
}

export function isOwnedMeasurementPhotoUri(uri: string | null | undefined): boolean {
  if (!uri || Platform.OS === "web") return false;
  try {
    const directoryUri = measurementMediaDirectory().uri;
    const prefix = directoryUri.endsWith("/") ? directoryUri : `${directoryUri}/`;
    return uri.startsWith(prefix);
  } catch {
    return false;
  }
}

export async function normalizeAndStoreMeasurementPhoto(
  sourceUri: string,
): Promise<PortableMeasurementPhoto> {
  if (!sourceUri.trim()) throw new Error("La foto no tiene una dirección válida.");

  if (isOwnedMeasurementPhotoUri(sourceUri)) {
    const bytes = await readUriBytes(sourceUri);
    const validatedBytes = stripJpegMetadata(bytes);
    if (validatedBytes.byteLength !== bytes.byteLength) {
      throw new Error("La foto guardada contiene metadatos inesperados.");
    }
    assertPortablePhotoSize(validatedBytes);
    return {
      uri: sourceUri,
      bytes: validatedBytes,
      sha256: await measurementPhotoSha256(validatedBytes),
      owned: true,
    };
  }

  const bytes = await renderNormalizedPhoto(sourceUri);
  assertPortablePhotoSize(bytes);
  const sha256 = await measurementPhotoSha256(bytes);
  if (Platform.OS === "web") {
    return { uri: sourceUri, bytes, sha256, owned: false };
  }

  const destination = new File(ensureMeasurementMediaDirectory(), `${sha256}.jpg`);
  if (!destination.exists) {
    destination.create({ intermediates: true });
    destination.write(bytes);
  }
  return { uri: destination.uri, bytes, sha256, owned: true };
}

export async function readMeasurementPhotoForBackup(
  sourceUri: string,
): Promise<PortableMeasurementPhoto> {
  return normalizeAndStoreMeasurementPhoto(sourceUri);
}

export async function storeImportedMeasurementPhoto(
  sha256: string,
  bytes: Uint8Array,
): Promise<string | null> {
  assertPortablePhotoSize(bytes);
  const actualSha256 = await measurementPhotoSha256(bytes);
  if (actualSha256 !== sha256) throw new Error("El checksum de la foto importada no coincide.");
  const sanitizedBytes = stripJpegMetadata(bytes);
  assertPortablePhotoSize(sanitizedBytes);
  if (Platform.OS === "web") return null;

  const sanitizedSha256 = await measurementPhotoSha256(sanitizedBytes);
  const destination = new File(ensureMeasurementMediaDirectory(), `${sanitizedSha256}.jpg`);
  if (!destination.exists) {
    destination.create({ intermediates: true });
    destination.write(sanitizedBytes);
  }
  return destination.uri;
}

export function deleteOwnedMeasurementPhotoIfUnreferenced(
  uri: string | null | undefined,
  referencedUris: Iterable<string | null | undefined>,
): void {
  if (!isOwnedMeasurementPhotoUri(uri)) return;
  for (const reference of referencedUris) {
    if (reference === uri) return;
  }
  try {
    const file = new File(uri!);
    if (file.exists) file.delete();
  } catch {
    // La limpieza de huérfanos del siguiente arranque volverá a intentarlo.
  }
}

export function sweepOrphanedMeasurementPhotos(
  referencedUris: Iterable<string | null | undefined>,
): void {
  if (Platform.OS === "web") return;
  const referenced = new Set(
    [...referencedUris].filter((uri): uri is string => isOwnedMeasurementPhotoUri(uri)),
  );
  try {
    const directory = measurementMediaDirectory();
    if (!directory.exists) return;
    for (const entry of directory.list()) {
      if (entry instanceof File && !referenced.has(entry.uri)) entry.delete();
    }
  } catch {
    // No se bloquea la app por una limpieza oportunista.
  }
}

export function clearMeasurementMedia(): void {
  if (Platform.OS === "web") return;
  const directory = measurementMediaDirectory();
  if (directory.exists) directory.delete();
}

export function isMeasurementMediaEmpty(): boolean {
  if (Platform.OS === "web") return true;
  const directory = measurementMediaDirectory();
  return !directory.exists || directory.list().length === 0;
}
