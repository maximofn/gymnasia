import fc from "fast-check";
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
  signedPolicyDiagnosticPayload,
  type PolicyBoundary,
  type SignedPolicyDiagnostic,
  type SignedPolicySelectionDependencies,
} from "./signedPolicySelection";

const ENVELOPE = {} as SignedPolicyPackage["bundleSignature"];
const NOW = Date.parse("2026-08-26T10:00:00.000Z");

function signedPackage(
  candidate: string,
  sequence: number,
  action: "activate" | "rollback" = "activate",
  critical = false,
): SignedPolicyPackage {
  return {
    schemaVersion: 1,
    environment: "production",
    channel: "Production",
    candidate,
    deploymentId: sequence,
    bundleBody: JSON.stringify({ action, candidate, critical }),
    bundleSignature: ENVELOPE,
    activationBody: JSON.stringify({ action, sequence }),
    activationSignature: ENVELOPE,
  };
}

function fakeVerify(packageValue: unknown): VerifiedSignedPolicy {
  const value = packageValue as SignedPolicyPackage;
  if (!value || value.bundleBody === "corrupt") throw new Error("invalid signature");
  const bundleMetadata = JSON.parse(value.bundleBody) as {
    action: "activate" | "rollback";
    critical: boolean;
  };
  const activationMetadata = JSON.parse(value.activationBody) as {
    action: "activate" | "rollback";
    sequence: number;
  };
  const bundle = {
    critical: bundleMetadata.critical,
    healthSafetyRuntime: {
      content: {},
      policyVersion: "2026.08.1",
      sha256: "a".repeat(64),
    },
    id: value.candidate,
    issuedAt: "2026-08-25T10:00:00.000Z",
    minClientProtocol: 1,
    prompt: { content: `prompt:${value.candidate}`, encoding: "utf-8", sha256: "b".repeat(64) },
    requiredTools: ["read_field_value"],
    schemaVersion: 1,
    version: `2026.08.${activationMetadata.sequence}`,
  } as PolicyBundle;
  const activation = {
    action: activationMetadata.action,
    bundleId: value.candidate,
    bundleSha256: "c".repeat(64),
    channel: "Production",
    critical: bundleMetadata.critical,
    fromBundleId: activationMetadata.action === "rollback" ? "policy-v2026.08.3-cccccccccccc" : null,
    id: `activation-${activationMetadata.sequence.toString(16).padStart(32, "0")}`,
    issuedAt: "2026-08-25T10:00:00.000Z",
    schemaVersion: 1,
    sequence: activationMetadata.sequence,
  } as PolicyActivation;
  return { package: value, bundle, activation };
}

function cacheRecord({
  active,
  previous = null,
  pending = null,
  highestSequence,
}: {
  active: SignedPolicyPackage | null;
  previous?: SignedPolicyPackage | null;
  pending?: SignedPolicyPackage | null;
  highestSequence: number;
}): string {
  return JSON.stringify({
    schemaVersion: SIGNED_POLICY_CACHE_SCHEMA_VERSION,
    environment: "production",
    channel: "Production",
    highestSequence,
    highestActivationId: `activation-${highestSequence.toString(16).padStart(32, "0")}`,
    active,
    previous,
    pending,
    activeSince: "2026-08-25T11:00:00.000Z",
    lastCheckedAt: "2026-08-25T11:00:00.000Z",
    lastCheckOutcome: "verified",
    lastFailureCode: null,
  });
}

function legacyCacheRecord(
  current: SignedPolicyPackage,
  previous: SignedPolicyPackage | null,
  highestSequence: number,
): string {
  return JSON.stringify({
    schemaVersion: 1,
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
  bundled = signedPackage("policy-v2026.08.1-aaaaaaaaaaaa", 1),
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
      now: () => NOW,
    },
  };
}

async function resolve(
  boundary: PolicyBoundary,
  setup: ReturnType<typeof dependencies>,
) {
  return selectSignedPolicy(setup.value, boundary);
}

