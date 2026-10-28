import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import type { StorageDatabaseUsage } from "./storageUsage";

/** AsyncStorage 2.2 Android uses RKStorage next to the app's files directory.
 * Only inspect file metadata. Never open/copy the database or its journals.
 * Expo Go, iOS and unknown layouts deliberately return unavailable, not zero.
 */
export async function measureStorageDatabaseUsage(): Promise<StorageDatabaseUsage> {
  const unavailable: StorageDatabaseUsage = { databaseBytes: null, auxiliaryBytes: null };
  if (Platform.OS !== "android") return unavailable;
  try {
    if (!/\/files\/?$/.test(Paths.document.uri)) return unavailable;
    const directory = new Directory(Paths.join(Paths.document, "..", "databases"));
    const database = new File(directory, "RKStorage");
    if (!directory.exists || !database.exists) return unavailable;
    const databaseBytes = database.size;
    if (!Number.isSafeInteger(databaseBytes) || databaseBytes < 0) return unavailable;
    let auxiliaryBytes: number | null = 0;
    for (const suffix of ["-wal", "-shm", "-journal"]) {
      const file = new File(directory, `RKStorage${suffix}`);
      if (!file.exists) continue;
      const size = file.size;
      if (!Number.isSafeInteger(size) || size < 0) { auxiliaryBytes = null; break; }
      auxiliaryBytes += size;
    }
    return { databaseBytes, auxiliaryBytes };
  } catch {
    return unavailable;
  }
}
