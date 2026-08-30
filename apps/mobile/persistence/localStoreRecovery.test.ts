import { createHash } from "node:crypto";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  LocalStoreRecoveryLockedError,
  LocalStoreRecoveryRepository,
  LocalStoreSnapshotWriteError,
  createRecoveryQuarantine,
  createRecoverySnapshot,
  migrateLocalStoreTree,
  parseLocalStoreRaw,
  type LocalStoreRecoveryKeys,
  type StringStorage,
} from "./localStoreRecovery";

const KEYS: LocalStoreRecoveryKeys = {
  primary: "primary",
  snapshot: "snapshot",
  quarantine: "quarantine",
};

const NOW = new Date("2026-08-30T10:00:00.000Z");
const sha256 = async (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

function validStore(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    templates: [],
    workoutHistory: [],
    dietByDate: {},
    dietSettings: {},
    measurements: [],
    threads: [],
    messagesByThread: {},
    keys: [],
    ...overrides,
  };
}

function validRaw(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify(validStore(overrides));
}

class MemoryStorage implements StringStorage {
  readonly values = new Map<string, string>();
  readonly calls: string[] = [];
  readonly failGet = new Set<string>();
  readonly failSet = new Set<string>();

  async getItem(key: string): Promise<string | null> {
    this.calls.push(`get:${key}`);
    if (this.failGet.has(key)) throw new Error("read failed");
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.calls.push(`set:${key}`);
    if (this.failSet.has(key)) throw new Error("write failed");
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.calls.push(`remove:${key}`);
    this.values.delete(key);
  }
}

function repository(storage = new MemoryStorage()): {
  storage: MemoryStorage;
  repository: LocalStoreRecoveryRepository;
} {
  return {
    storage,
    repository: new LocalStoreRecoveryRepository({
      storage,
      keys: KEYS,
      sha256,
      now: () => NOW,
    }),
  };
}

describe("LocalStore structural validation", () => {
  it("migrates missing root containers without inventing user data", () => {
    const parsed = parseLocalStoreRaw("{}");
    expect(parsed).toEqual({ ok: true, value: validStore() });
  });

  it("reports invalid JSON and malformed paths without including values", () => {
    const invalidJson = parseLocalStoreRaw("{broken");
    expect(invalidJson).toMatchObject({
      ok: false,
      cause: "invalid_json",
      issues: [{ path: "$", code: "invalid_json" }],
    });

    const secret = "SUPER_SECRET_VALUE";
    const malformed = parseLocalStoreRaw(JSON.stringify(validStore({ templates: secret })));
    expect(malformed).toMatchObject({
      ok: false,
      cause: "invalid_shape",
      issues: [{ path: "$.templates", code: "expected_array" }],
    });
    expect(JSON.stringify(malformed)).not.toContain(secret);
  });

  it("rejects unknown root fields without exposing their names", () => {
    const secretFieldName = "private-secret-as-a-field-name";
    const parsed = parseLocalStoreRaw(JSON.stringify(validStore({ [secretFieldName]: true })));
    expect(parsed).toMatchObject({
      ok: false,
      issues: [{ path: "$[unknown]", code: "unknown_root_field" }],
    });
    expect(JSON.stringify(parsed)).not.toContain(secretFieldName);
  });

  it("keeps migrations idempotent for arbitrary JSON trees", () => {
    fc.assert(fc.property(fc.jsonValue(), (value) => {
      const once = migrateLocalStoreTree(value);
      const twice = migrateLocalStoreTree(once);
      expect(twice).toEqual(once);
    }));
  });

  it("never throws for arbitrary JSON trees", () => {
    fc.assert(fc.property(fc.jsonValue(), (value) => {
      expect(() => parseLocalStoreRaw(JSON.stringify(value))).not.toThrow();
    }));
  });
});

