export const LOCAL_STORE_RECOVERY_RECORD_VERSION = 1 as const;

export const LOCAL_STORE_ROOT_FIELDS = [
  "templates",
  "workoutHistory",
  "dietByDate",
  "dietSettings",
  "measurements",
  "threads",
  "messagesByThread",
  "keys",
  "chatProvider",
  "foodAIProvider",
] as const;

export type LocalStoreValidationIssue = {
  path: string;
  code:
    | "expected_object"
    | "expected_array"
    | "expected_string"
    | "expected_number"
    | "expected_boolean"
    | "unknown_root_field"
    | "invalid_provider"
    | "invalid_json"
    | "normalization_failed"
    | "storage_read_failed"
    | "primary_missing"
    | "commit_verification_failed";
  message: string;
};

export type LocalStoreCorruptionCause =
  | "invalid_json"
  | "invalid_shape"
  | "storage_read_failed"
  | "primary_missing"
  | "commit_verification_failed";

export type LocalStoreSource = "primary" | "dev_store" | "unavailable";

export type ValidLocalStoreTree = Record<string, unknown>;

export type RecoverySnapshotRecord = {
  version: typeof LOCAL_STORE_RECOVERY_RECORD_VERSION;
  createdAt: string;
  payload: string;
  sha256: string;
};

export type RecoveryQuarantineRecord = {
  version: typeof LOCAL_STORE_RECOVERY_RECORD_VERSION;
  capturedAt: string;
  source: LocalStoreSource;
  cause: LocalStoreCorruptionCause;
  rawPayload: string | null;
  sha256: string | null;
  issues: LocalStoreValidationIssue[];
};

export type ValidLocalStoreCandidate = {
  raw: string;
  value: ValidLocalStoreTree;
  source: Exclude<LocalStoreSource, "unavailable">;
};

export type LocalStoreHydrationOutcome =
  | { status: "empty" }
  | { status: "valid"; candidate: ValidLocalStoreCandidate }
  | {
      status: "recoverable";
      quarantine: RecoveryQuarantineRecord;
      snapshot: ValidLocalStoreCandidate | null;
      currentValid: boolean;
    }
  | {
      status: "corrupt";
      quarantine: RecoveryQuarantineRecord;
    };

export type StringStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type LocalStoreRecoveryKeys = {
  primary: string;
  snapshot: string;
  quarantine: string;
};

export type LocalStoreRecoveryDependencies = {
  storage: StringStorage;
  keys: LocalStoreRecoveryKeys;
  sha256(value: string): Promise<string>;
  now?: () => Date;
};

type ParsedLocalStoreRaw =
  | { ok: true; value: ValidLocalStoreTree }
  | {
      ok: false;
      cause: "invalid_json" | "invalid_shape";
      issues: LocalStoreValidationIssue[];
    };

const PROVIDERS = new Set(["openai", "anthropic", "google"]);
const ROOT_FIELD_SET = new Set<string>(LOCAL_STORE_ROOT_FIELDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pushIssue(
  issues: LocalStoreValidationIssue[],
  path: string,
  code: LocalStoreValidationIssue["code"],
  message: string,
): void {
  issues.push({ path, code, message });
}

function validateOptionalScalar(
  value: Record<string, unknown>,
  key: string,
  path: string,
  expected: "string" | "number" | "boolean",
  issues: LocalStoreValidationIssue[],
): void {
  const candidate = value[key];
  if (candidate === undefined || candidate === null) return;
  if (typeof candidate !== expected) {
    pushIssue(
      issues,
      `${path}.${key}`,
      expected === "string"
        ? "expected_string"
        : expected === "number"
          ? "expected_number"
          : "expected_boolean",
      `El campo ${key} tiene un tipo incompatible.`,
    );
  }
}

function validateRecordArray(
  value: unknown,
  path: string,
  issues: LocalStoreValidationIssue[],
  validateEntry?: (
    entry: Record<string, unknown>,
    entryPath: string,
    issues: LocalStoreValidationIssue[],
  ) => void,
): void {
  if (!Array.isArray(value)) {
    pushIssue(issues, path, "expected_array", "Se esperaba una lista.");
    return;
  }
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isRecord(entry)) {
      pushIssue(issues, entryPath, "expected_object", "Se esperaba un registro.");
      return;
    }
    validateEntry?.(entry, entryPath, issues);
  });
}

