import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";

export const BACKUP_APP_ID = "gymnasia" as const;
export const BACKUP_SCHEMA_VERSION = 2 as const;
export const BACKUP_PACKAGE_MIME = "application/zip";
export const BACKUP_PACKAGE_EXTENSION = ".gymnasia";
export const BACKUP_MANIFEST_ENTRY = "manifest.json";

export const MAX_BACKUP_PHOTOS = 500;
export const MAX_BACKUP_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_BACKUP_MEDIA_BYTES = 200 * 1024 * 1024;
export const MAX_BACKUP_PACKAGE_BYTES = 220 * 1024 * 1024;
export const MAX_BACKUP_MANIFEST_BYTES = 2 * 1024 * 1024;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MEDIA_ENTRY_PATTERN = /^media\/([a-f0-9]{64})\.jpg$/;
const FIXED_ZIP_DATE = new Date("1980-01-01T00:00:00.000Z");

export type Sha256Digest = `sha256:${string}`;

export type BackupDataShape = {
  store: {
    measurements?: Array<{
      id?: unknown;
      measured_on?: unknown;
      measured_at?: unknown;
      photo_uri?: unknown;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type BackupPayloadV1<TData extends BackupDataShape = BackupDataShape> = {
  app: typeof BACKUP_APP_ID;
  type: "backup";
  schemaVersion: 1;
  appVersion: string;
  createdAt: string;
  data: TData;
};

export type BackupMediaAsset = {
  id: string;
  entry: string;
  mimeType: "image/jpeg";
  byteSize: number;
  sha256: Sha256Digest;
};

export type BackupMediaLink = {
  measurementId: string;
  assetId: string;
};

export type BackupMediaOmissionReason =
  | "missing"
  | "unreadable"
  | "per-file-limit"
  | "photo-count-limit"
  | "total-size-limit"
  | "invalid-media";

export type BackupMediaOmission = {
  measurementId: string;
  reason: BackupMediaOmissionReason;
};

export type BackupManifestV2<TData extends BackupDataShape = BackupDataShape> = {
  app: typeof BACKUP_APP_ID;
  type: "backup";
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  appVersion: string;
  createdAt: string;
  data: TData;
  media: {
    assets: BackupMediaAsset[];
    links: BackupMediaLink[];
    omissions: BackupMediaOmission[];
  };
};

export type BackupMediaCandidate = {
  measurementId: string;
  measuredAt: string;
  bytes: Uint8Array | null;
  sha256: string | null;
  failureReason?: Extract<BackupMediaOmissionReason, "missing" | "unreadable" | "invalid-media">;
};

export type SelectedBackupMedia = {
  assets: BackupMediaAsset[];
  links: BackupMediaLink[];
  omissions: BackupMediaOmission[];
  filesByEntry: Map<string, Uint8Array>;
};

export type ParsedBackupPackage<TData extends BackupDataShape = BackupDataShape> = {
  manifest: BackupManifestV2<TData>;
  filesByEntry: Map<string, Uint8Array>;
};

export function parseBackupPayloadV1<TData extends BackupDataShape = BackupDataShape>(
  raw: unknown,
): BackupPayloadV1<TData> {
  const candidate = asRecord(raw, "El archivo no es un backup válido.");
  if (candidate.app !== BACKUP_APP_ID || candidate.type !== "backup") {
    throw new Error("El archivo no es una copia de seguridad de Gymnasia.");
  }
  if (candidate.schemaVersion !== 1) {
    if (typeof candidate.schemaVersion === "number" && candidate.schemaVersion > BACKUP_SCHEMA_VERSION) {
      throw new Error(
        "Este backup se creó con una versión más reciente de la app. Actualiza Gymnasia para restaurarlo.",
      );
    }
    throw new Error("La versión del backup JSON no es compatible.");
  }
  const data = asRecord(candidate.data, "El backup no contiene datos restaurables.");
  asRecord(data.store, "El backup no contiene datos restaurables.");
  return {
    app: BACKUP_APP_ID,
    type: "backup",
    schemaVersion: 1,
    appVersion: typeof candidate.appVersion === "string" ? candidate.appVersion : "0.0.0",
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
    data: data as TData,
  };
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
}

function assertSafeInteger(value: unknown, maximum: number, message: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new Error(message);
  }
  return value as number;
}

function assetIdFromDigest(digest: string): string | null {
  const normalized = digest.startsWith("sha256:") ? digest.slice(7) : digest;
  return SHA256_PATTERN.test(normalized) ? normalized : null;
}

export function backupMediaEntryForDigest(digest: string): string {
  const id = assetIdFromDigest(digest);
  if (!id) throw new Error("El checksum de una foto no es SHA-256 válido.");
  return `media/${id}.jpg`;
}

export function withoutPortablePhotoUris<TData extends BackupDataShape>(data: TData): TData {
  const measurements = Array.isArray(data.store.measurements)
    ? data.store.measurements.map((measurement) => ({ ...measurement, photo_uri: null }))
    : [];
  return {
    ...data,
    store: {
      ...data.store,
      measurements,
    },
  };
}

export function selectBackupMedia(candidates: BackupMediaCandidate[]): SelectedBackupMedia {
  const assetsById = new Map<string, BackupMediaAsset>();
  const filesByEntry = new Map<string, Uint8Array>();
  const links: BackupMediaLink[] = [];
  const omissions: BackupMediaOmission[] = [];
  let uniqueBytes = 0;

  const sorted = [...candidates].sort((left, right) => right.measuredAt.localeCompare(left.measuredAt));
  for (const candidate of sorted) {
    if (links.length >= MAX_BACKUP_PHOTOS) {
      omissions.push({ measurementId: candidate.measurementId, reason: "photo-count-limit" });
      continue;
    }
    if (!candidate.bytes || !candidate.sha256) {
      omissions.push({
        measurementId: candidate.measurementId,
        reason: candidate.failureReason ?? "unreadable",
      });
      continue;
    }
    if (candidate.bytes.byteLength > MAX_BACKUP_PHOTO_BYTES) {
      omissions.push({ measurementId: candidate.measurementId, reason: "per-file-limit" });
      continue;
    }
    const id = assetIdFromDigest(candidate.sha256);
    if (!id) {
      omissions.push({ measurementId: candidate.measurementId, reason: "invalid-media" });
      continue;
    }

    const existing = assetsById.get(id);
    if (!existing && uniqueBytes + candidate.bytes.byteLength > MAX_BACKUP_MEDIA_BYTES) {
      omissions.push({ measurementId: candidate.measurementId, reason: "total-size-limit" });
      continue;
    }

    if (!existing) {
      const entry = backupMediaEntryForDigest(id);
      const asset: BackupMediaAsset = {
        id,
        entry,
        mimeType: "image/jpeg",
        byteSize: candidate.bytes.byteLength,
        sha256: `sha256:${id}`,
      };
      assetsById.set(id, asset);
      filesByEntry.set(entry, candidate.bytes);
      uniqueBytes += candidate.bytes.byteLength;
    }
    links.push({ measurementId: candidate.measurementId, assetId: id });
  }

  return { assets: [...assetsById.values()], links, omissions, filesByEntry };
}

export function createBackupPackage<TData extends BackupDataShape>(
  manifest: BackupManifestV2<TData>,
  filesByEntry: Map<string, Uint8Array>,
): Uint8Array {
  parseBackupManifest(manifest);
  const manifestBytes = strToU8(JSON.stringify(manifest));
  if (manifestBytes.byteLength > MAX_BACKUP_MANIFEST_BYTES) {
    throw new Error("El manifiesto de la copia supera el tamaño máximo permitido.");
  }
  const entries: Zippable = {
    [BACKUP_MANIFEST_ENTRY]: [
      manifestBytes,
      { level: 6, mtime: FIXED_ZIP_DATE },
    ],
  };
  for (const asset of manifest.media.assets) {
    const bytes = filesByEntry.get(asset.entry);
    if (!bytes) throw new Error(`Faltan los bytes declarados para ${asset.entry}.`);
    if (bytes.byteLength !== asset.byteSize) {
      throw new Error(`El tamaño declarado para ${asset.entry} no coincide.`);
    }
    entries[asset.entry] = [bytes, { level: 0, mtime: FIXED_ZIP_DATE }];
  }
  const output = zipSync(entries, { level: 0, mtime: FIXED_ZIP_DATE });
  if (output.byteLength > MAX_BACKUP_PACKAGE_BYTES) {
    throw new Error("La copia supera el tamaño máximo permitido.");
  }
  return output;
}

export function parseBackupManifest<TData extends BackupDataShape = BackupDataShape>(
  raw: unknown,
): BackupManifestV2<TData> {
  const candidate = asRecord(raw, "El paquete no contiene un manifiesto válido.");
  if (candidate.app !== BACKUP_APP_ID || candidate.type !== "backup") {
    throw new Error("El archivo no es una copia de seguridad de Gymnasia.");
  }
  if (candidate.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    if (typeof candidate.schemaVersion === "number" && candidate.schemaVersion > BACKUP_SCHEMA_VERSION) {
      throw new Error("Esta copia se creó con una versión más reciente de Gymnasia.");
    }
    throw new Error("La versión del paquete no es compatible.");
  }
  const data = asRecord(candidate.data, "La copia no contiene datos restaurables.");
  const store = asRecord(data.store, "La copia no contiene el almacén principal.");
  if (!Array.isArray(store.measurements)) {
    throw new Error("La copia no contiene mediciones restaurables.");
  }
  const backupMeasurementIds = new Set<string>();
  for (const rawMeasurement of store.measurements) {
    const measurement = asRecord(rawMeasurement, "Una medición de la copia no es válida.");
    const id = asNonEmptyString(measurement.id, "Una medición no tiene identificador.");
    if (backupMeasurementIds.has(id)) {
      throw new Error("La copia contiene identificadores de medición duplicados.");
    }
    backupMeasurementIds.add(id);
  }
  const media = asRecord(candidate.media, "La copia no contiene un manifiesto de fotos.");
  if (!Array.isArray(media.assets) || !Array.isArray(media.links) || !Array.isArray(media.omissions)) {
    throw new Error("El manifiesto de fotos está incompleto.");
  }
  if (media.links.length > MAX_BACKUP_PHOTOS || media.assets.length > MAX_BACKUP_PHOTOS) {
    throw new Error("La copia declara más fotos de las permitidas.");
  }

  const assets: BackupMediaAsset[] = [];
  const assetIds = new Set<string>();
  let totalBytes = 0;
  for (const rawAsset of media.assets) {
    const asset = asRecord(rawAsset, "Una foto declarada no es válida.");
    const id = asNonEmptyString(asset.id, "Una foto no tiene identificador.");
    const sha256 = asNonEmptyString(asset.sha256, "Una foto no tiene checksum.");
    const digestId = assetIdFromDigest(sha256);
    if (!digestId || digestId !== id || assetIds.has(id)) {
      throw new Error("El identificador de una foto no coincide con su checksum.");
    }
    const entry = asNonEmptyString(asset.entry, "Una foto no indica su ruta interna.");
    const entryMatch = entry.match(MEDIA_ENTRY_PATTERN);
    if (!entryMatch || entryMatch[1] !== id) {
      throw new Error("Una foto declara una ruta interna insegura.");
    }
    if (asset.mimeType !== "image/jpeg") {
      throw new Error("La copia contiene un tipo de imagen no compatible.");
    }
    const byteSize = assertSafeInteger(
      asset.byteSize,
      MAX_BACKUP_PHOTO_BYTES,
      "Una foto supera el tamaño máximo permitido.",
    );
    totalBytes += byteSize;
    if (totalBytes > MAX_BACKUP_MEDIA_BYTES) {
      throw new Error("Las fotos de la copia superan el tamaño total permitido.");
    }
    assetIds.add(id);
    assets.push({ id, entry, mimeType: "image/jpeg", byteSize, sha256: `sha256:${id}` });
  }

  const measurementIds = new Set<string>();
  const linkedAssetIds = new Set<string>();
  const links: BackupMediaLink[] = [];
  for (const rawLink of media.links) {
    const link = asRecord(rawLink, "Un enlace de foto no es válido.");
    const measurementId = asNonEmptyString(link.measurementId, "Un enlace no indica la medición.");
    const assetId = asNonEmptyString(link.assetId, "Un enlace no indica la foto.");
    if (!assetIds.has(assetId) || !backupMeasurementIds.has(measurementId) || measurementIds.has(measurementId)) {
      throw new Error("El manifiesto contiene enlaces de fotos ambiguos.");
    }
    measurementIds.add(measurementId);
    linkedAssetIds.add(assetId);
    links.push({ measurementId, assetId });
  }
  if (assets.some((asset) => !linkedAssetIds.has(asset.id))) {
    throw new Error("El manifiesto declara fotos que no pertenecen a ninguna medición.");
  }

  const validOmissionReasons = new Set<BackupMediaOmissionReason>([
    "missing",
    "unreadable",
    "per-file-limit",
    "photo-count-limit",
    "total-size-limit",
    "invalid-media",
  ]);
  const omittedMeasurementIds = new Set<string>();
  const omissions: BackupMediaOmission[] = media.omissions.map((rawOmission) => {
    const omission = asRecord(rawOmission, "Una omisión de foto no es válida.");
    const measurementId = asNonEmptyString(
      omission.measurementId,
      "Una omisión no indica la medición.",
    );
    if (!validOmissionReasons.has(omission.reason as BackupMediaOmissionReason)) {
      throw new Error("Una omisión de foto tiene un motivo desconocido.");
    }
    if (
      !backupMeasurementIds.has(measurementId)
      || measurementIds.has(measurementId)
      || omittedMeasurementIds.has(measurementId)
    ) {
      throw new Error("El manifiesto contiene omisiones de fotos ambiguas.");
    }
    omittedMeasurementIds.add(measurementId);
    return { measurementId, reason: omission.reason as BackupMediaOmissionReason };
  });

  return {
    app: BACKUP_APP_ID,
    type: "backup",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: typeof candidate.appVersion === "string" ? candidate.appVersion : "0.0.0",
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
    data: data as TData,
    media: { assets, links, omissions },
  };
}

function unzipFiltered(
  bytes: Uint8Array,
  filter: (file: { name: string; originalSize: number }) => boolean,
): Record<string, Uint8Array> {
  try {
    return unzipSync(bytes, { filter });
  } catch {
    throw new Error("El paquete de copia está dañado o no es un ZIP válido.");
  }
}

export function readBackupManifestFromPackage<TData extends BackupDataShape = BackupDataShape>(
  bytes: Uint8Array,
): BackupManifestV2<TData> {
  if (bytes.byteLength > MAX_BACKUP_PACKAGE_BYTES) {
    throw new Error("El archivo supera el tamaño máximo permitido.");
  }
  const files = unzipFiltered(
    bytes,
    (file) => file.name === BACKUP_MANIFEST_ENTRY && file.originalSize <= MAX_BACKUP_MANIFEST_BYTES,
  );
  const manifestBytes = files[BACKUP_MANIFEST_ENTRY];
  if (!manifestBytes || manifestBytes.byteLength > MAX_BACKUP_MANIFEST_BYTES) {
    throw new Error("El paquete no contiene un manifiesto válido.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new Error("El manifiesto de la copia no es JSON válido.");
  }
  return parseBackupManifest<TData>(parsed);
}

export async function readAndVerifyBackupPackage<TData extends BackupDataShape>(
  bytes: Uint8Array,
  digestHex: (data: Uint8Array) => Promise<string>,
): Promise<ParsedBackupPackage<TData>> {
  const manifest = readBackupManifestFromPackage<TData>(bytes);
  const allowedEntries = new Map(manifest.media.assets.map((asset) => [asset.entry, asset]));
  const files = unzipFiltered(bytes, (file) => {
    const asset = allowedEntries.get(file.name);
    return !!asset && file.originalSize <= asset.byteSize && file.originalSize <= MAX_BACKUP_PHOTO_BYTES;
  });
  const filesByEntry = new Map<string, Uint8Array>();
  for (const asset of manifest.media.assets) {
    const fileBytes = files[asset.entry];
    if (!fileBytes || fileBytes.byteLength !== asset.byteSize) continue;
    const digest = await digestHex(fileBytes);
    if (digest !== asset.id) continue;
    try {
      stripJpegMetadata(fileBytes);
    } catch {
      continue;
    }
    filesByEntry.set(asset.entry, fileBytes);
  }
  return { manifest, filesByEntry };
}

export function isZipPackage(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
    && (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08);
}

export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("La foto normalizada no es JPEG válido.");
  }
  if (bytes[bytes.byteLength - 2] !== 0xff || bytes[bytes.byteLength - 1] !== 0xd9) {
    throw new Error("La foto JPEG no termina correctamente.");
  }
  const chunks: Uint8Array[] = [bytes.subarray(0, 2)];
  let outputLength = 2;
  const finish = (): Uint8Array => {
    const output = new Uint8Array(outputLength);
    let writeOffset = 0;
    for (const chunk of chunks) {
      output.set(chunk, writeOffset);
      writeOffset += chunk.byteLength;
    }
    return output;
  };
  let offset = 2;
  while (offset < bytes.byteLength) {
    if (bytes[offset] !== 0xff || offset + 1 >= bytes.byteLength) {
      throw new Error("La estructura JPEG de la foto no es válida.");
    }
    const marker = bytes[offset + 1];
    if (marker === 0xda) {
      const imageData = bytes.subarray(offset);
      chunks.push(imageData);
      outputLength += imageData.byteLength;
      return finish();
    }
    if (marker === 0xd9) {
      chunks.push(bytes.subarray(offset, offset + 2));
      outputLength += 2;
      return finish();
    }
    if (marker === 0x00 || marker === 0xff || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      chunks.push(bytes.subarray(offset, offset + 2));
      outputLength += 2;
      offset += 2;
      continue;
    }
    if (offset + 3 >= bytes.byteLength) throw new Error("La estructura JPEG está truncada.");
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.byteLength) {
      throw new Error("Un segmento JPEG tiene un tamaño inválido.");
    }
    const shouldStrip = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!shouldStrip) {
      const segment = bytes.subarray(offset, offset + 2 + segmentLength);
      chunks.push(segment);
      outputLength += segment.byteLength;
    }
    offset += 2 + segmentLength;
  }
  throw new Error("La foto JPEG no contiene datos de imagen completos.");
}

export function backupFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `gymnasia_backup_${stamp}${BACKUP_PACKAGE_EXTENSION}`;
}