describe("LocalStore recovery repository", () => {
  it("distinguishes an actually empty store", async () => {
    const { repository: repo } = repository();
    await expect(repo.inspect()).resolves.toEqual({ status: "empty" });
  });

  it("returns a valid store without rewriting it", async () => {
    const { storage, repository: repo } = repository();
    const raw = validRaw();
    storage.values.set(KEYS.primary, raw);

    await expect(repo.inspect()).resolves.toMatchObject({
      status: "valid",
      candidate: { raw, source: "primary" },
    });
    expect(storage.values.get(KEYS.primary)).toBe(raw);
    expect(storage.values.has(KEYS.snapshot)).toBe(false);
  });

  it("quarantines invalid JSON byte-for-byte and never overwrites the primary", async () => {
    const { storage, repository: repo } = repository();
    const corruptRaw = "{\"templates\":[BROKEN";
    storage.values.set(KEYS.primary, corruptRaw);

    const outcome = await repo.inspect();
    expect(outcome).toMatchObject({
      status: "corrupt",
      quarantine: {
        rawPayload: corruptRaw,
        cause: "invalid_json",
      },
    });
    expect(storage.values.get(KEYS.primary)).toBe(corruptRaw);
    expect(JSON.parse(storage.values.get(KEYS.quarantine) ?? "null").rawPayload).toBe(corruptRaw);
  });

  it("offers a verified snapshot when the primary is corrupt", async () => {
    const { storage, repository: repo } = repository();
    const snapshotRaw = validRaw({ threads: [{ id: "saved", title: "Copia válida" }] });
    storage.values.set(KEYS.primary, "not-json");
    storage.values.set(
      KEYS.snapshot,
      JSON.stringify(await createRecoverySnapshot(snapshotRaw, sha256, NOW)),
    );

    await expect(repo.inspect()).resolves.toMatchObject({
      status: "recoverable",
      snapshot: { raw: snapshotRaw },
      currentValid: false,
    });
  });

  it("rejects a snapshot whose checksum was manipulated", async () => {
    const { storage, repository: repo } = repository();
    const snapshot = await createRecoverySnapshot(validRaw(), sha256, NOW);
    storage.values.set(KEYS.primary, "not-json");
    storage.values.set(KEYS.snapshot, JSON.stringify({ ...snapshot, sha256: "0".repeat(64) }));

    await expect(repo.inspect()).resolves.toMatchObject({ status: "corrupt" });
  });

  it("keeps an existing quarantine as a durable lock across restarts", async () => {
    const { storage, repository: repo } = repository();
    const raw = validRaw();
    storage.values.set(KEYS.primary, raw);
    storage.values.set(
      KEYS.quarantine,
      JSON.stringify(await createRecoveryQuarantine({
        source: "primary",
        cause: "invalid_json",
        rawPayload: "old-corrupt-value",
        issues: [{ path: "$", code: "invalid_json", message: "JSON inválido." }],
      }, sha256, NOW)),
    );

    await expect(repo.inspect()).resolves.toMatchObject({
      status: "recoverable",
      currentValid: true,
    });
    await expect(repo.commit(raw)).rejects.toBeInstanceOf(LocalStoreRecoveryLockedError);
    expect(JSON.parse(storage.values.get(KEYS.quarantine) ?? "null").rawPayload)
      .toBe("old-corrupt-value");
  });

  it("quarantines corruption that appears after hydration before replacing the primary", async () => {
    const { storage, repository: repo } = repository();
    const originalRaw = validRaw({ threads: [{ id: "before", title: "Antes" }] });
    storage.values.set(KEYS.primary, originalRaw);
    await expect(repo.inspect()).resolves.toMatchObject({ status: "valid" });

    const corruptRaw = "{\"threads\":[BROKEN_AFTER_HYDRATION";
    storage.values.set(KEYS.primary, corruptRaw);
    const replacementRaw = validRaw({ threads: [{ id: "after", title: "Después" }] });

    await expect(repo.commit(replacementRaw)).rejects.toBeInstanceOf(LocalStoreRecoveryLockedError);
    expect(storage.values.get(KEYS.primary)).toBe(corruptRaw);
    expect(JSON.parse(storage.values.get(KEYS.quarantine) ?? "null").rawPayload).toBe(corruptRaw);
  });

  it("does not recreate a missing primary over an existing recovery snapshot", async () => {
    const { storage, repository: repo } = repository();
    const previousRaw = validRaw({ measurements: [{ id: "previous" }] });
    storage.values.set(
      KEYS.snapshot,
      JSON.stringify(await createRecoverySnapshot(previousRaw, sha256, NOW)),
    );

    const replacementRaw = validRaw();
    await expect(repo.commit(replacementRaw)).rejects.toBeInstanceOf(LocalStoreRecoveryLockedError);
    expect(storage.values.has(KEYS.primary)).toBe(false);
    expect(JSON.parse(storage.values.get(KEYS.quarantine) ?? "null")).toMatchObject({
      cause: "primary_missing",
      rawPayload: null,
    });
  });

  it("verifies the primary before updating the rolling snapshot", async () => {
    const { storage, repository: repo } = repository();
    const raw = validRaw({ threads: [{ id: "new", title: "Nuevo" }] });

    await repo.commit(raw);

    expect(storage.values.get(KEYS.primary)).toBe(raw);
    expect(JSON.parse(storage.values.get(KEYS.snapshot) ?? "null").payload).toBe(raw);
    expect(storage.calls.indexOf(`get:${KEYS.primary}`))
      .toBeLessThan(storage.calls.lastIndexOf(`set:${KEYS.snapshot}`));
  });

  it("keeps the previous snapshot if the new snapshot write fails", async () => {
    const { storage, repository: repo } = repository();
    const previous = await createRecoverySnapshot(validRaw({ threads: [] }), sha256, NOW);
    storage.values.set(KEYS.primary, previous.payload);
    storage.values.set(KEYS.snapshot, JSON.stringify(previous));
    storage.failSet.add(KEYS.snapshot);
    const nextRaw = validRaw({ threads: [{ id: "next", title: "Siguiente" }] });

    await expect(repo.commit(nextRaw)).rejects.toBeInstanceOf(LocalStoreSnapshotWriteError);
    expect(storage.values.get(KEYS.primary)).toBe(nextRaw);
    expect(storage.values.get(KEYS.snapshot)).toBe(JSON.stringify(previous));
  });

  it("restores a snapshot and clears quarantine only after a verified commit", async () => {
    const { storage, repository: repo } = repository();
    const snapshotRaw = validRaw({ measurements: [{ id: "measurement" }] });
    storage.values.set(KEYS.primary, "broken");
    storage.values.set(
      KEYS.snapshot,
      JSON.stringify(await createRecoverySnapshot(snapshotRaw, sha256, NOW)),
    );
    await repo.inspect();

    await expect(repo.restoreSnapshot()).resolves.toMatchObject({ raw: snapshotRaw });
    expect(storage.values.get(KEYS.primary)).toBe(snapshotRaw);
    expect(storage.values.has(KEYS.quarantine)).toBe(false);
  });

  it("discards only affected keys and preserves independent data", async () => {
    const { storage, repository: repo } = repository();
    const independentKey = "personal-data";
    const sessionKey = "session";
    storage.values.set(KEYS.primary, "broken");
    storage.values.set(independentKey, "keep-me");
    storage.values.set(sessionKey, "dependent");
    await repo.inspect();

    const initialRaw = validRaw();
    await repo.discardAffected(initialRaw, [sessionKey]);

    expect(storage.values.get(KEYS.primary)).toBe(initialRaw);
    expect(storage.values.get(independentKey)).toBe("keep-me");
    expect(storage.values.has(sessionKey)).toBe(false);
    expect(storage.values.has(KEYS.quarantine)).toBe(false);
  });

  it("classifies read failures without pretending the store is empty", async () => {
    const storage = new MemoryStorage();
    storage.failGet.add(KEYS.primary);
    const { repository: repo } = repository(storage);

    await expect(repo.inspect()).resolves.toMatchObject({
      status: "corrupt",
      quarantine: {
        source: "unavailable",
        cause: "storage_read_failed",
        rawPayload: null,
      },
    });
  });
});
