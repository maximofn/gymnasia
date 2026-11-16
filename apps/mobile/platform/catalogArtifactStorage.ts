import {
  artifactRelativePath, CATALOG_CACHE_MAX_BYTES, CATALOG_CACHE_MAX_ITEM_BYTES,
  utf8ByteLength, type CatalogArtifactStorage,
} from "../catalogCache";

export type ArtifactBackend = {
  prepare?(): Promise<void>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  list(): Promise<Array<{ key: string; bytes: number }>>;
  clear(): Promise<void>;
  measure(): Promise<{ bytes: number | null; entries: number | null }>;
};

/** Serialize mutations and verify every persisted object before callers can
 * retire a legacy copy. Hitting this budget never evicts offline page data.
 */
export function createBoundedCatalogArtifacts(
  backend: ArtifactBackend, prefix: string, maxBytes = CATALOG_CACHE_MAX_BYTES,
): CatalogArtifactStorage {
  let tail: Promise<unknown> = Promise.resolve();
  let sizes: Map<string, number> | null = null;
  function serial<T>(job: () => Promise<T>): Promise<T> {
    const result = tail.then(job);
    tail = result.catch(() => {});
    return result;
  }
  async function initialize() {
    if (sizes) return sizes;
    await backend.prepare?.();
    sizes = new Map((await backend.list()).map((entry) => [entry.key, entry.bytes]));
    return sizes;
  }
  return {
    getItem: (key) => serial(async () => {
      artifactRelativePath(key, prefix);
      await initialize();
      return backend.get(key);
    }),
    setItem: (key, value) => serial(async () => {
      artifactRelativePath(key, prefix);
      const entries = await initialize();
      const bytes = utf8ByteLength(value);
      const total = [...entries.values()].reduce((sum, size) => sum + size, 0);
      if (bytes > CATALOG_CACHE_MAX_ITEM_BYTES || total - (entries.get(key) ?? 0) + bytes > maxBytes) {
        throw new Error("Se alcanzó el límite de la caché del catálogo.");
      }
      try {
        await backend.put(key, value);
        if (await backend.get(key) !== value) throw new Error("No se pudo verificar la caché del catálogo.");
        entries.set(key, bytes);
      } catch (error) {
        sizes = null;
        throw error;
      }
    }),
    removeItem: (key) => serial(async () => {
      artifactRelativePath(key, prefix);
      const entries = await initialize();
      await backend.remove(key);
      if (await backend.get(key) !== null) throw new Error("No se pudo comprobar el borrado del catálogo.");
      entries.delete(key);
    }),
    getAllKeys: () => serial(async () => [...(await initialize()).keys()]),
    clear: () => serial(async () => { try { await backend.clear(); } finally { sizes = null; } }),
    // Measurement itself does not create directories, migrate, clean or write.
    measure: () => serial(async () => ({ ...await backend.measure(), maxBytes })),
  };
}
