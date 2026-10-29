export const CATALOG_CACHE_DIRECTORY = "gymnasia_public_catalog_cache_v1";
export const CATALOG_CACHE_MAX_BYTES = 24 * 1024 * 1024;
export const CATALOG_CACHE_MAX_ITEM_BYTES = 2 * 1024 * 1024;

export type CatalogCacheUsage = { bytes: number | null; entries: number | null; maxBytes: number };
export type CatalogArtifactStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  clear(): Promise<void>;
  measure(): Promise<CatalogCacheUsage>;
};

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff
      && value.charCodeAt(index + 1) >= 0xdc00 && value.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

// Only immutable public artifacts are accepted. No caller-supplied filesystem
// path, provider key, personal ID or arbitrary AsyncStorage key can pass here.
export function artifactRelativePath(key: string, prefix: string): string {
  if (!key.startsWith(prefix)) throw new Error("Clave de catálogo no válida.");
  const match = /^sha256:([a-f0-9]{64}):((?:pages\/\d{4,}|(?:search|by-id)\/[a-f0-9]{2})\.json)$/.exec(key.slice(prefix.length));
  if (!match) throw new Error("Clave de catálogo no válida.");
  return `${match[1]}/${match[2]}`;
}
