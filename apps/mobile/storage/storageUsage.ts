import { CATALOG_CACHE_DIRECTORY, CATALOG_CACHE_MAX_BYTES, utf8ByteLength, type CatalogCacheUsage } from "../catalogCache";
import { LOCAL_DATA_MANIFEST } from "./localDataDeletion";

export { utf8ByteLength } from "../catalogCache";

type StorageReader = {
  getAllKeys(): Promise<readonly string[]>;
  getItem(key: string): Promise<string | null>;
};

export type MeasurementMediaUsage = {
  bytes: number | null;
  fileCount: number | null;
  availableDiskBytes: number | null;
};

export type StorageUsageRow = { id: string; label: string; bytes: number; entries: number };
export type StorageDatabaseUsage = {
  databaseBytes: number | null;
  auxiliaryBytes: number | null;
};
export type StorageUsageReport = {
  version: 3;
  measuredAt: string;
  valueBytes: number;
  measuredEntries: number;
  unreadableEntries: number;
  excludedEntries: number;
  unknownEntries: number;
  largestEntryBytes: number;
  groups: StorageUsageRow[];
  catalogSections: StorageUsageRow[];
  primaryStatus: "measured" | "missing" | "invalid" | "unreadable";
  primarySections: StorageUsageRow[];
  photos: MeasurementMediaUsage;
  database: StorageDatabaseUsage;
  artifacts: CatalogCacheUsage;
};

// Never inspect provider journals, legacy stores or quarantines that may still
// contain credentials. Unknown keys also stay unread until explicitly reviewed.
const EXCLUDED_KEYS = new Set<string>([
  "gymnasia.mobile.provider_configuration.v1",
  "gymnasia.mobile.local.v1",
  "gymnasia.mobile.local.v2",
  "gymnasia.mobile.local.quarantine.v1",
]);
const PRIMARY_KEY = "gymnasia.mobile.local.v3";
const MEDIA_KEY = "gymnasia_measurement_media_v1";
const EXERCISE_CATALOG_KEY = "gymnasia.mobile.exercise_catalog.v4";
const READ_TIMEOUT_MS = 5_000;

async function readWithTimeout<T>(read: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("No se pudo completar la medición.")), READ_TIMEOUT_MS);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

const GROUPS = {
  primary: "Datos principales",
  recovery: "Copia de recuperación",
  catalogs: "Catálogos descargados",
  session: "Sesión y borradores",
  memory: "Memoria y alimentos personales",
  diagnostics: "Trazas y diario de operaciones",
  policy: "Caché de política",
  settings: "Preferencias y otros ajustes",
} as const;

const SECTIONS: Record<string, string> = {
  templates: "Rutinas",
  workoutHistory: "Historial de entrenamientos",
  dietByDate: "Dieta",
  dietSettings: "Ajustes de dieta",
  measurements: "Mediciones y rutas de fotos",
  threads: "Metadatos de conversaciones",
  messagesByThread: "Mensajes y datos de conversaciones",
  keys: "Configuración de proveedores sin credenciales",
  chatProvider: "Selección de proveedor de chat",
  foodAIProvider: "Selección de proveedor de alimentos",
  toolOperationReceipts: "Recibos de operaciones",
};

const CATALOG_SECTIONS = {
  pages: "Páginas de ejercicios",
  search: "Índices de búsqueda de ejercicios",
  directory: "Índices por identificador de ejercicios",
  artifacts: "Otros archivos del catálogo de ejercicios",
  metadata: "Metadatos del catálogo de ejercicios",
  legacyExercises: "Catálogos de ejercicios anteriores",
  foods: "Catálogo de alimentos",
  products: "Catálogo de productos comerciales",
  recipes: "Catálogo de recetas",
} as const;

function catalogSection(key: string, artifact: boolean): keyof typeof CATALOG_SECTIONS {
  if (artifact) {
    if (/:pages\/\d+\.json$/.test(key)) return "pages";
    if (/:search\/[a-f0-9]{2}\.json$/.test(key)) return "search";
    if (/:by-id\/[a-f0-9]{2}\.json$/.test(key)) return "directory";
    return "artifacts";
  }
  if (key === EXERCISE_CATALOG_KEY) return "metadata";
  if (key.includes(".foods_repo.")) return "foods";
  if (key.includes(".products_repo.")) return "products";
  if (key.includes(".recipes_repo.")) return "recipes";
  return "legacyExercises";
}

