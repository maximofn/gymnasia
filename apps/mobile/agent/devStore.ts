import devStorePolicy from "../dev-store/policy.json";

const sensitiveFieldNames = new Set<string>(devStorePolicy.sensitiveFieldNames);

export const DEV_STORE_MIRROR_ENV_VAR = devStorePolicy.enabledEnvVar;

export function isDevStoreMirrorEnabled(): boolean {
  return process.env.EXPO_PUBLIC_DEV_STORE_MIRROR === "1";
}

function sanitizeValue(value: unknown, ancestors: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError("El estado del espejo no puede contener referencias circulares.");
    }
    ancestors.add(value);
    const sanitized = value.map((item) => sanitizeValue(item, ancestors));
    ancestors.delete(value);
    return sanitized;
  }

  if (!value || typeof value !== "object") return value;
  if (ancestors.has(value)) {
    throw new TypeError("El estado del espejo no puede contener referencias circulares.");
  }

  ancestors.add(value);
  const sanitized = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveFieldNames.has(key.toLowerCase())
        ? ""
        : sanitizeValue(entry, ancestors),
    ]),
  );
  ancestors.delete(value);
  return sanitized;
}

export function sanitizeDevStoreValue<T>(value: T): T {
  return sanitizeValue(value, new WeakSet<object>()) as T;
}

export function serializeDevStore(value: unknown): string {
  return JSON.stringify(sanitizeDevStoreValue(value));
}
