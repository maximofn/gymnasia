import { Buffer } from "node:buffer";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { formatStorageBytes, formatStorageUsageReport, measureStorageUsage, utf8ByteLength } from "./storageUsage";

const scope = (key: string) => `gymnasia.development:${key}`;
const unavailablePhotos = async () => ({ bytes: null, fileCount: null, availableDiskBytes: null });
function input(values: Map<string, string>) {
  return {
    storage: {
      getAllKeys: vi.fn(async () => [...values.keys()]),
      getItem: vi.fn(async (key: string) => values.get(key) ?? null),
      setItem: vi.fn(), removeItem: vi.fn(),
    },
    scopedKey: scope,
    belongsToActiveNamespace: (key: string) => key.startsWith("gymnasia.development:"),
    measurePhotos: unavailablePhotos,
    now: () => new Date("2026-10-28T15:00:00Z"),
  };
}

describe("storage usage diagnostics", () => {
  it("measures stored UTF-8 values and primary fields without returning contents or identifiers", async () => {
    const marker = "PRIVATE_TITLE_AND_MESSAGE_á🧘";
    const primary = JSON.stringify({ measurements: [{ id: marker, photo_uri: `file:///${marker}.jpg` }],
      messagesByThread: { [marker]: [{ content: marker }] }, [marker]: marker });
    const values = new Map([
      [scope("gymnasia.mobile.local.v3"), primary],
      [scope("gymnasia.mobile.local.last_good.v1"), JSON.stringify({ payload: primary })],
      [scope("gymnasia.mobile.foods_repo.v2"), JSON.stringify([marker])],
      [scope("gymnasia_debug_traces"), "[]"],
    ]);
    const config = input(values);
    const report = await measureStorageUsage({ ...config,
      measurePhotos: async () => ({ bytes: 123_456, fileCount: 2, availableDiskBytes: 999_999 }) });
    expect(report.valueBytes).toBe([...values.values()].reduce((total, raw) => total + Buffer.byteLength(raw), 0));
    expect(report.measuredEntries).toBe(4);
    expect(report.primaryStatus).toBe("measured");
    expect(report.primarySections.find((row) => row.id === "measurements")?.bytes)
      .toBe(Buffer.byteLength(JSON.stringify(JSON.parse(primary).measurements)));
    expect(report.groups.map((row) => row.id)).toEqual(expect.arrayContaining(["primary", "recovery", "catalogs", "diagnostics"]));
    expect(report.groups.reduce((total, row) => total + row.bytes, 0)).toBe(report.valueBytes);
    expect(report.photos.bytes).toBe(123_456);
    expect(config.storage.setItem).not.toHaveBeenCalled();
    expect(config.storage.removeItem).not.toHaveBeenCalled();
    for (const output of [JSON.stringify(report), formatStorageUsageReport(report)]) {
      expect(output).not.toContain(marker);
      expect(output).not.toContain("file://");
      expect(output).not.toContain("gymnasia.mobile");
    }
    expect(formatStorageUsageReport(report)).toContain("no del archivo SQLite");
  });

  it("never reads credentials, legacy stores, quarantines, unknown keys or another variant", async () => {
    const privateKeys = ["gymnasia.mobile.provider_configuration.v1", "gymnasia.mobile.local.v1",
      "gymnasia.mobile.local.v2", "gymnasia.mobile.local.quarantine.v1"];
    const values = new Map([
      ...privateKeys.map((key): [string, string] => [scope(key), "SECRET_API_KEY"]),
      [scope("PRIVATE_UNKNOWN_KEY"), "SECRET"], ["gymnasia.staging:another", "SECRET"],
    ]);
    const config = input(values);
    const report = await measureStorageUsage(config);
    expect(config.storage.getItem).not.toHaveBeenCalled();
    expect(report.excludedEntries).toBe(4);
    expect(report.unknownEntries).toBe(1);
    expect(report.valueBytes).toBe(0);
    expect(report.photos.bytes).toBeNull();
    expect(JSON.stringify(report)).not.toContain("PRIVATE_UNKNOWN_KEY");
    expect(formatStorageUsageReport(report)).not.toContain("SECRET");
  });

  it("counts 41 public catalog artifacts without widening the allowlist to other dynamic keys", async () => {
    const prefix = `${scope("gymnasia.mobile.exercise_catalog.v4")}:artifact:`;
    const marker = "CATALOG_CONTENT_MUST_NOT_BE_COPIED";
    const values = new Map(Array.from({ length: 41 }, (_, index): [string, string] => [
      `${prefix}sha256:${"a".repeat(64)}:search/${index.toString(16).padStart(2, "0")}.json`,
      JSON.stringify({ documents: [marker] }),
    ]));
    values.set(`${prefix}sha256:${"a".repeat(64)}:pages/0000.json`, "[]");
    values.set(`${prefix}sha256:${"a".repeat(64)}:by-id/61.json`, "{}");
    const excluded = [prefix, `${scope("gymnasia.mobile.exercise_catalog.v4")}:artifact-other:secret`,
      "gymnasia.staging:gymnasia.mobile.exercise_catalog.v4:artifact:secret"];
    for (const key of excluded) values.set(key, "PRIVATE_CREDENTIAL");
    const config = input(values);
    const report = await measureStorageUsage({ ...config,
      measureDatabase: async () => ({ databaseBytes: 6_291_456, auxiliaryBytes: 32_768 }) });
    expect(report.unknownEntries).toBe(2);
    expect(report.measuredEntries).toBe(43);
    expect(report.catalogSections.find((row) => row.id === "search")?.entries).toBe(41);
    expect(report.catalogSections.map((row) => row.id)).toEqual(expect.arrayContaining(["pages", "directory"]));
    expect(report.catalogSections.reduce((sum, row) => sum + row.bytes, 0)).toBe(report.valueBytes);
    expect(report.database).toEqual({ databaseBytes: 6_291_456, auxiliaryBytes: 32_768 });
    for (const key of excluded) expect(config.storage.getItem).not.toHaveBeenCalledWith(key);
    const exported = formatStorageUsageReport(report);
    expect(exported).toContain("Archivo SQLite: 6291456 bytes");
    expect(exported).not.toContain(marker);
    expect(exported).not.toContain("sha256:");
    expect(exported).not.toContain("PRIVATE");
    expect(config.storage.setItem).not.toHaveBeenCalled();
    expect(config.storage.removeItem).not.toHaveBeenCalled();
  });

  it("reports failed reads, invalid JSON and unavailable files without exposing exceptions or treating them as measured zero", async () => {
    const config = input(new Map([[scope("gymnasia.mobile.local.v3"), "{PRIVATE_INVALID_JSON"],
      [scope("gymnasia_debug_traces"), "[]"]]));
    config.storage.getItem.mockImplementation(async (key) => {
      if (key.endsWith("gymnasia_debug_traces")) throw new Error("PRIVATE_SQL_ERROR");
      return "{PRIVATE_INVALID_JSON";
    });
    const report = await measureStorageUsage({ ...config, measurePhotos: async () => { throw new Error("PRIVATE_PATH"); } });
    expect(report.unreadableEntries).toBe(1);
    expect(report.primaryStatus).toBe("invalid");
    expect(report.primarySections).toEqual([]);
    expect(report.measuredEntries).toBe(1);
    expect(formatStorageUsageReport(report)).not.toContain("PRIVATE");
    await expect(measureStorageUsage({ ...config, storage: {
      ...config.storage, getAllKeys: async () => { throw new Error("unavailable"); },
    } })).rejects.toThrow("unavailable");
  });

  it("counts stores above the old 6 MiB quota without truncating or mutating their values", async () => {
    const raw = "x".repeat(1_600_000);
    const values = new Map(["foods_repo.v2", "products_repo.v2", "recipes_repo.v2", "exercise_catalog.v4"]
      .map((key): [string, string] => [scope(`gymnasia.mobile.${key}`), raw]));
    const report = await measureStorageUsage(input(values));
    expect(report.valueBytes).toBe(6_400_000);
    expect(report.largestEntryBytes).toBe(raw.length);
    expect(report.groups).toEqual([{ id: "catalogs", label: "Catálogos descargados", bytes: 6_400_000, entries: 4 }]);
    expect([...values.values()].every((value) => value === raw)).toBe(true);
  });

  it("recovers from a read that never resolves instead of leaving the diagnostic loading indefinitely", async () => {
    vi.useFakeTimers();
    try {
      const config = input(new Map([[scope("gymnasia.mobile.local.v3"), "unused"]]));
      config.storage.getItem.mockImplementation(() => new Promise(() => {}));
      const pending = measureStorageUsage(config);
      await vi.advanceTimersByTimeAsync(5_100);
      const report = await pending;
      expect(report.primaryStatus).toBe("unreadable");
      expect(report.unreadableEntries).toBe(1);
      expect(report.measuredEntries).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("matches UTF-8 byte counts for arbitrary UTF-16 including emoji and lone surrogates", () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 0xffff }), { maxLength: 1000 }), (codes) => {
      const value = String.fromCharCode(...codes);
      expect(utf8ByteLength(value)).toBe(Buffer.byteLength(value, "utf8"));
    }), { numRuns: 300 });
    for (const value of ["á🧘", "\ud800", "\udfff", "汉字", "a\n\"b"]) {
      expect(utf8ByteLength(value)).toBe(Buffer.byteLength(value));
    }
  });

  it("distinguishes absent metadata and zero in readable sizes", () => {
    expect(formatStorageBytes(null)).toBe("No disponible");
    expect(formatStorageBytes(0)).toBe("0 B");
    expect(formatStorageBytes(1536)).toBe("1.5 KiB");
    expect(formatStorageBytes(2 ** 20)).toBe("1.00 MiB");
    expect(formatStorageBytes(2 ** 30)).toBe("1.00 GiB");
  });
});
