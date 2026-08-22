import type { ConfigContext, ExpoConfig } from "expo/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import baseConfig from "./app.json";

type BuildEnvironment = "development" | "staging" | "production";

const VARIANTS: Record<BuildEnvironment, {
  name: string;
  applicationId: string;
  policyChannel: "Local" | "Staging" | "Production";
  storageNamespace: string;
}> = {
  development: {
    name: "Gymnasia Dev",
    applicationId: "com.maximofn.gymnasia.dev",
    policyChannel: "Local",
    storageNamespace: "gymnasia.development",
  },
  staging: {
    name: "Gymnasia Staging",
    applicationId: "com.maximofn.gymnasia.staging",
    policyChannel: "Staging",
    storageNamespace: "gymnasia.staging",
  },
  production: {
    name: "Gymnasia",
    applicationId: "com.maximofn.gymnasia",
    policyChannel: "Production",
    storageNamespace: "gymnasia.production",
  },
};

/**
 * URL del backend de incidencias (GYM-54).
 *
 * Es un literal a propósito, no solo una variable de entorno: el escáner de
 * `scripts/data-inventory` reconoce hosts por literal `https://`, así que
 * dejarlo aquí obliga a declararlo en `networkEndpoints` y el guard rail
 * trabaja a favor. Con la URL solo en el entorno, el host sería invisible.
 *
 * `FEEDBACK_API_BASE_URL` existe solo como override de desarrollo, para
 * apuntar a `wrangler dev`.
 */
const FEEDBACK_ENDPOINTS: Record<BuildEnvironment, string> = {
  development: "",
  staging: "",
  production: "https://gymnasia-feedback.maximofn.com",
};

function readBundledPolicyMetadata(environment: BuildEnvironment): {
  sha256: string;
  candidate: string;
} {
  const source = readFileSync(
    join(__dirname, "agent/generated/chatSystemPrompt.generated.ts"),
    "utf8",
  );
  const sha256 = source.match(/BUNDLED_CHAT_SYSTEM_PROMPT_SHA256 = "([a-f0-9]{64})"/)?.[1];
  const version = source.match(/BUNDLED_CHAT_SYSTEM_PROMPT_VERSION = "([^"]+)"/)?.[1];
  if (!sha256 || version !== `sha256:${sha256}`) {
    throw new Error("El snapshot de política integrado tiene metadatos inválidos.");
  }
  let candidate = version;
  try {
    const snapshot = JSON.parse(readFileSync(
      join(__dirname, "agent/generated/policySnapshot.generated.json"),
      "utf8",
    )) as Record<string, unknown>;
    if (
      snapshot.schemaVersion === 1
      && snapshot.environment === environment
      && snapshot.sha256 === sha256
      && typeof snapshot.candidate === "string"
      && snapshot.candidate.trim()
    ) {
      candidate = snapshot.candidate;
    }
  } catch {
    // La identidad versionada es opcional para desarrollo; el hash del módulo no.
  }
  return { sha256, candidate };
}

function resolveBuildVariant() {
  const environment = process.env.APP_ENV;
  if (!environment || !Object.hasOwn(VARIANTS, environment)) {
    throw new Error("APP_ENV es obligatorio (development | staging | production).");
  }
  const typedEnvironment = environment as BuildEnvironment;
  const developmentMode = process.env.DEV_PROVIDER_MODE;
  if (typedEnvironment !== "development" && developmentMode) {
    throw new Error("DEV_PROVIDER_MODE solo puede usarse con APP_ENV=development.");
  }
  if (developmentMode && !["fake", "byok"].includes(developmentMode)) {
    throw new Error(`DEV_PROVIDER_MODE desconocido: ${developmentMode}.`);
  }
  return {
    ...VARIANTS[typedEnvironment],
    environment: typedEnvironment,
    providerMode: typedEnvironment === "development" ? developmentMode || "fake" : "byok",
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = resolveBuildVariant();
  const bundledPolicy = readBundledPolicyMetadata(variant.environment);
  const base = baseConfig.expo;
  const policyCandidate = process.env.POLICY_CANDIDATE
    || bundledPolicy.candidate;
  const policySha256 = process.env.POLICY_SHA256
    || bundledPolicy.sha256;

  return {
    ...config,
    ...base,
    name: variant.name,
    ios: {
      ...base.ios,
      bundleIdentifier: variant.applicationId,
    },
    android: {
      ...base.android,
      package: variant.applicationId,
    },
    extra: {
      ...base.extra,
      environment: variant.environment,
      channel: variant.policyChannel,
      storageNamespace: variant.storageNamespace,
      providerMode: variant.providerMode,
      configurationVersion: 1,
      policyCandidate,
      policySha256,
      feedbackApiBaseUrl:
        process.env.FEEDBACK_API_BASE_URL?.trim()
        || FEEDBACK_ENDPOINTS[variant.environment],
    },
  } as ExpoConfig;
};