function validateExercise(
  exercise: Record<string, unknown>,
  path: string,
  issues: LocalStoreValidationIssue[],
): void {
  ["id", "name", "image_uri", "muscle"].forEach((key) =>
    validateOptionalScalar(exercise, key, path, "string", issues),
  );
  ["load_kg", "rest_seconds"].forEach((key) =>
    validateOptionalScalar(exercise, key, path, "number", issues),
  );

  if (exercise.sets !== undefined && exercise.sets !== null) {
    if (!Array.isArray(exercise.sets)) {
      pushIssue(issues, `${path}.sets`, "expected_array", "Se esperaba una lista de series.");
    } else {
      exercise.sets.forEach((setValue, index) => {
        if (typeof setValue !== "number") {
          pushIssue(
            issues,
            `${path}.sets[${index}]`,
            "expected_number",
            "La repetición heredada debe ser numérica.",
          );
        }
      });
    }
  }

  if (exercise.series !== undefined && exercise.series !== null) {
    validateRecordArray(exercise.series, `${path}.series`, issues, (series, seriesPath) => {
      ["id", "reps", "weight_kg", "rest_seconds"].forEach((key) =>
        validateOptionalScalar(series, key, seriesPath, "string", issues),
      );
    });
  }
}

function validateTemplate(
  template: Record<string, unknown>,
  path: string,
  issues: LocalStoreValidationIssue[],
): void {
  ["id", "name", "duration_minutes", "category", "icon"].forEach((key) =>
    validateOptionalScalar(template, key, path, "string", issues),
  );
  if (template.exercises !== undefined && template.exercises !== null) {
    validateRecordArray(template.exercises, `${path}.exercises`, issues, validateExercise);
  }
}

function validateDietByDate(
  value: unknown,
  path: string,
  issues: LocalStoreValidationIssue[],
): void {
  if (!isRecord(value)) {
    pushIssue(issues, path, "expected_object", "Se esperaba un registro de dieta por fecha.");
    return;
  }
  Object.values(value).forEach((day) => {
    const dayPath = `${path}[*]`;
    if (!isRecord(day)) {
      pushIssue(issues, dayPath, "expected_object", "Se esperaba un día de dieta.");
      return;
    }
    validateOptionalScalar(day, "day_date", dayPath, "string", issues);
    if (day.meals === undefined || day.meals === null) return;
    validateRecordArray(day.meals, `${dayPath}.meals`, issues, (meal, mealPath) => {
      ["id", "title"].forEach((key) =>
        validateOptionalScalar(meal, key, mealPath, "string", issues),
      );
      if (meal.items === undefined || meal.items === null) return;
      validateRecordArray(meal.items, `${mealPath}.items`, issues, (item, itemPath) => {
        ["id", "title"].forEach((key) =>
          validateOptionalScalar(item, key, itemPath, "string", issues),
        );
      });
    });
  });
}

function validateMessagesByThread(
  value: unknown,
  path: string,
  issues: LocalStoreValidationIssue[],
): void {
  if (!isRecord(value)) {
    pushIssue(issues, path, "expected_object", "Se esperaba un registro de mensajes.");
    return;
  }
  Object.values(value).forEach((messages) => {
    validateRecordArray(messages, `${path}[*]`, issues, (message, messagePath) => {
      ["id", "role", "content", "kind", "thinking", "created_at"].forEach((key) =>
        validateOptionalScalar(message, key, messagePath, "string", issues),
      );
      validateOptionalScalar(message, "is_streaming", messagePath, "boolean", issues);
    });
  });
}

