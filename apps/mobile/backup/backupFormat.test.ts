import { createHash } from "node:crypto";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  MAX_BACKUP_MEDIA_BYTES,
  MAX_BACKUP_PHOTOS,
  createBackupPackage,
  isZipPackage,
  parseBackupManifest,
  parseBackupPayloadV1,
  readAndVerifyBackupPackage,
  selectBackupMedia,
  stripJpegMetadata,
  withoutPortablePhotoUris,
  type BackupDataShape,
  type BackupManifestV2,
  type BackupMediaCandidate,
} from "./backupFormat";

function digestHex(bytes: Uint8Array): Promise<string> {
  return Promise.resolve(createHash("sha256").update(bytes).digest("hex"));
}

function candidate(
  measurementId: string,
  measuredAt: string,
  bytes: Uint8Array | null,
): BackupMediaCandidate {
  return {
    measurementId,
    measuredAt,
    bytes,
    sha256: bytes ? createHash("sha256").update(bytes).digest("hex") : null,
    failureReason: bytes ? undefined : "missing",
  };
}

function data(): BackupDataShape {
  return {
    store: {
      measurements: [
        { id: "measurement_1", measured_at: "2026-08-30T12:00:00.000Z", photo_uri: "file:///private/photo.jpg", weight_kg: 80 },
        { id: "measurement_2", measured_at: "2026-08-29T12:00:00.000Z", photo_uri: null, weight_kg: 79.5 },
      ],
      keys: [{ provider: "openai", api_key: "" }],
    },
    userPrefs: {},
    personalFoods: [],
    personalData: [],
  };
}

function manifestFor(selection: ReturnType<typeof selectBackupMedia>): BackupManifestV2 {
  return {
    app: BACKUP_APP_ID,
    type: "backup",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: "1.20.0",
    createdAt: "2026-08-30T12:00:00.000Z",
    data: withoutPortablePhotoUris(data()),
    media: {
      assets: selection.assets,
      links: selection.links,
      omissions: selection.omissions,
    },
  };
}

