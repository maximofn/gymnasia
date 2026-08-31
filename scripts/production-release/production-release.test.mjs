import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";

import {
  PRODUCTION_GATES,
  evaluateArtifactCandidate,
  evaluateSourceCandidate,
  extractCertificateDigest,
  loadReleasePolicy,
  normalizeCertificateDigest,
  parseManifestXml,
  productionGateLabels,
} from "./production-release.mjs";

const policy = loadReleasePolicy();
const commit = "a".repeat(40);

function validRuleset() {
  return {
    id: 21080538,
    name: policy.rulesetName,
    enforcement: "active",
    target: "branch",
    bypass_actors: [],
    conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
    rules: [
      { type: "pull_request" },
      {
        type: "required_status_checks",
        parameters: {
          required_status_checks: policy.requiredStatusChecks.map((context) => ({ context })),
        },
      },
    ],
  };
}

function validEnvironment() {
  return {
    name: policy.environment,
    protection_rules: [{
      type: "required_reviewers",
      prevent_self_review: false,
      reviewers: [{ reviewer: { login: policy.owner } }],
    }],
    deployment_branch_policy: { protected_branches: true, custom_branch_policies: false },
  };
}

function sourceInput(overrides = {}) {
  return {
    policy,
    profile: "production",
    artifactType: "aab",
    ref: "refs/heads/main",
    headSha: commit,
    checkedOutSha: commit,
    originRepository: policy.repository,
    clean: true,
    reachableFromProduction: true,
    rulesets: [validRuleset()],
    productionEnvironment: validEnvironment(),
    pullRequest: {
      number: 122,
      state: "closed",
      merged_at: "2026-08-31T05:43:11Z",
      base: { ref: "main" },
      head: { sha: "b".repeat(40) },
    },
    statuses: [
      { context: "gymnasia/owner-authorization", state: "success" },
      { context: "gymnasia/policy-promotion", state: "success" },
    ],
    checkRuns: [{ name: "prompt-policy", conclusion: "success" }],
    ...overrides,
  };
}

test("la fuente válida exige main, controles remotos y perfil coherente", () => {
  assert.deepEqual(evaluateSourceCandidate(sourceInput()).violations, []);
  assert.deepEqual(evaluateSourceCandidate(sourceInput({
    profile: "production-apk",
    artifactType: "apk",
  })).violations, []);
});

test("rechaza ramas, commits sucios/no alcanzables y perfiles cruzados", () => {
  const violations = evaluateSourceCandidate(sourceInput({
    ref: "refs/heads/feature",
    clean: false,
    reachableFromProduction: false,
    artifactType: "apk",
  })).violations;
  assert.deepEqual(
    new Set(violations.map((violation) => violation.code)),
    new Set(["artifact-profile", "ref", "dirty", "unreachable"]),
  );
});

test("rechaza que origin sea un fork aunque el commit parezca alcanzable", () => {
  const violations = evaluateSourceCandidate(sourceInput({
    originRepository: "attacker/gymnasia",
  })).violations;
  assert.ok(violations.some((violation) => violation.code === "origin"));
});

test("rechaza un commit sin PR o sin autorización sobre el SHA de la PR", () => {
  const withoutPr = evaluateSourceCandidate(sourceInput({ pullRequest: null })).violations;
  assert.ok(withoutPr.some((violation) => violation.code === "pull-request"));
  const withoutStatuses = evaluateSourceCandidate(sourceInput({ statuses: [], checkRuns: [] })).violations;
  assert.ok(withoutStatuses.some((violation) => violation.code === "authorization-status"));
  assert.ok(withoutStatuses.some((violation) => violation.code === "authorization-check"));
});

test("rechaza cualquier deriva del ruleset o del environment", () => {
  const brokenRuleset = validRuleset();
  brokenRuleset.bypass_actors = [{ actor_id: 1 }];
  brokenRuleset.rules = brokenRuleset.rules.filter((rule) => rule.type !== "pull_request");
  brokenRuleset.rules.find((rule) => rule.type === "required_status_checks")
    .parameters.required_status_checks = [];
  const environment = validEnvironment();
  environment.deployment_branch_policy.protected_branches = false;
  environment.protection_rules[0].reviewers = [];
  const codes = evaluateSourceCandidate(sourceInput({
    rulesets: [brokenRuleset],
    productionEnvironment: environment,
  })).violations.map((violation) => violation.code);
  for (const code of [
    "ruleset-bypass",
    "ruleset-pr",
    "ruleset-check",
    "environment-reviewer",
    "environment-branch",
  ]) {
    assert.ok(codes.includes(code), code);
  }
});

test("propiedad: ningún ref distinto de main resulta publicable", () => {
  fc.assert(fc.property(
    fc.stringMatching(/^[a-z][a-z0-9/-]{0,40}$/).filter((branch) => branch !== "main"),
    (branch) => {
      const result = evaluateSourceCandidate(sourceInput({ ref: `refs/heads/${branch}` }));
      assert.ok(result.violations.some((violation) => violation.code === "ref"));
    },
  ));
});

