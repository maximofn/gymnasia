import { Directory, File, Paths } from "expo-file-system";
import { artifactRelativePath, CATALOG_CACHE_DIRECTORY } from "../catalogCache";
import type { ArtifactBackend } from "./catalogArtifactStorage";

export function createCatalogArtifactFiles(prefix: string, directoryName = CATALOG_CACHE_DIRECTORY): ArtifactBackend {
  const root = () => new Directory(Paths.document, directoryName);
  const fileFor = (key: string) => new File(root(), artifactRelativePath(key, prefix));
  let sequence = 0;

  function files() {
    const result: Array<{ file: File; key: string }> = [];
    const directory = root();
    if (!directory.exists) return result;
    for (const version of directory.list()) {
      if (!(version instanceof Directory) || !/^[a-f0-9]{64}$/.test(version.name)) continue;
      for (const kind of ["pages", "search", "by-id"]) {
        const folder = new Directory(version, kind);
        if (!folder.exists) continue;
        for (const file of folder.list()) {
          if (!(file instanceof File)) continue;
          const key = `${prefix}sha256:${version.name}:${kind}/${file.name}`;
          try { artifactRelativePath(key, prefix); result.push({ file, key }); } catch { /* Partial files are not artifacts. */ }
        }
      }
    }
    return result;
  }
  return {
    prepare: async () => {
      const directory = root();
      if (!directory.exists) return;
      for (const version of directory.list()) {
        if (!(version instanceof Directory) || !/^[a-f0-9]{64}$/.test(version.name)) continue;
        for (const kind of ["pages", "search", "by-id"]) {
          const folder = new Directory(version, kind);
          if (!folder.exists) continue;
          for (const file of folder.list()) {
            if (file instanceof File && /^\.partial-\d+-\d+\.tmp$/.test(file.name)) file.delete();
          }
        }
      }
    },
    get: async (key) => { const file = fileFor(key); return file.exists ? file.text() : null; },
    put: async (key, value) => {
      const destination = fileFor(key);
      if (destination.exists && await destination.text() === value) return;
      destination.parentDirectory.create({ intermediates: true, idempotent: true });
      const temporary = new File(destination.parentDirectory, `.partial-${Date.now()}-${++sequence}.tmp`);
      let committed = false;
      try {
        temporary.write(value);
        if (await temporary.text() !== value) throw new Error("No se pudo verificar la copia del catálogo.");
        // Keys are immutable (catalog hash + artifact path). A different old
        // body is corrupt; the service checks the replacement's declared hash.
        if (destination.exists) destination.delete();
        temporary.move(destination);
        committed = true;
      } finally {
        // Expo changes File.uri after move: it now points to the final file.
        if (!committed && temporary.exists) temporary.delete();
      }
    },
    remove: async (key) => { const file = fileFor(key); if (file.exists) file.delete(); },
    list: async () => files().map(({ file, key }) => ({ key, bytes: file.size })),
    clear: async () => { const directory = root(); if (directory.exists) directory.delete(); },
    measure: async () => {
      const directory = root();
      return directory.exists ? { bytes: directory.size, entries: files().length } : { bytes: 0, entries: 0 };
    },
  };
}