describe("backup de fotos portable", () => {
  it("mantiene la importación del formato JSON v1 y rechaza versiones futuras", () => {
    const legacy = {
      app: BACKUP_APP_ID,
      type: "backup",
      schemaVersion: 1,
      appVersion: "1.19.0",
      createdAt: "2026-08-01T12:00:00.000Z",
      data: data(),
    };

    expect(parseBackupPayloadV1(legacy)).toEqual(legacy);
    expect(() => parseBackupPayloadV1({ ...legacy, schemaVersion: 99 })).toThrow(
      /versión más reciente/,
    );
  });

  it("crea un paquete v2 y verifica cada foto por SHA-256", async () => {
    const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
    const selection = selectBackupMedia([
      candidate("measurement_1", "2026-08-30T12:00:00.000Z", photo),
    ]);
    const manifest = manifestFor(selection);
    const packageBytes = createBackupPackage(manifest, selection.filesByEntry);

    expect(isZipPackage(packageBytes)).toBe(true);
    const parsed = await readAndVerifyBackupPackage(packageBytes, digestHex);
    expect(parsed.manifest).toEqual(manifest);
    expect(parsed.filesByEntry.get(selection.assets[0].entry)).toEqual(photo);
    expect(parsed.manifest.data.store.measurements?.[0].photo_uri).toBeNull();
  });

  it("deduplica bytes iguales sin perder la relación con cada medición", () => {
    const photo = new Uint8Array([1, 2, 3, 4]);
    const selection = selectBackupMedia([
      candidate("new", "2026-08-30T12:00:00.000Z", photo),
      candidate("old", "2026-08-29T12:00:00.000Z", photo),
    ]);

    expect(selection.assets).toHaveLength(1);
    expect(selection.links).toEqual([
      { measurementId: "new", assetId: selection.assets[0].id },
      { measurementId: "old", assetId: selection.assets[0].id },
    ]);
    expect(selection.filesByEntry).toHaveLength(1);
  });

  it("prioriza las fotos recientes y avisa al alcanzar el límite de cantidad", () => {
    const candidates = Array.from({ length: MAX_BACKUP_PHOTOS + 2 }, (_, index) =>
      candidate(
        `measurement_${index}`,
        new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
        new Uint8Array([index & 0xff, (index >> 8) & 0xff]),
      ));
    const selection = selectBackupMedia(candidates);

    expect(selection.links).toHaveLength(MAX_BACKUP_PHOTOS);
    expect(selection.omissions).toHaveLength(2);
    expect(selection.omissions.every((item) => item.reason === "photo-count-limit")).toBe(true);
    expect(selection.links[0].measurementId).toBe(`measurement_${MAX_BACKUP_PHOTOS + 1}`);
  });

  it("elimina EXIF, XMP, IPTC y comentarios del JPEG", () => {
    const source = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46,
      0xff, 0xe1, 0x00, 0x04, 0x45, 0x58,
      0xff, 0xed, 0x00, 0x04, 0x49, 0x50,
      0xff, 0xfe, 0x00, 0x04, 0x43, 0x4d,
      0xff, 0xda, 0x00, 0x02, 0x01, 0x02, 0xff, 0xd9,
    ]);
    const sanitized = stripJpegMetadata(source);

    expect([...sanitized]).toEqual([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46,
      0xff, 0xda, 0x00, 0x02, 0x01, 0x02, 0xff, 0xd9,
    ]);
    expect(() => stripJpegMetadata(source.subarray(0, source.byteLength - 2))).toThrow(
      /no termina correctamente/,
    );
  });

  it("rechaza rutas internas manipuladas y enlaces ambiguos", () => {
    const photo = new Uint8Array([1, 2, 3]);
    const selection = selectBackupMedia([candidate("measurement_1", "2026-08-30", photo)]);
    const manifest = manifestFor(selection);

    expect(() => parseBackupManifest({
      ...manifest,
      media: {
        ...manifest.media,
        assets: [{ ...manifest.media.assets[0], entry: "../../photo.jpg" }],
      },
    })).toThrow(/ruta interna insegura/);

    expect(() => parseBackupManifest({
      ...manifest,
      media: {
        ...manifest.media,
        links: [...manifest.media.links, ...manifest.media.links],
      },
    })).toThrow(/enlaces de fotos ambiguos/);
  });

  it("una foto corrupta no elimina la medición numérica del manifiesto", async () => {
    const photo = new Uint8Array([1, 2, 3]);
    const selection = selectBackupMedia([candidate("measurement_1", "2026-08-30", photo)]);
    const manifest = manifestFor(selection);
    const corrupted = new Map(selection.filesByEntry);
    corrupted.set(selection.assets[0].entry, new Uint8Array([9, 9, 9]));
    const packageBytes = createBackupPackage(manifest, corrupted);

    const parsed = await readAndVerifyBackupPackage(packageBytes, digestHex);
    expect(parsed.filesByEntry).toHaveLength(0);
    expect(parsed.manifest.data.store.measurements?.[0]).toMatchObject({
      id: "measurement_1",
      weight_kg: 80,
      photo_uri: null,
    });
  });

  it("mantiene los límites y nunca cruza enlaces entre mediciones", () => {
    fc.assert(fc.property(
      fc.array(
        fc.record({
          id: fc.uuid(),
          timestamp: fc.date({
            min: new Date("2020-01-01"),
            max: new Date("2030-01-01"),
            noInvalidDate: true,
          }),
          bytes: fc.uint8Array({ minLength: 1, maxLength: 128 }),
        }),
        { maxLength: 700 },
      ),
      (items) => {
        const candidates = items.map((item) => candidate(item.id, item.timestamp.toISOString(), item.bytes));
        const selected = selectBackupMedia(candidates);
        const inputIds = new Set(items.map((item) => item.id));
        expect(selected.links.length).toBeLessThanOrEqual(MAX_BACKUP_PHOTOS);
        expect(selected.assets.reduce((sum, asset) => sum + asset.byteSize, 0)).toBeLessThanOrEqual(
          MAX_BACKUP_MEDIA_BYTES,
        );
        expect(selected.links.every((link) => inputIds.has(link.measurementId))).toBe(true);
        expect(selected.links.every((link) => selected.assets.some((asset) => asset.id === link.assetId))).toBe(true);
      },
    ));
  });
});
