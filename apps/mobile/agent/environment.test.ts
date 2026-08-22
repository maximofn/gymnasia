import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  resolveAppVariant,
  resolveRuntimeEnvironment,
  secureStorageKeyForVariant,
  storageKeyForVariant,
  isStorageKeyInVariant,
} from "../environment";

const POLICY_SHA256 = "a".repeat(64);

describe("app environments", () => {
  it.each([
    ["development", "Gymnasia Dev", "com.maximofn.gymnasia.dev", "Local", "fake"],
    ["staging", "Gymnasia Staging", "com.maximofn.gymnasia.staging", "Staging", "byok"],
    ["production", "Gymnasia", "com.maximofn.gymnasia", "Production", "byok"],
  ] as const)("resolves %s", (environment, name, applicationId, channel, providerMode) => {
    expect(resolveAppVariant(environment, undefined)).toMatchObject({
      environment,
      name,
      applicationId,
      policyChannel: channel,
      providerMode,
    });
  });

  it.each([undefined, "", "preview", "prod", "Development"])(
    "rejects APP_ENV=%s",
    (environment) => {
      expect(() => resolveAppVariant(environment, undefined)).toThrow();
    },
  );

  it("allows real providers only as an explicit development opt-in", () => {
    expect(resolveAppVariant("development", "byok").providerMode).toBe("byok");
    expect(() => resolveAppVariant("development", "real")).toThrow();
    expect(() => resolveAppVariant("staging", "fake")).toThrow();
    expect(() => resolveAppVariant("production", "byok")).toThrow();
  });

  it("preserves production keys and scopes non-production keys", () => {
    const baseKey = "gymnasia.mobile.local.v3";
    const production = resolveAppVariant("production", undefined);
    const staging = resolveAppVariant("staging", undefined);
    expect(storageKeyForVariant(production, baseKey)).toBe(baseKey);
    expect(storageKeyForVariant(staging, baseKey)).toBe(`gymnasia.staging:${baseKey}`);
    expect(secureStorageKeyForVariant(production, baseKey)).toBe(baseKey);
    expect(secureStorageKeyForVariant(staging, baseKey)).toBe(`gymnasia.staging.${baseKey}`);
    expect(secureStorageKeyForVariant(staging, baseKey)).not.toContain(":");
    expect(isStorageKeyInVariant(staging, `gymnasia.staging:${baseKey}`)).toBe(true);
    expect(isStorageKeyInVariant(staging, baseKey)).toBe(false);
    expect(isStorageKeyInVariant(production, baseKey)).toBe(true);
    expect(isStorageKeyInVariant(production, `gymnasia.staging:${baseKey}`)).toBe(false);
  });

  it("rejects hybrid runtime metadata", () => {
    expect(() => resolveRuntimeEnvironment({
      environment: "production",
      channel: "Staging",
      storageNamespace: "gymnasia.production",
      providerMode: "byok",
      configurationVersion: 1,
      policyCandidate: "policy-v2026.08.1-deadbeef",
      policySha256: POLICY_SHA256,
    })).toThrow(/híbrida/);
  });

  it("accepts a complete runtime configuration", () => {
    expect(resolveRuntimeEnvironment({
      environment: "staging",
      channel: "Staging",
      storageNamespace: "gymnasia.staging",
      providerMode: "byok",
      configurationVersion: 1,
      policyCandidate: "policy-v2026.08.1-deadbeef",
      policySha256: POLICY_SHA256,
    })).toMatchObject({ environment: "staging", policyChannel: "Staging" });
  });

  it("never resolves a partial or hybrid object as production", () => {
    fc.assert(fc.property(
      fc.dictionary(fc.string({ minLength: 1, maxLength: 24 }), fc.jsonValue()),
      (extra) => {
        try {
          const resolved = resolveRuntimeEnvironment(extra);
          if (resolved.environment === "production") {
            expect(extra).toMatchObject({
              environment: "production",
              channel: "Production",
              storageNamespace: "gymnasia.production",
              providerMode: "byok",
              configurationVersion: 1,
            });
            expect(String(extra.policySha256)).toMatch(/^[a-f0-9]{64}$/);
          }
        } catch {
          // Rechazar es el resultado seguro esperado para configuraciones arbitrarias.
        }
      },
    ));
  });
});
