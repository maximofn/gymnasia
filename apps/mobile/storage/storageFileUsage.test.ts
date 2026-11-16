import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  os: "android", document: "file:///data/user/0/com.example/files/", directoryExists: true,
  sizes: new Map<string, number | null>(), error: false,
  accesses: [] as string[],
  readContent: vi.fn(() => { throw new Error("Must not read database contents"); }),
  writeContent: vi.fn(() => { throw new Error("Must not write database"); }),
}));

vi.mock("react-native", () => ({ Platform: { get OS() { return state.os; } } }));
vi.mock("expo-file-system", () => ({
  Paths: { get document() { return { uri: state.document }; },
    join: (base: { uri: string }, ...parts: string[]) => new URL(parts.join("/"), base.uri).href },
  Directory: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    get exists() { return state.directoryExists; }
  },
  File: class {
    uri: string;
    constructor(directory: { uri: string }, name: string) { this.uri = `${directory.uri}/${name}`; state.accesses.push(this.uri); }
    get exists() { if (state.error) throw new Error("PRIVATE_DATABASE_PATH"); return state.sizes.has(this.uri); }
    get size() { return state.sizes.get(this.uri) ?? null; }
    bytes = state.readContent;
    text = state.readContent;
    info = state.readContent; // Avoid info({ md5: true }) accidentally reading the file.
    write = state.writeContent;
    delete = state.writeContent;
  },
}));

import { measureStorageDatabaseUsage } from "./storageFileUsage";

const database = "file:///data/user/0/com.example/databases/RKStorage";
const unavailable = { databaseBytes: null, auxiliaryBytes: null };

describe("Android database file metadata", () => {
  beforeEach(() => {
    Object.assign(state, { os: "android", document: "file:///data/user/0/com.example/files/",
      directoryExists: true, error: false, accesses: [] });
    state.sizes.clear();
  });

  it("counts only the fixed private database and journal metadata, never their contents", async () => {
    state.sizes.set(database, 6_291_456);
    state.sizes.set(`${database}-wal`, 40_000);
    state.sizes.set(`${database}-shm`, 32_768);
    state.sizes.set(`${database}-journal`, 8_192);
    await expect(measureStorageDatabaseUsage()).resolves.toEqual({ databaseBytes: 6_291_456, auxiliaryBytes: 80_960 });
    expect(state.accesses).toEqual([database, `${database}-wal`, `${database}-shm`, `${database}-journal`]);
    expect(state.readContent).not.toHaveBeenCalled();
    expect(state.writeContent).not.toHaveBeenCalled();
  });

  it("distinguishes absent journals from an unavailable or unrecognized database", async () => {
    state.sizes.set(database, 4096);
    await expect(measureStorageDatabaseUsage()).resolves.toEqual({ databaseBytes: 4096, auxiliaryBytes: 0 });
    state.sizes.set(`${database}-wal`, null);
    await expect(measureStorageDatabaseUsage()).resolves.toEqual({ databaseBytes: 4096, auxiliaryBytes: null });
    state.sizes.clear();
    await expect(measureStorageDatabaseUsage()).resolves.toEqual(unavailable);
    state.document = "file:///expo/experience/";
    state.accesses = [];
    await expect(measureStorageDatabaseUsage()).resolves.toEqual(unavailable);
    expect(state.accesses).toEqual([]);
  });

  it("does not access files on web/iOS and never exposes paths on failure", async () => {
    for (const os of ["web", "ios"]) {
      state.os = os;
      await expect(measureStorageDatabaseUsage()).resolves.toEqual(unavailable);
    }
    expect(state.accesses).toEqual([]);
    state.os = "android";
    state.error = true;
    await expect(measureStorageDatabaseUsage()).resolves.toEqual(unavailable);
  });
});