function validateProviderKey(
  value: Record<string, unknown>,
  path: string,
  issues: LocalStoreValidationIssue[],
): void {
  ["provider", "api_key", "model", "workspace_id", "reasoning_effort"].forEach((key) =>
    validateOptionalScalar(value, key, path, "string", issues),
  );
  validateOptionalScalar(value, "is_active", path, "boolean", issues);
  if (value.provider !== undefined && !PROVIDERS.has(value.provider as string)) {
    pushIssue(issues, `${path}.provider`, "invalid_provider", "El proveedor no es compatible.");
  }
}

export function migrateLocalStoreTree(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    templates: value.templates ?? [],
    workoutHistory: value.workoutHistory ?? [],
    dietByDate: value.dietByDate ?? {},
    dietSettings: value.dietSettings ?? {},
    measurements: value.measurements ?? [],
    threads: value.threads ?? [],
    messagesByThread: value.messagesByThread ?? {},
    keys: value.keys ?? [],
  };
}

export function validateLocalStoreTree(value: unknown): LocalStoreValidationIssue[] {
  const issues: LocalStoreValidationIssue[] = [];
  if (!isRecord(value)) {
    pushIssue(issues, "$", "expected_object", "El almacenamiento principal no es un objeto.");
    return issues;
  }

  Object.keys(value).forEach((key) => {
    if (!ROOT_FIELD_SET.has(key)) {
      pushIssue(
        issues,
        "$[unknown]",
        "unknown_root_field",
        "El almacenamiento contiene un campo raíz desconocido.",
      );
    }
  });

  validateRecordArray(value.templates, "$.templates", issues, validateTemplate);
  validateRecordArray(value.workoutHistory, "$.workoutHistory", issues);
  validateDietByDate(value.dietByDate, "$.dietByDate", issues);
  if (!isRecord(value.dietSettings)) {
    pushIssue(issues, "$.dietSettings", "expected_object", "Se esperaban ajustes de dieta.");
  }
  validateRecordArray(value.measurements, "$.measurements", issues);
  validateRecordArray(value.threads, "$.threads", issues, (thread, threadPath) => {
    ["id", "title"].forEach((key) =>
      validateOptionalScalar(thread, key, threadPath, "string", issues),
    );
  });
  validateMessagesByThread(value.messagesByThread, "$.messagesByThread", issues);
  validateRecordArray(value.keys, "$.keys", issues, validateProviderKey);

  ["chatProvider", "foodAIProvider"].forEach((key) => {
    if (value[key] === undefined || value[key] === null) return;
    if (typeof value[key] !== "string") {
      pushIssue(issues, `$.${key}`, "expected_string", "El proveedor debe ser texto.");
    } else if (!PROVIDERS.has(value[key] as string)) {
      pushIssue(issues, `$.${key}`, "invalid_provider", "El proveedor no es compatible.");
    }
  });

  return issues;
}

export function parseLocalStoreRaw(raw: string): ParsedLocalStoreRaw {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      cause: "invalid_json",
      issues: [
        {
          path: "$",
          code: "invalid_json",
          message: "El almacenamiento principal no contiene JSON válido.",
        },
      ],
    };
  }

  const migrated = migrateLocalStoreTree(parsed);
  const issues = validateLocalStoreTree(migrated);
  if (issues.length > 0) {
    return { ok: false, cause: "invalid_shape", issues };
  }
  return { ok: true, value: migrated as ValidLocalStoreTree };
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export async function createRecoverySnapshot(
  payload: string,
  sha256: LocalStoreRecoveryDependencies["sha256"],
  now = new Date(),
): Promise<RecoverySnapshotRecord> {
  const parsed = parseLocalStoreRaw(payload);
  if (!parsed.ok) throw new Error("No se puede guardar un snapshot inválido.");
  return {
    version: LOCAL_STORE_RECOVERY_RECORD_VERSION,
    createdAt: now.toISOString(),
    payload,
    sha256: await sha256(payload),
  };
}

