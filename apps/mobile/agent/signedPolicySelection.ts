import type {
  PolicyChannelName,
  SignedPolicyPackage,
  VerifiedSignedPolicy,
} from "./signedPolicy";

export const SIGNED_POLICY_CACHE_SCHEMA_VERSION = 2 as const;

export type PolicyBoundary = "background" | "new-conversation" | "turn";

export type SignedPolicySource =
  | "remote"
  | "cache-active"
  | "cache-previous"
  | "bundled";

export type SignedPolicySelection = VerifiedSignedPolicy & {
  source: SignedPolicySource;
};

export type PolicyCheckOutcome =
  | "verified"
  | "offline"
  | "rejected"
  | "storage-error";

export type PolicyDegradation =
  | "none"
  | "offline"
  | "invalid-remote"
  | "storage-error"
  | "cache-recovery";

export type PolicyFailureCode =
  | "anti-rollback"
  | "invalid-cache-record"
  | "network-or-resolution"
  | "signature-or-contract"
  | "storage-read"
  | "storage-write";

export type PolicyRuntimeIdentity = {
  activationId: string;
  action: "activate" | "rollback";
  bundleSha256: string;
  candidate: string;
  critical: boolean;
  issuedAt: string;
  sequence: number;
  source: SignedPolicySource;
  version: string;
};

export type PolicyRuntimeStatus = {
  active: PolicyRuntimeIdentity;
  activeSince: string | null;
  channel: PolicyChannelName | "Local";
  degradation: PolicyDegradation;
  environment: string;
  lastCheckedAt: string | null;
  lastCheckOutcome: PolicyCheckOutcome;
  lastFailureCode: PolicyFailureCode | null;
  pending: PolicyRuntimeIdentity | null;
  propagationMs: number | null;
  state: "active" | "pending" | "degraded";
};

export type SignedPolicyResolution = {
  selection: SignedPolicySelection;
  status: PolicyRuntimeStatus;
};

export type SignedPolicyDiagnostic = {
  event:
    | "cache-migrated"
    | "cache-read-error"
    | "cache-rejected"
    | "cache-write-error"
    | "pending-activated"
    | "remote-rejected"
    | "remote-unavailable"
    | "selected"
    | "update-pending";
  boundary: PolicyBoundary;
  candidate?: string;
  reasonCode?: PolicyFailureCode;
  sequence?: number;
  source: SignedPolicySource | "cache" | "remote";
};

export function signedPolicyDiagnosticPayload(
  diagnostic: SignedPolicyDiagnostic,
): Record<string, number | string> {
  const payload: Record<string, number | string> = {
    boundary: diagnostic.boundary,
    source: diagnostic.source,
  };
  if (diagnostic.candidate !== undefined) payload.candidate = diagnostic.candidate;
  if (diagnostic.reasonCode !== undefined) payload.reasonCode = diagnostic.reasonCode;
  if (diagnostic.sequence !== undefined) payload.sequence = diagnostic.sequence;
  return payload;
}

type SignedPolicyCacheRecordV1 = {
  schemaVersion: 1;
  environment: string;
  channel: PolicyChannelName;
  highestSequence: number;
  highestActivationId: string;
  current: SignedPolicyPackage | null;
  previous: SignedPolicyPackage | null;
};

type SignedPolicyCacheRecord = {
  schemaVersion: typeof SIGNED_POLICY_CACHE_SCHEMA_VERSION;
  environment: string;
  channel: PolicyChannelName;
  highestSequence: number;
  highestActivationId: string;
  active: SignedPolicyPackage | null;
  previous: SignedPolicyPackage | null;
  pending: SignedPolicyPackage | null;
  activeSince: string | null;
  lastCheckedAt: string | null;
  lastCheckOutcome: PolicyCheckOutcome;
  lastFailureCode: PolicyFailureCode | null;
};

export type SignedPolicySelectionDependencies = {
  fetchRemote: () => Promise<SignedPolicyPackage>;
  readCache: () => Promise<string | null>;
  writeCache: (value: string) => Promise<void>;
  verify: (packageValue: unknown) => VerifiedSignedPolicy;
  bundled: SignedPolicyPackage;
  scope: {
    environment: string;
    channel: PolicyChannelName;
  };
  diagnostic?: (entry: SignedPolicyDiagnostic) => void;
  now?: () => number;
};

