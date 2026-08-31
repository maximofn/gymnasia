import { RETAINED_LEGACY_SECURE_STORE_KEYS } from "../legacySecureStorage";

export type LocalDataDeletionScope = "activity" | "all-personal";

export type LocalDataDeletionStage = "delete" | "verify" | "timeout";

export type LocalDataDeletionFailure = {
  id: string;
  label: string;
  stage: LocalDataDeletionStage;
  message: string;
};

export type LocalDataDeletionReport = {
  scope: LocalDataDeletionScope;
  status: "complete" | "incomplete";
  completedTargetIds: string[];
  failures: LocalDataDeletionFailure[];
  startedAt: number;
  completedAt: number;
};

export type LocalDataDeletionTask = {
  id: string;
  label: string;
  delete: () => Promise<void>;
  verify: () => Promise<boolean>;
};

export const LOCAL_DATA_DELETION_TIMEOUT_MS = 5_000;

export const LOCAL_DATA_MANIFEST = [
  { key: "gymnasia.mobile.local.v3", activity: "rewrite", full: "delete" },
  { key: "gymnasia.mobile.provider_configuration.v1", activity: "preserve", full: "delete" },
  { key: "gymnasia_measurement_media_v1", activity: "delete", full: "delete" },
  { key: "gymnasia.mobile.local.last_good.v1", activity: "rewrite", full: "delete" },
  { key: "gymnasia.mobile.local.quarantine.v1", activity: "delete", full: "delete" },
  { key: "gymnasia.mobile.training.session.v1", activity: "delete", full: "delete" },
  { key: "gymnasia.mobile.training.session_template_snapshot.v1", activity: "delete", full: "delete" },
  { key: "gymnasia.mobile.personal_data.v1", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.personal_foods.v1", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.user_prefs.v1", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.health_safety.consent.v1", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.alarm_health.v1", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.backup_meta.v1", activity: "preserve", full: "delete" },
  { key: "gymnasia_debug_traces", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.exercises_repo.v2", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.foods_repo.v1", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.products_repo.v1", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.recipes_repo.v1", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.signed_policy.cache.v1", activity: "preserve", full: "preserve-security" },
  { key: "gymnasia.mobile.lastUpdateCheck", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.body_fat_migration_done", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.local.v1", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.local.v2", activity: "preserve", full: "delete" },
] as const;

export const LOCAL_DATA_SECURITY_PRESERVED_KEYS = LOCAL_DATA_MANIFEST
  .filter((entry) => entry.full === "preserve-security")
  .map((entry) => entry.key);

export const LOCAL_SECURE_DATA_MANIFEST = [
  { key: "gymnasia.mobile.v4.provider_configuration", form: "literal", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.v3.provider.api_key", form: "prefix", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.v2.provider.api_key", form: "prefix", activity: "preserve", full: "delete" },
  { key: "gymnasia.mobile.provider.api_key", form: "prefix", activity: "preserve", full: "delete" },
  ...RETAINED_LEGACY_SECURE_STORE_KEYS.map((key) => ({
    key,
    form: "literal" as const,
    activity: "preserve" as const,
    full: "delete" as const,
  })),
] as const;

class DeletionTimeoutError extends Error {}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new DeletionTimeoutError("La operación tardó demasiado.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function failureMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "No se pudo completar la operación.";
}

async function runTask(
  task: LocalDataDeletionTask,
  timeoutMs: number,
): Promise<LocalDataDeletionFailure | null> {
  try {
    await withTimeout(task.delete(), timeoutMs);
  } catch (error) {
    return {
      id: task.id,
      label: task.label,
      stage: error instanceof DeletionTimeoutError ? "timeout" : "delete",
      message: failureMessage(error),
    };
  }

  try {
    const verified = await withTimeout(task.verify(), timeoutMs);
    if (!verified) {
      return {
        id: task.id,
        label: task.label,
        stage: "verify",
        message: "El dato sigue presente después del borrado.",
      };
    }
  } catch (error) {
    return {
      id: task.id,
      label: task.label,
      stage: error instanceof DeletionTimeoutError ? "timeout" : "verify",
      message: failureMessage(error),
    };
  }

  return null;
}

export async function runLocalDataDeletion(
  scope: LocalDataDeletionScope,
  tasks: LocalDataDeletionTask[],
  options: {
    timeoutMs?: number;
    now?: () => number;
  } = {},
): Promise<LocalDataDeletionReport> {
  const timeoutMs = options.timeoutMs ?? LOCAL_DATA_DELETION_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const outcomes = await Promise.all(tasks.map((task) => runTask(task, timeoutMs)));
  const failures = outcomes.filter(
    (outcome): outcome is LocalDataDeletionFailure => outcome !== null,
  );
  const failedIds = new Set(failures.map((failure) => failure.id));
  return {
    scope,
    status: failures.length === 0 ? "complete" : "incomplete",
    completedTargetIds: tasks
      .filter((task) => !failedIds.has(task.id))
      .map((task) => task.id),
    failures,
    startedAt,
    completedAt: now(),
  };
}