function groupForKey(key: string): keyof typeof GROUPS {
  if (key === PRIMARY_KEY) return "primary";
  if (key.includes(".local.last_good.")) return "recovery";
  if (/\.(?:exercises_repo|exercise_catalog|foods_repo|products_repo|recipes_repo)\./.test(key)) return "catalogs";
  if (key.includes(".training.")) return "session";
  if (/\.(?:personal_data|personal_foods)\./.test(key)) return "memory";
  if (key === "gymnasia_debug_traces" || key.includes(".agent.tool_operations.")) return "diagnostics";
  if (key.includes(".signed_policy.")) return "policy";
  return "settings";
}

function sectionRows(raw: string): StorageUsageRow[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const rows: StorageUsageRow[] = [];
    let otherBytes = 0;
    for (const [key, value] of Object.entries(parsed)) {
      const bytes = utf8ByteLength(JSON.stringify(value));
      if (!Object.hasOwn(SECTIONS, key)) { otherBytes += bytes; continue; }
      rows.push({ id: key, label: SECTIONS[key], bytes,
        entries: Array.isArray(value) ? value.length
          : value !== null && typeof value === "object" ? Object.keys(value).length : 1 });
    }
    if (otherBytes) rows.push({ id: "other", label: "Otros campos", bytes: otherBytes, entries: 0 });
    return rows.sort((left, right) => right.bytes - left.bytes);
  } catch {
    return null;
  }
}