function emit(
  dependencies: SignedPolicySelectionDependencies,
  entry: SignedPolicyDiagnostic,
): void {
  try {
    dependencies.diagnostic?.(entry);
  } catch {
    // Los diagnósticos locales nunca deben cambiar la selección de política.
  }
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function isPackageOrNull(value: unknown): boolean {
  return value === null || (typeof value === "object" && !Array.isArray(value));
}

function hasValidCacheHeader(
  record: Record<string, unknown>,
  scope: SignedPolicySelectionDependencies["scope"],
): boolean {
  return record.environment === scope.environment
    && record.channel === scope.channel
    && Number.isSafeInteger(record.highestSequence)
    && Number(record.highestSequence) >= 1
    && typeof record.highestActivationId === "string"
    && /^activation-[a-f0-9]{32}$/.test(record.highestActivationId);
}

function exactCacheRecordV1(
  value: unknown,
  scope: SignedPolicySelectionDependencies["scope"],
): SignedPolicyCacheRecordV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    !hasExactKeys(record, [
      "channel",
      "current",
      "environment",
      "highestActivationId",
      "highestSequence",
      "previous",
      "schemaVersion",
    ])
    || record.schemaVersion !== 1
    || !hasValidCacheHeader(record, scope)
    || !isPackageOrNull(record.current)
    || !isPackageOrNull(record.previous)
  ) {
    return null;
  }
  return record as SignedPolicyCacheRecordV1;
}

function exactCacheRecord(
  value: unknown,
  scope: SignedPolicySelectionDependencies["scope"],
): SignedPolicyCacheRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    !hasExactKeys(record, [
      "active",
      "activeSince",
      "channel",
      "environment",
      "highestActivationId",
      "highestSequence",
      "lastCheckedAt",
      "lastCheckOutcome",
      "lastFailureCode",
      "pending",
      "previous",
      "schemaVersion",
    ])
    || record.schemaVersion !== SIGNED_POLICY_CACHE_SCHEMA_VERSION
    || !hasValidCacheHeader(record, scope)
    || !isPackageOrNull(record.active)
    || !isPackageOrNull(record.previous)
    || !isPackageOrNull(record.pending)
    || (record.activeSince !== null && typeof record.activeSince !== "string")
    || (record.lastCheckedAt !== null && typeof record.lastCheckedAt !== "string")
    || !["verified", "offline", "rejected", "storage-error"].includes(
      String(record.lastCheckOutcome),
    )
    || (
      record.lastFailureCode !== null
      && ![
        "anti-rollback",
        "invalid-cache-record",
        "network-or-resolution",
        "signature-or-contract",
        "storage-read",
        "storage-write",
      ].includes(String(record.lastFailureCode))
    )
  ) {
    return null;
  }
  return record as SignedPolicyCacheRecord;
}

function emptyCache(
  dependencies: SignedPolicySelectionDependencies,
  bundled: SignedPolicySelection,
): SignedPolicyCacheRecord {
  return {
    schemaVersion: SIGNED_POLICY_CACHE_SCHEMA_VERSION,
    environment: dependencies.scope.environment,
    channel: dependencies.scope.channel,
    highestSequence: bundled.activation.sequence,
    highestActivationId: bundled.activation.id,
    active: bundled.package,
    previous: null,
    pending: null,
    activeSince: bundled.activation.issuedAt,
    lastCheckedAt: null,
    lastCheckOutcome: "offline",
    lastFailureCode: null,
  };
}

async function readCache(
  dependencies: SignedPolicySelectionDependencies,
  bundled: SignedPolicySelection,
  boundary: PolicyBoundary,
): Promise<{ record: SignedPolicyCacheRecord; migration: boolean; readFailed: boolean }> {
  let raw: string | null;
  try {
    raw = await dependencies.readCache();
  } catch {
    emit(dependencies, {
      boundary,
      event: "cache-read-error",
      source: "cache",
      reasonCode: "storage-read",
    });
    return { record: emptyCache(dependencies, bundled), migration: false, readFailed: true };
  }
  if (!raw) {
    return { record: emptyCache(dependencies, bundled), migration: false, readFailed: false };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const current = exactCacheRecord(parsed, dependencies.scope);
    if (current) return { record: current, migration: false, readFailed: false };
    const legacy = exactCacheRecordV1(parsed, dependencies.scope);
    if (legacy) {
      emit(dependencies, { boundary, event: "cache-migrated", source: "cache" });
      return {
        migration: true,
        readFailed: false,
        record: {
          schemaVersion: SIGNED_POLICY_CACHE_SCHEMA_VERSION,
          environment: legacy.environment,
          channel: legacy.channel,
          highestSequence: legacy.highestSequence,
          highestActivationId: legacy.highestActivationId,
          active: legacy.current,
          previous: legacy.previous,
          pending: null,
          activeSince: null,
          lastCheckedAt: null,
          lastCheckOutcome: "offline",
          lastFailureCode: null,
        },
      };
    }
  } catch {
    // Se diagnostica igual que cualquier registro estructuralmente inválido.
  }
  emit(dependencies, {
    boundary,
    event: "cache-rejected",
    source: "cache",
    reasonCode: "invalid-cache-record",
  });
  return { record: emptyCache(dependencies, bundled), migration: false, readFailed: false };
}

