import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repositoryRoot = resolve(here, "..", "..");
export const releasePolicyPath = join(here, "policy.json");

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const GIT_COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const POLICY_CANDIDATE_PATTERN = /^policy-v\d{4}\.\d{2}\.\d+-[a-f0-9]{12}$/;

export const PRODUCTION_GATES = Object.freeze([
  ["npm", ["run", "check:prompt-policy"]],
  ["npm", ["run", "test:prompt-policy"]],
  ["npm", ["run", "check:android-permissions"]],
  ["npm", ["run", "test:android-permissions"]],
  ["npm", ["run", "check:health-safety"]],
  ["npm", ["run", "test:health-safety"]],
  ["npm", ["run", "check:data-inventory"]],
  ["npm", ["run", "test:data-inventory"]],
  ["npm", ["run", "check:legal"]],
  ["npm", ["run", "test:legal"]],
  ["npm", ["run", "check:chat-prompt"]],
  ["npm", ["test"]],
  ["npm", ["run", "test:openwiki"]],
  ["npm", ["run", "test:production-release"]],
  ["npm", ["--workspace", "apps/mobile", "exec", "tsc", "--noEmit"]],
  [
    "npm",
    ["--workspace", "apps/mobile", "exec", "--", "expo", "export", "--platform", "android", "--dev"],
    { APP_ENV: "production" },
  ],
  ["npm", ["run", "test:agent:e2e"]],
  ["npm", ["run", "test:train:e2e"]],
]);

export function loadReleasePolicy(path = releasePolicyPath) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function normalizeCertificateDigest(value) {
  return String(value ?? "")
    .replaceAll(":", "")
    .trim()
    .toUpperCase();
}

export function commandLabel(command, args, environment = {}) {
  return [
    ...Object.entries(environment).map(([key, value]) => `${key}=${value}`),
    command,
    ...args,
  ].join(" ");
}

export function productionGateLabels() {
  return PRODUCTION_GATES.map(([command, args, environment = {}]) =>
    commandLabel(command, args, environment));
}

function activeRulesetDetails(rulesets, expectedName) {
  return rulesets.find((ruleset) =>
    ruleset?.name === expectedName
    && ruleset?.enforcement === "active"
    && ruleset?.target === "branch");
}

export function evaluateSourceCandidate({
  policy,
  profile,
  artifactType,
  ref,
  headSha,
  checkedOutSha,
  originRepository,
  clean,
  reachableFromProduction,
  rulesets,
  productionEnvironment,
  pullRequest,
  statuses,
  checkRuns,
}) {
  const violations = [];
  const expectedType = policy.profiles?.[profile];
  if (!expectedType) {
    violations.push({ code: "profile", message: `El perfil ${profile || "(vacío)"} no es publicable.` });
  } else if (expectedType !== artifactType) {
    violations.push({
      code: "artifact-profile",
      message: `El perfil ${profile} debe producir ${expectedType}, no ${artifactType}.`,
    });
  }

  const expectedRef = `refs/heads/${policy.productionBranch}`;
  if (ref && ref !== expectedRef) {
    violations.push({ code: "ref", message: `Production solo admite ${expectedRef}; recibido ${ref}.` });
  }
  if (!clean) violations.push({ code: "dirty", message: "El checkout contiene cambios sin confirmar." });
  if (!reachableFromProduction) {
    violations.push({
      code: "unreachable",
      message: `El commit no es alcanzable desde origin/${policy.productionBranch}.`,
    });
  }
  if (!GIT_COMMIT_PATTERN.test(String(checkedOutSha ?? ""))) {
    violations.push({ code: "checkout-sha", message: "No se pudo resolver el SHA exacto del checkout." });
  }
  if (headSha && headSha !== checkedOutSha) {
    violations.push({ code: "sha", message: "GITHUB_SHA no coincide con el checkout validado." });
  }
  if (originRepository !== policy.repository) {
    violations.push({
      code: "origin",
      message: `origin debe apuntar a ${policy.repository}; recibido ${originRepository || "(desconocido)"}.`,
    });
  }

  const ruleset = activeRulesetDetails(rulesets, policy.rulesetName);
  if (!ruleset) {
    violations.push({ code: "ruleset", message: `No está activo el ruleset ${policy.rulesetName}.` });
  } else {
    if ((ruleset.bypass_actors ?? []).length > 0) {
      violations.push({ code: "ruleset-bypass", message: "El ruleset de Production contiene actores de bypass." });
    }
    const includesDefault = ruleset.conditions?.ref_name?.include?.includes("~DEFAULT_BRANCH");
    if (!includesDefault) {
      violations.push({ code: "ruleset-branch", message: "El ruleset no protege la rama por defecto." });
    }
    if (!ruleset.rules?.some((rule) => rule.type === "pull_request")) {
      violations.push({ code: "ruleset-pr", message: "El ruleset no exige pull request." });
    }
    const requiredRule = ruleset.rules?.find((rule) => rule.type === "required_status_checks");
    const contexts = new Set(
      requiredRule?.parameters?.required_status_checks?.map((check) => check.context) ?? [],
    );
    for (const context of policy.requiredStatusChecks) {
      if (!contexts.has(context)) {
        violations.push({ code: "ruleset-check", message: `El ruleset no exige ${context}.` });
      }
    }
  }

  if (productionEnvironment?.name !== policy.environment) {
    violations.push({ code: "environment", message: `No existe el environment ${policy.environment}.` });
  } else {
    const reviewerRules = productionEnvironment.protection_rules
      ?.filter((rule) => rule.type === "required_reviewers") ?? [];
    const reviewers = reviewerRules.flatMap((rule) => rule.reviewers ?? []);
    if (!reviewers.some((entry) => entry.reviewer?.login === policy.owner)) {
      violations.push({ code: "environment-reviewer", message: `${policy.owner} no aprueba Production.` });
    }
    const branchPolicy = productionEnvironment.deployment_branch_policy;
    if (!branchPolicy?.protected_branches || branchPolicy?.custom_branch_policies) {
      violations.push({
        code: "environment-branch",
        message: "Production debe admitir únicamente ramas protegidas.",
      });
    }
  }

  if (!pullRequest
    || pullRequest.state !== "closed"
    || !pullRequest.merged_at
    || pullRequest.base?.ref !== policy.productionBranch) {
    violations.push({
      code: "pull-request",
      message: `El commit no conserva una PR fusionada a ${policy.productionBranch}.`,
    });
  } else {
    const successfulStatuses = new Set(
      (statuses ?? [])
        .filter((status) => status.state === "success")
        .map((status) => status.context),
    );
    for (const context of policy.requiredStatusChecks.filter((name) => name !== "prompt-policy")) {
      if (!successfulStatuses.has(context)) {
        violations.push({
          code: "authorization-status",
          message: `La PR no conserva ${context} en success para su SHA exacto.`,
        });
      }
    }
    if (!(checkRuns ?? []).some((check) =>
      check.name === "prompt-policy" && check.conclusion === "success")) {
      violations.push({
        code: "authorization-check",
        message: "La PR no conserva prompt-policy en success para su SHA exacto.",
      });
    }
  }

  return { expectedType, ruleset, violations };
}

