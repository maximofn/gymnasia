import { describe, expect, it } from "vitest";

import type {
  PolicyActivation,
  PolicyBundle,
  SignedPolicyPackage,
  VerifiedSignedPolicy,
} from "./signedPolicy";
import {
  SIGNED_POLICY_CACHE_SCHEMA_VERSION,
  selectSignedPolicy,
  type SignedPolicyDiagnostic,
  type SignedPolicySelectionDependencies,
} from "./signedPolicySelection";

const ENVELOPE = {} as SignedPolicyPackage["bundleSignature"];

function signedPackage(
  candidate: string,
  sequence: number,
  activationId: string,
  action: "activate" | "rollback" = "activate",
): SignedPolicyPackage {
  return {
    schemaVersion: 1,
    environment: "production",
    channel: "Production",
    candidate,
    deploymentId: sequence,
    bundleBody: candidate,
    bundleSignature: ENVELOPE,
    activationBody: `${sequence}`,
    activationSignature: ENVELOPE,
    ...(action === "rollback" ? { candidate } : {}),
  };
}

function fakeVerify(packageValue: unknown): VerifiedSignedPolicy {
  const value = packageValue as SignedPolicyPackage;
  if (!value || value.bundleBody === "corrupt") throw new Error("invalid signature");
  const sequence = Number(value.activationBody);
  const bundle = {
    critical: false,
    healthSafetyRuntime: {
      content: {},
      policyVersion: "2026.08.1",
      sha256: "a".repeat(64),
    },
    id: value.candidate,
    issuedAt: "2026-08-25T10:00:00.000Z",
    minClientProtocol: 1,
    prompt: { content: "prompt", encoding: "utf-8", sha256: "b".repeat(64) },
    requiredTools: ["read_field_value"],
    schemaVersion: 1,
    version: "2026.08.2",
  } as PolicyBundle;
  const activation = {
    action: value.candidate.includes("rollback") ? "rollback" : "activate",
    bundleId: value.candidate,
    bundleSha256: "c".repeat(64),
    channel: "Production",
    critical: false,
    fromBundleId: value.candidate.includes("rollback") ? "policy-v2026.08.3-currentcurrent" : null,
    id: `activation-${value.deploymentId?.toString(16).padStart(32, "0")}`,
    issuedAt: "2026-08-25T10:00:00.000Z",
    schemaVersion: 1,
    sequence,
  } as PolicyActivation;
  return { package: value, bundle, activation };
}

function cacheRecord(
  current: SignedPolicyPackage | null,
  previous: SignedPolicyPackage | null,
  highestSequence: number,
): string {
  return JSON.stringify({
    schemaVersion: SIGNED_POLICY_CACHE_SCHEMA_VERSION,
    environment: "production",
    channel: "Production",
    highestSequence,
    highestActivationId: `activation-${highestSequence.toString(16).padStart(32, "0")}`,
    current,
    previous,
  });
}

function dependencies({
  remote,
  cache = null,
  bundled = signedPackage("policy-v2026.08.1-bundled0000", 1, "unused"),
  write,
}: {
  remote: SignedPolicyPackage | Error;
  cache?: string | null;
  bundled?: SignedPolicyPackage;
  write?: (value: string) => Promise<void>;
}): {
  value: SignedPolicySelectionDependencies;
  diagnostics: SignedPolicyDiagnostic[];
  writes: string[];
} {
  const diagnostics: SignedPolicyDiagnostic[] = [];
  const writes: string[] = [];
  return {
    diagnostics,
    writes,
    value: {
      fetchRemote: async () => {
        if (remote instanceof Error) throw remote;
        return remote;
      },
      readCache: async () => cache,
      writeCache: write ?? (async (raw) => {
        writes.push(raw);
      }),
      verify: fakeVerify,
      bundled,
      scope: { environment: "production", channel: "Production" },
      diagnostic: (entry) => diagnostics.push(entry),
    },
  };
}

describe("signed policy cache selection", () => {
  it("acepta una activación mayor y conserva la actual como segunda caché", async () => {
    const current = signedPackage("policy-v2026.08.2-current00000", 2, "unused");
    const remote = signedPackage("policy-v2026.08.3-next00000000", 3, "unused");
    const setup = dependencies({ remote, cache: cacheRecord(current, null, 2) });

    const selected = await selectSignedPolicy(setup.value);

    expect(selected.source).toBe("remote");
    const stored = JSON.parse(setup.writes[0] ?? "{}");
    expect(stored.highestSequence).toBe(3);
    expect(stored.current.candidate).toBe(remote.candidate);
    expect(stored.previous.candidate).toBe(current.candidate);
  });

  it("rechaza replay y downgrade aunque sus firmas fueran válidas", async () => {
    const current = signedPackage("policy-v2026.08.3-current00000", 5, "unused");
    const replay = signedPackage("policy-v2026.08.2-replayed0000", 4, "unused");
    const setup = dependencies({ remote: replay, cache: cacheRecord(current, null, 5) });

    const selected = await selectSignedPolicy(setup.value);

    expect(selected.source).toBe("cache-current");
    expect(selected.bundle.id).toBe(current.candidate);
    expect(setup.writes).toEqual([]);
    expect(setup.diagnostics).toContainEqual(expect.objectContaining({
      event: "remote-rejected",
      reason: "anti-rollback",
    }));
  });

  it("acepta un rollback explícito solo cuando lleva una secuencia nueva", async () => {
    const current = signedPackage("policy-v2026.08.3-current00000", 5, "unused");
    const rollback = signedPackage("policy-v2026.08.2-rollback000", 6, "unused", "rollback");
    const setup = dependencies({ remote: rollback, cache: cacheRecord(current, null, 5) });

    const selected = await selectSignedPolicy(setup.value);

    expect(selected.source).toBe("remote");
    expect(selected.activation.sequence).toBe(6);
    expect(JSON.parse(setup.writes[0] ?? "{}").highestSequence).toBe(6);
  });

  it("si la caché actual se corrompe usa la segunda copia firmada", async () => {
    const corrupt = signedPackage("policy-v2026.08.3-current00000", 5, "unused");
    corrupt.bundleBody = "corrupt";
    const previous = signedPackage("policy-v2026.08.2-previous000", 4, "unused");
    const setup = dependencies({
      remote: new Error("offline"),
      cache: cacheRecord(corrupt, previous, 5),
    });

    const selected = await selectSignedPolicy(setup.value);

    expect(selected.source).toBe("cache-previous");
    expect(selected.bundle.id).toBe(previous.candidate);
  });

  it("sin red ni cachés válidas usa el snapshot firmado integrado", async () => {
    const setup = dependencies({ remote: new Error("offline") });
    const selected = await selectSignedPolicy(setup.value);
    expect(selected.source).toBe("bundled");
  });

  it("un fallo al guardar no invalida un remoto ya verificado", async () => {
    const remote = signedPackage("policy-v2026.08.3-next00000000", 3, "unused");
    const setup = dependencies({
      remote,
      write: async () => {
        throw new Error("storage full");
      },
    });
    const selected = await selectSignedPolicy(setup.value);
    expect(selected.source).toBe("remote");
    expect(setup.diagnostics).toContainEqual(expect.objectContaining({
      event: "cache-write-error",
    }));
  });
});