function safeVerify(
  dependencies: SignedPolicySelectionDependencies,
  packageValue: unknown,
  source: "cache-active" | "cache-previous" | "bundled",
  boundary: PolicyBoundary,
): SignedPolicySelection | null {
  try {
    const verified = dependencies.verify(packageValue);
    return { ...verified, source };
  } catch {
    emit(dependencies, {
      boundary,
      event: "cache-rejected",
      source,
      reasonCode: "signature-or-contract",
    });
    return null;
  }
}

function mayActivate(value: VerifiedSignedPolicy, boundary: PolicyBoundary): boolean {
  if (boundary === "new-conversation") return true;
  return boundary === "turn"
    && (value.bundle.critical || value.activation.action === "rollback");
}

function identity(value: SignedPolicySelection): PolicyRuntimeIdentity {
  return {
    activationId: value.activation.id,
    action: value.activation.action,
    bundleSha256: value.activation.bundleSha256,
    candidate: value.bundle.id,
    critical: value.bundle.critical,
    issuedAt: value.activation.issuedAt,
    sequence: value.activation.sequence,
    source: value.source,
    version: value.bundle.version,
  };
}

function selectCached(
  dependencies: SignedPolicySelectionDependencies,
  cache: SignedPolicyCacheRecord,
  bundled: SignedPolicySelection,
  boundary: PolicyBoundary,
): SignedPolicySelection {
  if (cache.active) {
    const active = safeVerify(dependencies, cache.active, "cache-active", boundary);
    if (active) {
      return active.activation.id === bundled.activation.id ? bundled : active;
    }
  }
  if (cache.previous) {
    const previous = safeVerify(dependencies, cache.previous, "cache-previous", boundary);
    if (previous) return previous;
  }
  return bundled;
}

function withStatus(
  dependencies: SignedPolicySelectionDependencies,
  selection: SignedPolicySelection,
  cache: SignedPolicyCacheRecord,
  pending: SignedPolicySelection | null,
  degradation: PolicyDegradation,
  boundary: PolicyBoundary,
): SignedPolicyResolution {
  const activeSinceMs = cache.activeSince ? Date.parse(cache.activeSince) : Number.NaN;
  const issuedAtMs = Date.parse(selection.activation.issuedAt);
  const propagationMs = Number.isFinite(activeSinceMs) && Number.isFinite(issuedAtMs)
    ? Math.max(0, activeSinceMs - issuedAtMs)
    : null;
  const state = pending ? "pending" : degradation === "none" ? "active" : "degraded";
  emit(dependencies, {
    boundary,
    candidate: selection.bundle.id,
    event: "selected",
    sequence: selection.activation.sequence,
    source: selection.source,
  });
  return {
    selection,
    status: {
      active: identity(selection),
      activeSince: cache.activeSince,
      channel: dependencies.scope.channel,
      degradation,
      environment: dependencies.scope.environment,
      lastCheckedAt: cache.lastCheckedAt,
      lastCheckOutcome: cache.lastCheckOutcome,
      lastFailureCode: cache.lastFailureCode,
      pending: pending ? identity(pending) : null,
      propagationMs,
      state,
    },
  };
}

async function persist(
  dependencies: SignedPolicySelectionDependencies,
  record: SignedPolicyCacheRecord,
  boundary: PolicyBoundary,
): Promise<boolean> {
  try {
    await dependencies.writeCache(JSON.stringify(record));
    return true;
  } catch {
    emit(dependencies, {
      boundary,
      event: "cache-write-error",
      source: "cache",
      reasonCode: "storage-write",
    });
    return false;
  }
}

