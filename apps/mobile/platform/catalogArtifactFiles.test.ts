import { beforeEach, describe, expect, it, vi } from "vitest";
const fs = vi.hoisted(() => ({ files: new Map<string, string>(), folders: new Set<string>() }));
vi.mock("expo-file-system", () => {
  const uri = (parts: Array<string | { uri: string }>) => parts.map((part) => typeof part === "string" ? part : part.uri).join("/");
  class Directory {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) { this.uri = uri(parts); }
    get name() { return this.uri.split("/").at(-1)!; }
    get exists() { return fs.folders.has(this.uri); }
    get size() { return [...fs.files].filter(([key]) => key.startsWith(`${this.uri}/`)).reduce((sum, [, value]) => sum + Buffer.byteLength(value), 0); }
    create() {
      const parts = this.uri.split("/");
      parts.forEach((_, index) => fs.folders.add(parts.slice(0, index + 1).join("/")));
    }
    list() {
      const children = new Map<string, File | Directory>();
      for (const path of [...fs.folders, ...fs.files.keys()]) {
        const rest = path.startsWith(`${this.uri}/`) ? path.slice(this.uri.length + 1) : "";
        if (rest && !rest.includes("/")) children.set(path, fs.files.has(path) ? new File(path) : new Directory(path));
      }
      return [...children.values()];
    }
    delete() {
      for (const path of fs.files.keys()) if (path.startsWith(`${this.uri}/`)) fs.files.delete(path);
      for (const path of fs.folders) if (path === this.uri || path.startsWith(`${this.uri}/`)) fs.folders.delete(path);
    }
  }
  class File {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) { this.uri = uri(parts); }
    get name() { return this.uri.split("/").at(-1)!; }
    get parentDirectory() { return new Directory(this.uri.slice(0, this.uri.lastIndexOf("/"))); }
    get exists() { return fs.files.has(this.uri); }
    get size() { return Buffer.byteLength(fs.files.get(this.uri) ?? ""); }
    async text() { return fs.files.get(this.uri)!; }
    write(value: string) { fs.files.set(this.uri, value); }
    delete() { fs.files.delete(this.uri); }
    move(destination: File) { const value = fs.files.get(this.uri)!; fs.files.delete(this.uri); this.uri = destination.uri; fs.files.set(this.uri, value); }
  }
  return { Directory, File, Paths: { document: "documents" } };
});
import { createCatalogArtifactFiles } from "./catalogArtifactFiles";
import { createBoundedCatalogArtifacts } from "./catalogArtifactStorage";

beforeEach(() => { fs.files.clear(); fs.folders.clear(); });
describe("native public artifact files", () => {
  it("keeps the committed file after Expo mutates the temporary File.uri on move", async () => {
    const prefix = "artifact:";
    const key = `${prefix}sha256:${"a".repeat(64)}:pages/0000.json`;
    const backend = createCatalogArtifactFiles(prefix);
    const cache = createBoundedCatalogArtifacts(backend, prefix);
    expect(await cache.measure()).toMatchObject({ bytes: 0, entries: 0 });
    expect(fs.folders.size).toBe(0);
    await cache.setItem(key, "catálogo 🏋️");
    expect(await cache.getItem(key)).toBe("catálogo 🏋️");
    expect(await cache.getAllKeys()).toEqual([key]);
    expect(fs.files.size).toBe(1);
    // Restart, then clear: the directory belongs only to this public cache.
    fs.files.set("documents/gymnasia_measurement_media_v1/photo.jpg", "personal photo");
    const restarted = createBoundedCatalogArtifacts(createCatalogArtifactFiles(prefix), prefix);
    expect(await restarted.getItem(key)).toBe("catálogo 🏋️");
    await restarted.clear();
    expect(await restarted.measure()).toMatchObject({ bytes: 0, entries: 0 });
    expect(fs.files.get("documents/gymnasia_measurement_media_v1/photo.jpg")).toBe("personal photo");
  });
});