describe("signed policy lifecycle", () => {
  it("limita las trazas a la allowlist pública", () => {
    const payload = signedPolicyDiagnosticPayload({
      boundary: "turn",
      candidate: "policy-v2026.08.3-cccccccccccc",
      event: "remote-rejected",
      reasonCode: "anti-rollback",
      sequence: 3,
      source: "remote",
    });
    expect(Object.keys(payload).sort()).toEqual([
      "boundary",
      "candidate",
      "reasonCode",
      "sequence",
      "source",
    ]);
    const serialized = JSON.stringify(payload).toLowerCase();
    for (const forbidden of ["prompt", "message", "api_key", "input", "output", "health_data"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("migra la caché v1 sin perder activa, anterior ni anti-rollback", async () => {
    const current = signedPackage("policy-v2026.08.2-bbbbbbbbbbbb", 2);
    const previous = signedPackage("policy-v2026.08.1-aaaaaaaaaaaa", 1);
    const setup = dependencies({
      remote: new Error("offline"),
      cache: legacyCacheRecord(current, previous, 2),
    });

    const result = await resolve("background", setup);
    const stored = JSON.parse(setup.writes.at(-1) ?? "{}") as Record<string, unknown>;

    expect(result.selection.bundle.id).toBe(current.candidate);
    expect(stored.schemaVersion).toBe(2);
    expect((stored.active as SignedPolicyPackage).candidate).toBe(current.candidate);
    expect((stored.previous as SignedPolicyPackage).candidate).toBe(previous.candidate);
    expect(stored.pending).toBeNull();
    expect(stored.highestSequence).toBe(2);
    expect(setup.diagnostics).toContainEqual(expect.objectContaining({ event: "cache-migrated" }));
  });

  it("mantiene una actualización normal pendiente en background y durante un turno", async () => {
    const active = signedPackage("policy-v2026.08.2-bbbbbbbbbbbb", 2);
    const remote = signedPackage("policy-v2026.08.3-cccccccccccc", 3);
    const setup = dependencies({
      remote,
      cache: cacheRecord({ active, highestSequence: 2 }),
    });

    const result = await resolve("turn", setup);
    const stored = JSON.parse(setup.writes.at(-1) ?? "{}") as Record<string, SignedPolicyPackage>;

    expect(result.selection.bundle.id).toBe(active.candidate);
    expect(result.status.state).toBe("pending");
    expect(result.status.pending?.candidate).toBe(remote.candidate);
    expect(stored.pending.candidate).toBe(remote.candidate);
  });

  it("activa una actualización normal al primer envío de una conversación nueva", async () => {
    const active = signedPackage("policy-v2026.08.2-bbbbbbbbbbbb", 2);
    const remote = signedPackage("policy-v2026.08.3-cccccccccccc", 3);
    const setup = dependencies({
      remote,
      cache: cacheRecord({ active, pending: remote, highestSequence: 3 }),
    });

    const result = await resolve("new-conversation", setup);
    const stored = JSON.parse(setup.writes.at(-1) ?? "{}") as Record<string, SignedPolicyPackage | null>;

    expect(result.selection.bundle.id).toBe(remote.candidate);
    expect(result.status.pending).toBeNull();
    expect(stored.pending).toBeNull();
    expect(stored.previous?.candidate).toBe(active.candidate);
  });

  it.each([
    ["crítica", signedPackage("policy-v2026.08.3-cccccccccccc", 3, "activate", true)],
    ["rollback", signedPackage("policy-v2026.08.1-aaaaaaaaaaaa", 3, "rollback")],
  ])("activa una política %s al comienzo del siguiente turno seguro", async (_label, remote) => {
    const active = signedPackage("policy-v2026.08.2-bbbbbbbbbbbb", 2);
    const setup = dependencies({
      remote,
      cache: cacheRecord({ active, highestSequence: 2 }),
    });

    const result = await resolve("turn", setup);

    expect(result.selection.bundle.id).toBe(remote.candidate);
    expect(result.selection.activation.sequence).toBe(3);
    expect(result.status.pending).toBeNull();
  });

  it("nunca activa en background, aunque la actualización sea crítica", async () => {
    const active = signedPackage("policy-v2026.08.2-bbbbbbbbbbbb", 2);
    const remote = signedPackage("policy-v2026.08.3-cccccccccccc", 3, "activate", true);
    const setup = dependencies({
      remote,
      cache: cacheRecord({ active, highestSequence: 2 }),
    });

    const result = await resolve("background", setup);

    expect(result.selection.bundle.id).toBe(active.candidate);
    expect(result.status.pending?.candidate).toBe(remote.candidate);
  });

  it("recupera la copia anterior si la activa está corrupta", async () => {
    const corrupt = signedPackage("policy-v2026.08.3-cccccccccccc", 3);
    corrupt.bundleBody = "corrupt";
    const previous = signedPackage("policy-v2026.08.2-bbbbbbbbbbbb", 2);
    const setup = dependencies({
      remote: new Error("offline"),
      cache: cacheRecord({ active: corrupt, previous, highestSequence: 3 }),
    });

    const result = await resolve("background", setup);

    expect(result.selection.source).toBe("cache-previous");
    expect(result.selection.bundle.id).toBe(previous.candidate);
    expect(result.status.degradation).toBe("offline");
  });

  it("degrada al snapshot integrado sin red ni cachés válidas", async () => {
    const setup = dependencies({ remote: new Error("offline") });
    const result = await resolve("background", setup);
    expect(result.selection.source).toBe("bundled");
    expect(result.status.lastCheckOutcome).toBe("offline");
    expect(result.status.lastFailureCode).toBe("network-or-resolution");
  });

  it("un fallo al guardar no invalida una política ya verificada para esa petición", async () => {
    const remote = signedPackage("policy-v2026.08.3-cccccccccccc", 3);
    const setup = dependencies({
      remote,
      write: async () => {
        throw new Error("storage full");
      },
    });
    const result = await resolve("new-conversation", setup);
    expect(result.selection.bundle.id).toBe(remote.candidate);
    expect(result.status.degradation).toBe("storage-error");
    expect(setup.diagnostics).toContainEqual(expect.objectContaining({ event: "cache-write-error" }));
  });

  it("es idempotente al volver a observar la misma activación", async () => {
    const active = signedPackage("policy-v2026.08.3-cccccccccccc", 3);
    const setup = dependencies({
      remote: active,
      cache: cacheRecord({ active, highestSequence: 3 }),
    });
    const result = await resolve("turn", setup);
    expect(result.selection.bundle.id).toBe(active.candidate);
    expect(result.status.pending).toBeNull();
    expect(setup.diagnostics.filter((entry) => entry.event === "pending-activated")).toHaveLength(0);
  });

  it("recorre publicación, activación y rollback con caché y proveedor falsos", async () => {
    let cache: string | null = null;
    let remote = signedPackage("policy-v2026.08.2-bbbbbbbbbbbb", 2);
    const setup = dependencies({ remote });
    setup.value.readCache = async () => cache;
    setup.value.writeCache = async (value) => { cache = value; };
    setup.value.fetchRemote = async () => remote;

    const staged = await resolve("background", setup);
    expect(staged.selection.bundle.id).toBe("policy-v2026.08.1-aaaaaaaaaaaa");
    expect(staged.status.pending?.candidate).toBe(remote.candidate);

    const activated = await resolve("new-conversation", setup);
    expect(activated.selection.bundle.id).toBe(remote.candidate);
    expect(activated.status.pending).toBeNull();

    remote = signedPackage("policy-v2026.08.1-aaaaaaaaaaaa", 3, "rollback");
    const rolledBack = await resolve("turn", setup);
    expect(rolledBack.selection.bundle.id).toBe(remote.candidate);
    expect(rolledBack.selection.activation.action).toBe("rollback");
    expect(rolledBack.selection.activation.sequence).toBe(3);
  });

  it("mantiene la secuencia monótona para órdenes remotos arbitrarios", async () => {
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 2, max: 10_000 }),
      fc.integer({ min: 1, max: 10_000 }),
      async (highest, observed) => {
        const active = signedPackage("policy-v2026.08.2-bbbbbbbbbbbb", highest);
        const remote = signedPackage("policy-v2026.08.3-cccccccccccc", observed);
        const setup = dependencies({
          remote,
          bundled: signedPackage("policy-v2026.08.1-aaaaaaaaaaaa", 1),
          cache: cacheRecord({ active, highestSequence: highest }),
        });
        const result = await resolve("new-conversation", setup);
        const stored = JSON.parse(setup.writes.at(-1) ?? "{}") as { highestSequence: number };
        expect(stored.highestSequence).toBe(Math.max(highest, observed));
        if (observed <= highest) expect(result.selection.bundle.id).toBe(active.candidate);
      },
    ), { numRuns: 100 });
  });
});