export async function selectSignedPolicy(
  dependencies: SignedPolicySelectionDependencies,
  boundary: PolicyBoundary = "background",
): Promise<SignedPolicyResolution> {
  const now = dependencies.now?.() ?? Date.now();
  const checkedAt = new Date(now).toISOString();
  const bundled = safeVerify(dependencies, dependencies.bundled, "bundled", boundary);
  if (!bundled) throw new Error("El snapshot firmado integrado es inválido.");

  const cacheRead = await readCache(dependencies, bundled, boundary);
  const cache = cacheRead.record;
  if (bundled.activation.sequence > cache.highestSequence) {
    cache.highestSequence = bundled.activation.sequence;
    cache.highestActivationId = bundled.activation.id;
  }

  let active = selectCached(dependencies, cache, bundled, boundary);
  let degradation: PolicyDegradation = cacheRead.readFailed ? "storage-error" : "none";
  if (active.source === "cache-previous") degradation = "cache-recovery";
  let pending = cache.pending
    ? safeVerify(dependencies, cache.pending, "cache-active", boundary)
    : null;
  if (cache.pending && !pending) {
    cache.pending = null;
    degradation = degradation === "storage-error" ? degradation : "cache-recovery";
  }

  if (pending && mayActivate(pending, boundary)) {
    const previousPackage = active.package;
    active = { ...pending, source: "cache-active" };
    cache.active = pending.package;
    cache.previous = previousPackage;
    cache.pending = null;
    cache.activeSince = checkedAt;
    emit(dependencies, {
      boundary,
      candidate: active.bundle.id,
      event: "pending-activated",
      sequence: active.activation.sequence,
      source: active.source,
    });
    pending = null;
  }

  let remotePackage: SignedPolicyPackage | null = null;
  try {
    remotePackage = await dependencies.fetchRemote();
  } catch {
    cache.lastCheckedAt = checkedAt;
    cache.lastCheckOutcome = "offline";
    cache.lastFailureCode = "network-or-resolution";
    degradation = degradation === "storage-error" ? degradation : "offline";
    emit(dependencies, {
      boundary,
      event: "remote-unavailable",
      source: "remote",
      reasonCode: "network-or-resolution",
    });
  }

  if (remotePackage) {
    let remote: SignedPolicySelection | null = null;
    try {
      remote = { ...dependencies.verify(remotePackage), source: "remote" };
    } catch {
      cache.lastCheckedAt = checkedAt;
      cache.lastCheckOutcome = "rejected";
      cache.lastFailureCode = "signature-or-contract";
      degradation = degradation === "storage-error" ? degradation : "invalid-remote";
      emit(dependencies, {
        boundary,
        event: "remote-rejected",
        source: "remote",
        reasonCode: "signature-or-contract",
      });
    }

    if (remote) {
      const repeatedHighest = remote.activation.sequence === cache.highestSequence
        && remote.activation.id === cache.highestActivationId;
      const rejectedBySequence = remote.activation.sequence < cache.highestSequence
        || (remote.activation.sequence === cache.highestSequence && !repeatedHighest);
      if (rejectedBySequence) {
        cache.lastCheckedAt = checkedAt;
        cache.lastCheckOutcome = "rejected";
        cache.lastFailureCode = "anti-rollback";
        degradation = degradation === "storage-error" ? degradation : "invalid-remote";
        emit(dependencies, {
          boundary,
          candidate: remote.bundle.id,
          event: "remote-rejected",
          sequence: remote.activation.sequence,
          source: "remote",
          reasonCode: "anti-rollback",
        });
      } else {
        cache.lastCheckedAt = checkedAt;
        cache.lastCheckOutcome = "verified";
        cache.lastFailureCode = null;
        if (degradation !== "storage-error" && active.source !== "cache-previous") {
          degradation = "none";
        }
        if (remote.activation.sequence > cache.highestSequence) {
          cache.highestSequence = remote.activation.sequence;
          cache.highestActivationId = remote.activation.id;
        }

        const isActive = active.activation.id === remote.activation.id;
        if (!isActive && mayActivate(remote, boundary)) {
          cache.previous = active.package;
          cache.active = remote.package;
          cache.pending = null;
          cache.activeSince = checkedAt;
          active = remote;
          pending = null;
          emit(dependencies, {
            boundary,
            candidate: remote.bundle.id,
            event: "pending-activated",
            sequence: remote.activation.sequence,
            source: "remote",
          });
        } else if (!isActive) {
          cache.pending = remote.package;
          pending = remote;
          emit(dependencies, {
            boundary,
            candidate: remote.bundle.id,
            event: "update-pending",
            sequence: remote.activation.sequence,
            source: "remote",
          });
        } else {
          cache.pending = null;
          pending = null;
        }
      }
    }
  }

  const persisted = await persist(dependencies, cache, boundary);
  if (!persisted) {
    cache.lastCheckOutcome = "storage-error";
    cache.lastFailureCode = "storage-write";
    degradation = "storage-error";
  }
  return withStatus(dependencies, active, cache, pending, degradation, boundary);
}
