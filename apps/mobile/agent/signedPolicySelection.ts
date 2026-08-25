import type {
  PolicyChannelName,
  SignedPolicyPackage,
  VerifiedSignedPolicy,
} from "./signedPolicy";

export const SIGNED_POLICY_CACHE_SCHEMA_VERSION = 1 as const;

export type SignedPolicySource = "remote" | "cache-current" | "cache-previous" | "bundled";

export type SignedPolicySelection = VerifiedSignedPolicy & {
  source: SignedPolicySource;
};

export type SignedPolicyDiagnostic = {
  event:
    | "remote-rejected"
    | "remote-error"
    | "cache-rejected"
    | "cache-read-error"
    | "cache-write-error"
    | "selected";
  source: SignedPolicySource | "remote" | "cache";
  reason?: string;
  candidate?: string;
  sequence?: number;
};

type SignedPolicyCacheRecord = {
  schemaVersion: typeof SIGNED_POLICY_CACHE_SCHEMA_VERSION;
  environment: string;
  channel: PolicyChannelName;
  highestSequence: number;
  highestActivationId: string;
  current: SignedPolicyPackage | null;
  previous: SignedPolicyPackage | null;
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
};

function emit(
  dependencies: SignedPolicySelectionDependencies,
  entry: SignedPolicyDiagnostic,
): void {
  try {
    dependencies.diagnostic?.(entry);
  } catch {
    // La telemetría local nunca debe cambiar la selección de política.
  }
}

function exactCacheRecord(
  value: unknown,
  scope: SignedPolicySelectionDependencies["scope"],
): SignedPolicyCacheRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const expected = [
    "channel",
    "current",
    "environment",
    "highestActivationId",
    "highestSequence",
    "previous",
    "schemaVersion",
  ];
  const keys = Object.keys(record).sort();
  if (
    keys.length !== expected.length
    || keys.some((key, index) => key !== expected[index])
    || record.schemaVersion !== SIGNED_POLICY_CACHE_SCHEMA_VERSION
    || record.environment !== scope.environment
    || record.channel !== scope.channel
    || !Number.isSafeInteger(record.highestSequence)
    || Number(record.highestSequence) < 1
    || typeof record.highestActivationId !== "string"
    || !/^activation-[a-f0-9]{32}$/.test(record.highestActivationId)
    || (record.current !== null && (typeof record.current !== "object" || Array.isArray(record.current)))
    || (record.previous !== null && (typeof record.previous !== "object" || Array.isArray(record.previous)))
  ) {
    return null;
  }
  return record as SignedPolicyCacheRecord;
}

async function readCache(
  dependencies: SignedPolicySelectionDependencies,
): Promise<SignedPolicyCacheRecord | null> {
  let raw: string | null;
  try {
    raw = await dependencies.readCache();
  } catch {
    emit(dependencies, {
      event: "cache-read-error",
      source: "cache",
      reason: "storage-error",
    });
    return null;
  }
  if (!raw) return null;
  try {
    const record = exactCacheRecord(JSON.parse(raw), dependencies.scope);
    if (record) return record;
  } catch {
    // Se diagnostica de la misma forma que cualquier registro estructuralmente inválido.
  }
  emit(dependencies, {
    event: "cache-rejected",
    source: "cache",
    reason: "invalid-record",
  });
  return null;
}

function safeVerify(
  dependencies: SignedPolicySelectionDependencies,
  packageValue: unknown,
  source: "cache-current" | "cache-previous" | "bundled",
): SignedPolicySelection | null {
  try {
    const verified = dependencies.verify(packageValue);
    return { ...verified, source };
  } catch {
    emit(dependencies, {
      event: "cache-rejected",
      source,
      reason: "signature-or-contract",
    });
    return null;
  }
}

function selected(
  dependencies: SignedPolicySelectionDependencies,
  value: SignedPolicySelection,
): SignedPolicySelection {
  emit(dependencies, {
    event: "selected",
    source: value.source,
    candidate: value.bundle.id,
    sequence: value.activation.sequence,
  });
  return value;
}

export async function selectSignedPolicy(
  dependencies: SignedPolicySelectionDependencies,
): Promise<SignedPolicySelection> {
  const bundled = safeVerify(dependencies, dependencies.bundled, "bundled");
  if (!bundled) throw new Error("El snapshot firmado integrado es inválido.");
  const cache = await readCache(dependencies);
  const storedHighest = cache?.highestSequence ?? bundled.activation.sequence;
  const highestSequence = Math.max(storedHighest, bundled.activation.sequence);
  const highestActivationId = storedHighest >= bundled.activation.sequence
    ? cache?.highestActivationId ?? bundled.activation.id
    : bundled.activation.id;

  try {
    const remotePackage = await dependencies.fetchRemote();
    const remote = { ...dependencies.verify(remotePackage), source: "remote" as const };
    const isRepeatedHighest = remote.activation.sequence === highestSequence
      && remote.activation.id === highestActivationId;
    if (remote.activation.sequence < highestSequence
      || (remote.activation.sequence === highestSequence && !isRepeatedHighest)) {
      emit(dependencies, {
        event: "remote-rejected",
        source: "remote",
        reason: "anti-rollback",
        candidate: remote.bundle.id,
        sequence: remote.activation.sequence,
      });
    } else {
      const current = cache?.current
        ? safeVerify(dependencies, cache.current, "cache-current")
        : null;
      const sameCurrent = current?.activation.id === remote.activation.id;
      if (!sameCurrent || remote.activation.sequence > highestSequence) {
        const record: SignedPolicyCacheRecord = {
          schemaVersion: SIGNED_POLICY_CACHE_SCHEMA_VERSION,
          environment: dependencies.scope.environment,
          channel: dependencies.scope.channel,
          highestSequence: Math.max(highestSequence, remote.activation.sequence),
          highestActivationId: remote.activation.id,
          current: remote.package,
          previous: current?.package ?? cache?.previous ?? null,
        };
        try {
          await dependencies.writeCache(JSON.stringify(record));
        } catch {
          emit(dependencies, {
            event: "cache-write-error",
            source: "remote",
            reason: "storage-error",
          });
        }
      }
      return selected(dependencies, remote);
    }
  } catch {
    emit(dependencies, {
      event: "remote-error",
      source: "remote",
      reason: "request-or-verification",
    });
  }

  if (cache?.current) {
    const current = safeVerify(dependencies, cache.current, "cache-current");
    if (current) return selected(dependencies, current);
  }
  if (cache?.previous) {
    const previous = safeVerify(dependencies, cache.previous, "cache-previous");
    if (previous) return selected(dependencies, previous);
  }
  return selected(dependencies, bundled);
}
