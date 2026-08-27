export type PolicyContext = {
  activation: {
    action: "activate" | "rollback";
    id: string;
  };
  bundle_sha256: string;
  candidate: string;
  sequence: number;
  source: "bundled" | "cache" | "remote";
  version: string;
};

export function policyLeaseTracePayload(
  context: PolicyContext,
  boundary: "background" | "new-conversation" | "turn",
): Record<string, number | string> {
  return {
    activationId: context.activation.id,
    boundary,
    bundleSha256: context.bundle_sha256,
    candidate: context.candidate,
    sequence: context.sequence,
    source: context.source,
    version: context.version,
  };
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

export function normalizePolicyContext(value: unknown): PolicyContext | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const context = value as Record<string, unknown>;
  if (
    !hasExactKeys(context, [
      "activation",
      "bundle_sha256",
      "candidate",
      "sequence",
      "source",
      "version",
    ])
    || typeof context.candidate !== "string"
    || !/^[A-Za-z0-9._:-]{1,128}$/.test(context.candidate)
    || typeof context.version !== "string"
    || !/^[A-Za-z0-9._:-]{1,128}$/.test(context.version)
    || typeof context.bundle_sha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(context.bundle_sha256)
    || !Number.isSafeInteger(context.sequence)
    || Number(context.sequence) < 0
    || !["bundled", "cache", "remote"].includes(String(context.source))
    || !context.activation
    || typeof context.activation !== "object"
    || Array.isArray(context.activation)
  ) {
    return undefined;
  }
  const activation = context.activation as Record<string, unknown>;
  if (
    !hasExactKeys(activation, ["action", "id"])
    || !["activate", "rollback"].includes(String(activation.action))
    || typeof activation.id !== "string"
    || !/^(?:activation-[a-f0-9]{32}|local-bundled)$/.test(activation.id)
  ) {
    return undefined;
  }
  return {
    activation: {
      action: activation.action as PolicyContext["activation"]["action"],
      id: activation.id,
    },
    bundle_sha256: context.bundle_sha256,
    candidate: context.candidate,
    sequence: Number(context.sequence),
    source: context.source as PolicyContext["source"],
    version: context.version,
  };
}