export async function parseRecoverySnapshot(
  raw: string | null,
  sha256: LocalStoreRecoveryDependencies["sha256"],
): Promise<RecoverySnapshotRecord | null> {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RecoverySnapshotRecord>;
    if (
      parsed.version !== LOCAL_STORE_RECOVERY_RECORD_VERSION
      || typeof parsed.createdAt !== "string"
      || typeof parsed.payload !== "string"
      || !isSha256(parsed.sha256)
      || await sha256(parsed.payload) !== parsed.sha256
      || !parseLocalStoreRaw(parsed.payload).ok
    ) {
      return null;
    }
    return parsed as RecoverySnapshotRecord;
  } catch {
    return null;
  }
}

export async function createRecoveryQuarantine(
  input: Omit<RecoveryQuarantineRecord, "version" | "capturedAt" | "sha256">,
  sha256: LocalStoreRecoveryDependencies["sha256"],
  now = new Date(),
): Promise<RecoveryQuarantineRecord> {
  return {
    version: LOCAL_STORE_RECOVERY_RECORD_VERSION,
    capturedAt: now.toISOString(),
    source: input.source,
    cause: input.cause,
    rawPayload: input.rawPayload,
    sha256: input.rawPayload === null ? null : await sha256(input.rawPayload),
    issues: input.issues.map(({ path, code, message }) => ({ path, code, message })),
  };
}

export function parseRecoveryQuarantine(raw: string | null): RecoveryQuarantineRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RecoveryQuarantineRecord>;
    if (
      parsed.version !== LOCAL_STORE_RECOVERY_RECORD_VERSION
      || typeof parsed.capturedAt !== "string"
      || !["primary", "dev_store", "unavailable"].includes(parsed.source ?? "")
      || ![
        "invalid_json",
        "invalid_shape",
        "storage_read_failed",
        "primary_missing",
        "commit_verification_failed",
      ].includes(parsed.cause ?? "")
      || (parsed.rawPayload !== null && typeof parsed.rawPayload !== "string")
      || (parsed.sha256 !== null && !isSha256(parsed.sha256))
      || !Array.isArray(parsed.issues)
    ) {
      return null;
    }
    return parsed as RecoveryQuarantineRecord;
  } catch {
    return null;
  }
}

export class LocalStoreRecoveryLockedError extends Error {
  constructor() {
    super("El almacenamiento está bloqueado hasta completar la recuperación.");
    this.name = "LocalStoreRecoveryLockedError";
  }
}

export class LocalStoreCommitAmbiguousError extends Error {
  constructor() {
    super("No se pudo verificar la escritura del almacenamiento local.");
    this.name = "LocalStoreCommitAmbiguousError";
  }
}

export class LocalStoreSnapshotWriteError extends Error {
  constructor() {
    super("Los datos se guardaron, pero no se pudo actualizar la copia de recuperación.");
    this.name = "LocalStoreSnapshotWriteError";
  }
}

export class LocalStoreRecoveryRepository {
  private readonly storage: StringStorage;
  private readonly keys: LocalStoreRecoveryKeys;
  private readonly sha256: LocalStoreRecoveryDependencies["sha256"];
  private readonly now: () => Date;
  private queue: Promise<void> = Promise.resolve();