export async function measureStorageUsage(input: {
  storage: StorageReader;
  scopedKey(key: string): string;
  belongsToActiveNamespace(key: string): boolean;
  measurePhotos(): Promise<MeasurementMediaUsage>;
  measureDatabase?(): Promise<StorageDatabaseUsage>;
  measureArtifacts?(): Promise<CatalogCacheUsage>;
  now?: () => Date;
}): Promise<StorageUsageReport> {
  const report: StorageUsageReport = {
    version: 3, measuredAt: (input.now?.() ?? new Date()).toISOString(),
    valueBytes: 0, measuredEntries: 0, unreadableEntries: 0, excludedEntries: 0,
    unknownEntries: 0, largestEntryBytes: 0, groups: [], catalogSections: [],
    primaryStatus: "missing", primarySections: [],
    photos: { bytes: null, fileCount: null, availableDiskBytes: null },
    database: { databaseBytes: null, auxiliaryBytes: null },
    artifacts: { bytes: null, entries: null, maxBytes: CATALOG_CACHE_MAX_BYTES },
  };
  const knownKeys = new Map(LOCAL_DATA_MANIFEST.filter(({ key }) => key !== MEDIA_KEY && key !== CATALOG_CACHE_DIRECTORY)
    .map(({ key }) => [input.scopedKey(key), key]));
  const groups = new Map<keyof typeof GROUPS, StorageUsageRow>();
  const catalogGroups = new Map<keyof typeof CATALOG_SECTIONS, StorageUsageRow>();
  // This exact dynamic prefix is written only by the public exercise catalog
  // runtime. Do not broaden it to arbitrary application keys.
  const artifactPrefix = `${input.scopedKey(EXERCISE_CATALOG_KEY)}:artifact:`;
  // Sequential reads avoid duplicating every stored value in memory at once.
  for (const storageKey of new Set(await readWithTimeout(input.storage.getAllKeys()))) {
    if (!input.belongsToActiveNamespace(storageKey)) continue;
    const key = knownKeys.get(storageKey);
    const artifact = storageKey.startsWith(artifactPrefix) && storageKey.length > artifactPrefix.length;
    if (!key && !artifact) { report.unknownEntries += 1; continue; }
    if (key && EXCLUDED_KEYS.has(key)) { report.excludedEntries += 1; continue; }
    try {
      const raw = await readWithTimeout(input.storage.getItem(storageKey));
      if (raw === null) continue;
      const bytes = utf8ByteLength(raw);
      report.valueBytes += bytes;
      report.largestEntryBytes = Math.max(report.largestEntryBytes, bytes);
      report.measuredEntries += 1;
      const id = artifact ? "catalogs" : groupForKey(key!);
      const group = groups.get(id) ?? { id, label: GROUPS[id], bytes: 0, entries: 0 };
      group.bytes += bytes;
      group.entries += 1;
      groups.set(id, group);
      if (id === "catalogs") {
        const sectionId = catalogSection(key ?? storageKey, artifact);
        const section = catalogGroups.get(sectionId)
          ?? { id: sectionId, label: CATALOG_SECTIONS[sectionId], bytes: 0, entries: 0 };
        section.bytes += bytes;
        section.entries += 1;
        catalogGroups.set(sectionId, section);
      }
      if (key === PRIMARY_KEY) {
        const sections = sectionRows(raw);
        report.primaryStatus = sections ? "measured" : "invalid";
        report.primarySections = sections ?? [];
      }
    } catch {
      report.unreadableEntries += 1;
      if (key === PRIMARY_KEY) report.primaryStatus = "unreadable";
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  report.groups = [...groups.values()].sort((left, right) => right.bytes - left.bytes);
  report.catalogSections = [...catalogGroups.values()].sort((left, right) => right.bytes - left.bytes);
  try { report.photos = await readWithTimeout(input.measurePhotos()); } catch { /* Keep unavailable separate from zero. */ }
  try {
    if (input.measureDatabase) report.database = await readWithTimeout(input.measureDatabase());
  } catch { /* File metadata is optional; never expose paths or native errors. */ }
  try {
    if (input.measureArtifacts) report.artifacts = await readWithTimeout(input.measureArtifacts());
  } catch { /* Public cache may be unavailable without affecting user data. */ }
  return report;
}

export function formatStorageBytes(bytes: number | null): string {
  if (bytes === null) return "No disponible";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

/** Only this report schema is copied: no raw values, key names, paths or errors. */
export function formatStorageUsageReport(report: StorageUsageReport): string {
  return [
    "Gymnasia — diagnóstico de almacenamiento",
    `Fecha: ${report.measuredAt}`,
    `Valores medidos (UTF-8): ${report.valueBytes} bytes`,
    `Entradas medidas: ${report.measuredEntries}`,
    `Entrada más grande: ${report.largestEntryBytes} bytes`,
    `Entradas no leídas por privacidad: ${report.excludedEntries}`,
    `Entradas desconocidas sin leer: ${report.unknownEntries}`,
    `Lecturas fallidas: ${report.unreadableEntries}`,
    "",
    ...report.groups.map((row) => `${row.label}: ${row.bytes} bytes (${row.entries} entradas)`),
    "", "Desglose de catálogos (incluido en el total):",
    ...report.catalogSections.map((row) => `${row.label}: ${row.bytes} bytes (${row.entries} entradas)`),
    "", `Archivo SQLite: ${report.database.databaseBytes ?? "no disponible"} bytes`,
    `Archivos auxiliares SQLite: ${report.database.auxiliaryBytes ?? "no disponible"} bytes`,
    "", `Desglose del registro principal: ${report.primaryStatus}`,
    ...report.primarySections.map((row) => `${row.label}: ${row.bytes} bytes`),
    "", `Caché pública separada: ${report.artifacts.bytes ?? "no disponible"} bytes`,
    `Archivos públicos: ${report.artifacts.entries ?? "no disponible"}`,
    `Límite de caché pública: ${report.artifacts.maxBytes} bytes`,
    "", `Archivos de fotos: ${report.photos.bytes ?? "no disponible"} bytes`,
    `Número de archivos de fotos: ${report.photos.fileCount ?? "no disponible"}`,
    `Espacio libre del dispositivo: ${report.photos.availableDiskBytes ?? "no disponible"} bytes`,
    "",
    "Medición parcial de valores, no del archivo SQLite ni de su cuota: excluye credenciales, almacenes heredados, cuarentena y claves desconocidas.",
    "Los desgloses de catálogos y del registro principal no se suman al total. El principal serializa cada campo por separado. La caché pública separada, las fotos y los archivos SQLite se miden aparte. Las lecturas no son una instantánea atómica.",
  ].join("\n");
}