test("la lista canónica incluye los gates críticos y los dos E2E", () => {
  const commands = PRODUCTION_GATES.map(([command, args, environment = {}]) => [
    ...Object.entries(environment).map(([key, value]) => `${key}=${value}`),
    command,
    ...args,
  ].join(" "));
  for (const required of [
    "npm run check:prompt-policy",
    "npm run check:health-safety",
    "npm run check:android-permissions",
    "npm test",
    "npm --workspace apps/mobile exec tsc --noEmit",
    "APP_ENV=production npm --workspace apps/mobile exec -- expo export --platform android --dev",
    "npm run test:agent:e2e",
    "npm run test:train:e2e",
  ]) {
    assert.ok(commands.includes(required), required);
  }
});

test("la política fija un certificado SHA-256 y solo los dos perfiles Production", () => {
  assert.deepEqual(Object.keys(policy.profiles).sort(), ["production", "production-apk"]);
  assert.match(normalizeCertificateDigest(policy.android.uploadCertificateSha256), /^[A-F0-9]{64}$/);
});

const validManifest = {
  packageName: policy.android.packageName,
  versionCode: "17",
  versionName: "1.29.0",
  minSdk: policy.android.minSdk,
  targetSdk: policy.android.targetSdk,
  permissions: ["CAMERA", "POST_NOTIFICATIONS"],
};
const validSnapshot = {
  schemaVersion: 2,
  environment: "production",
  channel: "Production",
  candidate: "policy-v2026.08.3-ba9dc95f307b",
  sha256: "b".repeat(64),
  bundleSha256: "c".repeat(64),
  runtimePolicySha256: "d".repeat(64),
  sequence: 3,
};
const validAppConfig = {
  version: validManifest.versionName,
  android: { package: policy.android.packageName },
  extra: {
    environment: "production",
    channel: "Production",
    providerMode: "byok",
    policyCandidate: validSnapshot.candidate,
    policySha256: validSnapshot.sha256,
  },
};
const validSourceEvidence = {
  schemaVersion: 1,
  kind: "ProductionSourceEvidenceV1",
  result: "passed",
  commit,
  ref: "refs/heads/main",
  profile: "production",
  artifactType: "aab",
  source: {
    clean: true,
    cleanAfterGates: true,
    reachableFromProduction: true,
    originRepository: policy.repository,
  },
  remoteControls: {
    rulesetName: policy.rulesetName,
    rulesetEnforcement: "active",
    bypassActors: [],
    environment: policy.environment,
    protectedBranchesOnly: true,
    ownerReviewer: policy.owner,
    pullRequest: { headSha: "b".repeat(40) },
    requiredStatuses: policy.requiredStatusChecks.map((context) => ({ context, result: true })),
  },
  gates: productionGateLabels().map((command) => ({
    command,
    result: "passed",
    exitCode: 0,
  })),
};

function artifactInput(overrides = {}) {
  return {
    policy,
    kind: "aab",
    sourceEvidence: validSourceEvidence,
    manifest: validManifest,
    appConfig: validAppConfig,
    snapshot: validSnapshot,
    certificateSha256: policy.android.uploadCertificateSha256,
    archiveListing: "BUNDLE-METADATA/ base/manifest/AndroidManifest.xml",
    size: 1024,
    sha256: "e".repeat(64),
    ...overrides,
  };
}

test("acepta un AAB de Production con fuente, snapshot y firma coherentes", () => {
  assert.deepEqual(evaluateArtifactCandidate(artifactInput()).violations, []);
});

test("rechaza AAB vacío, permiso prohibido, snapshot ausente y firma distinta", () => {
  const violations = evaluateArtifactCandidate(artifactInput({
    size: 0,
    manifest: { ...validManifest, permissions: ["USE_EXACT_ALARM"] },
    snapshot: { ...validSnapshot, schemaVersion: 1 },
    certificateSha256: "00".repeat(32),
  })).violations;
  for (const code of ["artifact-empty", "snapshot", "permission", "certificate"]) {
    assert.ok(violations.some((violation) => violation.code === code), code);
  }
});

test("rechaza evidencia fuente incompleta aunque declare passed", () => {
  const sourceEvidence = {
    ...validSourceEvidence,
    gates: validSourceEvidence.gates.slice(0, -1),
  };
  const violations = evaluateArtifactCandidate(artifactInput({ sourceEvidence })).violations;
  assert.ok(violations.some((violation) => violation.code === "source-contract"));
});

test("rechaza que un AAB se presente como APK", () => {
  const sourceEvidence = { ...validSourceEvidence, profile: "production-apk", artifactType: "apk" };
  const violations = evaluateArtifactCandidate(artifactInput({
    kind: "apk",
    sourceEvidence,
  })).violations;
  assert.ok(violations.some((violation) => violation.code === "archive-kind"));
});

test("parsea manifest y huellas de las herramientas Android", () => {
  const manifest = parseManifestXml(`<manifest package="com.maximofn.gymnasia" android:versionCode="17" android:versionName="1.29.0">
    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/>
    <uses-permission android:name="android.permission.CAMERA"/>
  </manifest>`);
  assert.deepEqual(manifest, {
    packageName: "com.maximofn.gymnasia",
    versionCode: "17",
    versionName: "1.29.0",
    minSdk: 24,
    targetSdk: 36,
    permissions: ["CAMERA"],
  });
  assert.equal(extractCertificateDigest("Signer #1 certificate SHA-256 digest: AABB"), "AABB");
  assert.equal(extractCertificateDigest("SHA256: AA:BB"), "AA:BB");
  assert.equal(normalizeCertificateDigest("aa:bb"), "AABB");
});