  constructor({ storage, keys, sha256, now = () => new Date() }: LocalStoreRecoveryDependencies) {
    this.storage = storage;
    this.keys = keys;
    this.sha256 = sha256;
    this.now = now;
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release: () => void = () => {};
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async readValidSnapshot(): Promise<RecoverySnapshotRecord | null> {
    try {
      return await parseRecoverySnapshot(await this.storage.getItem(this.keys.snapshot), this.sha256);
    } catch {
      return null;
    }
  }

  private async readQuarantine(): Promise<RecoveryQuarantineRecord | null> {
    try {
      const record = parseRecoveryQuarantine(await this.storage.getItem(this.keys.quarantine));
      if (!record) return null;
      if (
        record.rawPayload !== null
        && record.sha256 !== await this.sha256(record.rawPayload)
      ) {
        return null;
      }
      return record;
    } catch {
      return null;
    }
  }

  private async ensureQuarantine(
    input: Omit<RecoveryQuarantineRecord, "version" | "capturedAt" | "sha256">,
  ): Promise<RecoveryQuarantineRecord> {
    const existing = await this.readQuarantine();
    if (existing) return existing;
    const record = await createRecoveryQuarantine(input, this.sha256, this.now());
    try {
      await this.storage.setItem(this.keys.quarantine, JSON.stringify(record));
    } catch {
      // The in-memory record still keeps the app blocked even when storage itself is unavailable.
    }
    return record;
  }

  private async snapshotCandidate(): Promise<ValidLocalStoreCandidate | null> {
    const snapshot = await this.readValidSnapshot();
    if (!snapshot) return null;
    const parsed = parseLocalStoreRaw(snapshot.payload);
    if (!parsed.ok) return null;
    return { raw: snapshot.payload, value: parsed.value, source: "primary" };
  }

  private async assertPrimaryIsSafeToReplace(): Promise<void> {
    if (await this.readQuarantine()) {
      throw new LocalStoreRecoveryLockedError();
    }

    let currentRaw: string | null;
    try {
      currentRaw = await this.storage.getItem(this.keys.primary);
    } catch {
      await this.ensureQuarantine({
        source: "unavailable",
        cause: "storage_read_failed",
        rawPayload: null,
        issues: [{
          path: "$",
          code: "storage_read_failed",
          message: "No se pudo comprobar el almacenamiento antes de escribir.",
        }],
      });
      throw new LocalStoreRecoveryLockedError();
    }

    if (currentRaw === null) {
      if (await this.readValidSnapshot()) {
        await this.ensureQuarantine({
          source: "unavailable",
          cause: "primary_missing",
          rawPayload: null,
          issues: [{
            path: "$",
            code: "primary_missing",
            message: "El almacenamiento principal desapareció antes de escribir.",
          }],
        });
        throw new LocalStoreRecoveryLockedError();
      }
      return;
    }

    const current = parseLocalStoreRaw(currentRaw);
    if (current.ok) return;
    await this.ensureQuarantine({
      source: "primary",
      cause: current.cause,
      rawPayload: currentRaw,
      issues: current.issues,
    });
    throw new LocalStoreRecoveryLockedError();
  }

  async inspect(options: {
    fallbackRaw?: string | null;
    honorExistingQuarantine?: boolean;
  } = {}): Promise<LocalStoreHydrationOutcome> {
    const honorExistingQuarantine = options.honorExistingQuarantine ?? true;
    const existingQuarantine = await this.readQuarantine();
    let primaryRaw: string | null;
    try {
      primaryRaw = await this.storage.getItem(this.keys.primary);
    } catch {
      const quarantine = existingQuarantine ?? await this.ensureQuarantine({
        source: "unavailable",
        cause: "storage_read_failed",
        rawPayload: null,
        issues: [{
          path: "$",
          code: "storage_read_failed",
          message: "No se pudo leer el almacenamiento principal.",
        }],
      });
      const snapshot = await this.snapshotCandidate();
      return snapshot
        ? { status: "recoverable", quarantine, snapshot, currentValid: false }
        : { status: "corrupt", quarantine };
    }

    const effectiveRaw = primaryRaw ?? options.fallbackRaw ?? null;
    const source: Exclude<LocalStoreSource, "unavailable"> = primaryRaw === null
      ? "dev_store"
      : "primary";

    if (effectiveRaw === null) {
      const snapshot = await this.snapshotCandidate();
      if (!existingQuarantine && !snapshot) return { status: "empty" };
      const quarantine = existingQuarantine ?? await this.ensureQuarantine({
        source: "unavailable",
        cause: "primary_missing",
        rawPayload: null,
        issues: [{
          path: "$",
          code: "primary_missing",
          message: "Falta el almacenamiento principal, pero existe una copia anterior.",
        }],
      });
      return snapshot
        ? { status: "recoverable", quarantine, snapshot, currentValid: false }
        : { status: "corrupt", quarantine };
    }

    const parsed = parseLocalStoreRaw(effectiveRaw);
    if (parsed.ok) {
      if (existingQuarantine && honorExistingQuarantine) {
        return {
          status: "recoverable",
          quarantine: existingQuarantine,
          snapshot: await this.snapshotCandidate(),
          currentValid: true,
        };
      }
      return {
        status: "valid",
        candidate: { raw: effectiveRaw, value: parsed.value, source },
      };
    }

    const quarantine = existingQuarantine ?? await this.ensureQuarantine({
      source,
      cause: parsed.cause,
      rawPayload: effectiveRaw,
      issues: parsed.issues,
    });
    const snapshot = await this.snapshotCandidate();
    return snapshot
      ? { status: "recoverable", quarantine, snapshot, currentValid: false }
      : { status: "corrupt", quarantine };
  }

  private async commitUnlocked(raw: string, allowRecoveryResolution: boolean): Promise<void> {
    const parsed = parseLocalStoreRaw(raw);
    if (!parsed.ok) throw new Error("Se intentó guardar un LocalStore inválido.");
    if (!allowRecoveryResolution) await this.assertPrimaryIsSafeToReplace();

    await this.storage.setItem(this.keys.primary, raw);
    let written: string | null = null;
    try {
      written = await this.storage.getItem(this.keys.primary);
    } catch {
      // handled as an ambiguous commit below
    }
    if (written !== raw || !parseLocalStoreRaw(written ?? "").ok) {
      await this.ensureQuarantine({
        source: written === null ? "unavailable" : "primary",
        cause: "commit_verification_failed",
        rawPayload: written ?? raw,
        issues: [{
          path: "$",
          code: "commit_verification_failed",
          message: "La escritura no pudo verificarse de forma segura.",
        }],
      });
      throw new LocalStoreCommitAmbiguousError();
    }

    const snapshot = await createRecoverySnapshot(raw, this.sha256, this.now());
    try {
      await this.storage.setItem(this.keys.snapshot, JSON.stringify(snapshot));
    } catch {
      throw new LocalStoreSnapshotWriteError();
    }
  }

  async commit(raw: string): Promise<void> {
    return this.runExclusive(() => this.commitUnlocked(raw, false));
  }

  async resolveCurrent(raw: string): Promise<void> {
    return this.runExclusive(async () => {
      await this.commitUnlocked(raw, true);
      await this.storage.removeItem(this.keys.quarantine);
    });
  }

  async restoreSnapshot(): Promise<ValidLocalStoreCandidate> {
    return this.runExclusive(async () => {
      const candidate = await this.snapshotCandidate();
      if (!candidate) throw new Error("La última copia íntegra ya no está disponible.");
      await this.commitUnlocked(candidate.raw, true);
      await this.storage.removeItem(this.keys.quarantine);
      return candidate;
    });
  }

  async discardAffected(initialRaw: string, dependentKeys: string[]): Promise<void> {
    return this.runExclusive(async () => {
      await Promise.all([
        this.storage.removeItem(this.keys.primary),
        this.storage.removeItem(this.keys.snapshot),
        this.storage.removeItem(this.keys.quarantine),
        ...dependentKeys.map((key) => this.storage.removeItem(key)),
      ]);
      await this.commitUnlocked(initialRaw, true);
    });
  }

  async getQuarantine(): Promise<RecoveryQuarantineRecord | null> {
    return this.readQuarantine();
  }

  async quarantineUnexpectedNormalization(
    rawPayload: string,
    source: Exclude<LocalStoreSource, "unavailable">,
  ): Promise<RecoveryQuarantineRecord> {
    return this.runExclusive(() => this.ensureQuarantine({
      source,
      cause: "invalid_shape",
      rawPayload,
      issues: [{
        path: "$",
        code: "normalization_failed",
        message: "La estructura no pudo normalizarse de forma segura.",
      }],
    }));
  }
}
