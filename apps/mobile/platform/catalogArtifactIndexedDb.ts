import { utf8ByteLength } from "../catalogCache";
import type { ArtifactBackend } from "./catalogArtifactStorage";

/** Public browser cache lives outside localStorage, in its own atomic store. */
export function createCatalogArtifactIndexedDb(databaseName: string): ArtifactBackend {
  let opening: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (opening) return opening;
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") { reject(new Error("La caché local no está disponible.")); return; }
      const request = indexedDB.open(databaseName, 1);
      let finished = false;
      const fail = () => { finished = true; clearTimeout(timer); reject(new Error("La caché local no está disponible.")); };
      const timer = setTimeout(fail, 5000);
      request.onupgradeneeded = () => request.result.createObjectStore("artifacts");
      request.onblocked = fail;
      request.onerror = fail;
      request.onsuccess = () => {
        if (finished) { request.result.close(); return; }
        finished = true;
        clearTimeout(timer);
        request.result.onversionchange = () => { request.result.close(); opening = null; };
        resolve(request.result);
      };
    }).catch((error: unknown) => { opening = null; throw error; });
    return opening;
  }
  async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
    const database = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = database.transaction("artifacts", mode);
      let result: T;
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(new Error("No se pudo acceder a la caché local."));
      action(tx.objectStore("artifacts"), (value) => { result = value; });
    });
  }
  const list = () => transaction<Array<{ key: string; bytes: number }>>("readonly", (store, done) => {
    const entries: Array<{ key: string; bytes: number }> = [];
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { done(entries); return; }
      if (typeof cursor.key === "string" && typeof cursor.value === "string") {
        entries.push({ key: cursor.key, bytes: utf8ByteLength(cursor.value) });
      }
      cursor.continue();
    };
  });
  return {
    get: (key) => transaction<string | null>("readonly", (store, done) => {
      const request = store.get(key);
      request.onsuccess = () => done(typeof request.result === "string" ? request.result : null);
    }),
    put: (key, value) => transaction<void>("readwrite", (store, done) => { store.put(value, key); done(); }),
    remove: (key) => transaction<void>("readwrite", (store, done) => { store.delete(key); done(); }),
    clear: () => transaction<void>("readwrite", (store, done) => { store.clear(); done(); }),
    list,
    measure: async () => {
      // Measuring an unused cache must not create a database or an object store.
      if (!opening) {
        if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
          return { bytes: null, entries: null };
        }
        if (!(await indexedDB.databases()).some((database) => database.name === databaseName)) {
          return { bytes: 0, entries: 0 };
        }
      }
      const entries = await list();
      return { entries: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0) };
    },
  };
}