export function parseManifestXml(xml) {
  const attribute = (name) => xml.match(new RegExp(`${name}="([^"]+)"`))?.[1] ?? "";
  const permissions = [...xml.matchAll(/<uses-permission\b[^>]*android:name="([^"]+)"[^>]*>/g)]
    .map((match) => match[1].replace(/^android\.permission\./, ""));
  return {
    packageName: attribute("package"),
    versionCode: attribute("android:versionCode"),
    versionName: attribute("android:versionName"),
    minSdk: Number(attribute("android:minSdkVersion")),
    targetSdk: Number(attribute("android:targetSdkVersion")),
    permissions: [...new Set(permissions)].sort(),
  };
}

export function extractCertificateDigest(output) {
  return output.match(/certificate SHA-256 digest:\s*([A-Fa-f0-9:]+)/i)?.[1]
    ?? output.match(/SHA256:\s*([A-Fa-f0-9:]+)/i)?.[1]
    ?? "";
}

export function evaluateArtifactCandidate({
  policy,
  kind,
  sourceEvidence,
  manifest,
  appConfig,
  snapshot,
  certificateSha256,
  archiveListing,
  size,
  sha256,
}) {
  const violations = [];
  const expectedKind = policy.profiles?.[sourceEvidence?.profile];
  if (sourceEvidence?.schemaVersion !== 1 || sourceEvidence?.kind !== "ProductionSourceEvidenceV1") {
    violations.push({ code: "source-evidence", message: "La evidencia de fuente no cumple ProductionSourceEvidenceV1." });
  }
  if (sourceEvidence?.result !== "passed") {
    violations.push({ code: "source-result", message: "La evidencia de fuente no terminó correctamente." });
  }
  const allowedRefs = new Set([
    `refs/heads/${policy.productionBranch}`,
    `refs/remotes/origin/${policy.productionBranch}`,
  ]);
  const sourceStatuses = new Map(
    sourceEvidence?.remoteControls?.requiredStatuses
      ?.map((status) => [status.context, status.result]) ?? [],
  );
  const expectedGates = productionGateLabels();
  const observedGates = sourceEvidence?.gates ?? [];
  const sourceContractValid = GIT_COMMIT_PATTERN.test(String(sourceEvidence?.commit ?? ""))
    && allowedRefs.has(sourceEvidence?.ref)
    && sourceEvidence?.source?.clean === true
    && sourceEvidence?.source?.cleanAfterGates === true
    && sourceEvidence?.source?.reachableFromProduction === true
    && sourceEvidence?.source?.originRepository === policy.repository
    && sourceEvidence?.remoteControls?.rulesetName === policy.rulesetName
    && sourceEvidence?.remoteControls?.rulesetEnforcement === "active"
    && (sourceEvidence?.remoteControls?.bypassActors ?? []).length === 0
    && sourceEvidence?.remoteControls?.environment === policy.environment
    && sourceEvidence?.remoteControls?.protectedBranchesOnly === true
    && sourceEvidence?.remoteControls?.ownerReviewer === policy.owner
    && sourceEvidence?.remoteControls?.pullRequest?.headSha
    && policy.requiredStatusChecks.every((context) => sourceStatuses.get(context) === true)
    && observedGates.length === expectedGates.length
    && observedGates.every((gate, index) =>
      gate.command === expectedGates[index]
      && gate.result === "passed"
      && gate.exitCode === 0);
  if (!sourceContractValid) {
    violations.push({
      code: "source-contract",
      message: "La evidencia no conserva el commit, los controles remotos y todos los gates canónicos.",
    });
  }
  if (expectedKind !== kind || sourceEvidence?.artifactType !== kind) {
    violations.push({ code: "artifact-kind", message: "El artefacto no corresponde al perfil validado." });
  }
  if (!Number.isSafeInteger(size) || size <= 0) {
    violations.push({ code: "artifact-empty", message: "El artefacto está vacío." });
  }
  if (!SHA256_PATTERN.test(String(sha256 ?? ""))) {
    violations.push({ code: "artifact-sha", message: "No se pudo calcular un SHA-256 válido." });
  }

  const looksAab = /BUNDLE-METADATA\/|base\/manifest\/AndroidManifest\.xml/.test(archiveListing);
  const looksApk = /(^|\s)AndroidManifest\.xml(\s|$)/m.test(archiveListing) && !looksAab;
  if ((kind === "aab" && !looksAab) || (kind === "apk" && !looksApk)) {
    violations.push({ code: "archive-kind", message: `El contenido ZIP no corresponde a un ${kind.toUpperCase()}.` });
  }

  if (manifest.packageName !== policy.android.packageName) {
    violations.push({ code: "package", message: `Package inesperado: ${manifest.packageName || "(vacío)"}.` });
  }
  if (manifest.minSdk !== policy.android.minSdk || manifest.targetSdk !== policy.android.targetSdk) {
    violations.push({
      code: "sdk",
      message: `SDK inesperado: min ${manifest.minSdk}, target ${manifest.targetSdk}.`,
    });
  }
  if (!/^\d+$/.test(manifest.versionCode) || !manifest.versionName) {
    violations.push({ code: "version", message: "Falta versionName o versionCode en el manifest fusionado." });
  }

  const extra = appConfig?.extra ?? {};
  if (appConfig?.android?.package !== policy.android.packageName
    || extra.environment !== policy.android.environment
    || extra.channel !== policy.android.channel
    || extra.providerMode !== policy.android.providerMode) {
    violations.push({ code: "app-config", message: "app.config no describe la variante Production aprobada." });
  }
  if (appConfig?.version !== manifest.versionName) {
    violations.push({ code: "version-drift", message: "app.config y AndroidManifest discrepan en la versión." });
  }

  if (snapshot?.schemaVersion !== 2
    || snapshot?.environment !== policy.android.environment
    || snapshot?.channel !== policy.android.channel
    || !POLICY_CANDIDATE_PATTERN.test(String(snapshot?.candidate ?? ""))
    || !SHA256_PATTERN.test(String(snapshot?.sha256 ?? ""))
    || !SHA256_PATTERN.test(String(snapshot?.bundleSha256 ?? ""))
    || !SHA256_PATTERN.test(String(snapshot?.runtimePolicySha256 ?? ""))) {
    violations.push({ code: "snapshot", message: "El snapshot firmado de Production está ausente o incompleto." });
  }
  if (extra.policyCandidate !== snapshot?.candidate || extra.policySha256 !== snapshot?.sha256) {
    violations.push({ code: "snapshot-drift", message: "El snapshot preparado no coincide con app.config." });
  }

  const blockedPermissions = JSON.parse(readFileSync(
    join(repositoryRoot, "scripts", "android-permissions", "policy.json"),
    "utf8",
  )).blockedPermissions;
  for (const permission of blockedPermissions) {
    if (manifest.permissions.includes(permission)) {
      violations.push({ code: "permission", message: `El manifest fusionado contiene ${permission}.` });
    }
  }

  if (normalizeCertificateDigest(certificateSha256)
    !== normalizeCertificateDigest(policy.android.uploadCertificateSha256)) {
    violations.push({ code: "certificate", message: "El artefacto no usa el certificado de subida aprobado." });
  }

  return { violations, looksAab, looksApk };
}

export function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}
