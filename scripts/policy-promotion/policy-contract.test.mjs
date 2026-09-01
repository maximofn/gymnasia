import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../../.github/workflows/promote-policy.yml", import.meta.url),
  "utf8",
);
const buildWorkflow = readFileSync(
  new URL("../../.github/workflows/build-apk.yml", import.meta.url),
  "utf8",
);
const auditSource = readFileSync(
  new URL("./policy-audit.mjs", import.meta.url),
  "utf8",
);
const eas = JSON.parse(readFileSync(
  new URL("../../apps/mobile/eas.json", import.meta.url),
  "utf8",
));

test("staging y producción ejecutan la puerta sanitaria determinista", () => {
  assert.equal((workflow.match(/^\s+npm run check:health-safety\s*$/gm) || []).length, 2);
  assert.doesNotMatch(workflow, /authorizingReport:\s*true/);
  assert.match(workflow, /authorizingReport: false/);
  assert.match(workflow, /npm run report:health-safety/);
});

test("solo maximofn puede constar como propietario o aprobador", () => {
  assert.match(workflow, /owner:\s*"maximofn"/);
  assert.doesNotMatch(workflow, /owner:\s*"(?!maximofn")[^"]+"/);
  assert.match(workflow, /environment: Staging/);
  assert.match(workflow, /'Production Critical'/);
  assert.match(workflow, /gymnasia\/owner-authorization/);
});

test("producción reutiliza exactamente el bundle firmado de staging", () => {
  assert.match(workflow, /deployments\?environment=Staging/);
  assert.match(workflow, /STAGING_ID/);
  assert.match(workflow, /policy\.bundle\.json/);
  assert.match(workflow, /policy\.bundle\.signature\.json/);
  assert.match(workflow, /bundleSha256/);
  assert.match(workflow, /sourceCommit/);
  assert.doesNotMatch(workflow, /raw\.githubusercontent\.com.*main.*prompts\/AGENTS\.md/);
  assert.ok((workflow.match(/schemaVersion: 3/g) || []).length >= 2);
});

test("activación y rollback están firmados fuera de GitHub", () => {
  assert.match(workflow, /activation_base64/);
  assert.match(workflow, /activation_signature_base64/);
  assert.match(workflow, /verify-artifacts\.mjs/);
  assert.match(workflow, /trusted-roots\.json/);
  assert.match(workflow, /operation == 'rollback'/);
  assert.match(workflow, /fromBundleId/);
  assert.match(workflow, /LATEST_SEQUENCE/);
  assert.match(workflow, /LATEST_STAGING_CANDIDATE/);
  assert.match(workflow, /max_by\(\.payload\.activation\.sequence\)/);
  assert.match(workflow, /test "\$CANDIDATE" = "\$LATEST_STAGING_CANDIDATE"/);
  assert.doesNotMatch(workflow, /BITWARDEN_POLICY_(?:ROOT|SIGNER)_ITEM_ID/);
  assert.doesNotMatch(workflow, /ed25519_pkcs8_base64/);
});

test("toda operación exige motivo cerrado y termina en auditoría separada", () => {
  assert.match(workflow, /reason_code:/);
  for (const reason of [
    "routine-release",
    "critical-policy-fix",
    "incident-response",
    "rollback-drill",
  ]) {
    assert.match(workflow, new RegExp(reason));
  }
  assert.match(workflow, /audit-and-notify:/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /gymnasia-policy-audit|policy-audit\.mjs/);
  assert.match(workflow, /POLICY_TELEGRAM_BOT_TOKEN/);
  assert.match(workflow, /POLICY_TELEGRAM_CHAT_ID/);
  assert.doesNotMatch(workflow, /^\s+TELEGRAM_(?:BOT_TOKEN|CHAT_ID):/m);
  assert.match(auditSource, /POLICY_AUDIT_TASK = "gymnasia-policy-audit"/);
  assert.match(auditSource, /auto_inactive: false/);
  assert.doesNotMatch(auditSource, /POLICY_AUDIT_TASK = "gymnasia-policy"/);
});

test("el arranque inicial firmado solo se admite una vez desde main protegido", () => {
  assert.match(workflow, /bootstrap_main/);
  assert.match(workflow, /bootstrap_main requires the current main HEAD/);
  assert.match(workflow, /bootstrap_main is disabled after the first signed policy deployment/);
  assert.match(workflow, /bootstrap_main and pr_number are mutually exclusive/);
  assert.match(workflow, /select\(\.payload\.schemaVersion == 3\)/);
});

test("la paginación de gh es compatible con la versión del runner", () => {
  const unfoldedWorkflow = workflow.replace(/\\\r?\n\s*/g, " ");
  assert.doesNotMatch(unfoldedWorkflow, /gh api[^\n]*--slurp[^\n]*--jq/);
  assert.doesNotMatch(unfoldedWorkflow, /gh api[^\n]*--jq[^\n]*--slurp/);
  assert.match(unfoldedWorkflow, /gh api --paginate --slurp[^\n]*\| jq 'add \|/);
});

test("el verificador confiable siempre procede de main", () => {
  assert.equal((workflow.match(/test "\$GITHUB_REF" = "refs\/heads\/main"/g) || []).length, 2);
  assert.equal((workflow.match(/fetch --no-tags --depth=1 origin "\$GITHUB_SHA"/g) || []).length, 2);
});

test("EAS conserva perfiles locales y publica únicamente production-apk", () => {
  assert.equal(eas.build.preview.extends, "staging");
  assert.equal(eas.build.staging.env.APP_ENV, "staging");
  assert.equal(eas.build.staging.android.buildType, "apk");
  assert.equal(eas.build.production.env.APP_ENV, "production");
  assert.equal(eas.build["production-apk"].extends, "production");
  assert.equal(eas.build["production-apk"].android.buildType, "apk");
  assert.match(buildWorkflow, /--profile production-apk/);
  assert.match(buildWorkflow, /environment: Production/);
  assert.match(buildWorkflow, /Prepare new immutable policy inputs/);
  assert.match(buildWorkflow, /--environment production/);
  assert.doesNotMatch(buildWorkflow, /--environment staging/);
  assert.doesNotMatch(buildWorkflow, /inputs\.profile/);
  assert.match(buildWorkflow, /^  validate-production:$/m);
  assert.match(buildWorkflow, /^  select-transaction:$/m);
  assert.match(buildWorkflow, /^  build-and-release:\n    needs: \[select-transaction, validate-production\]$/m);
  const validationJob = buildWorkflow.slice(
    buildWorkflow.indexOf("  validate-production:"),
    buildWorkflow.indexOf("  build-and-release:"),
  );
  assert.doesNotMatch(validationJob, /^    environment:/m);
  assert.doesNotMatch(validationJob, /EXPO_TOKEN/);
  assert.match(validationJob, /verify:production-source/);
  assert.match(validationJob, /--profile production-apk/);
  assert.match(validationJob, /--artifact-type apk/);
  assert.match(validationJob, /--expected-version/);
  assert.match(buildWorkflow, /verify:production-artifact/);
  assert.match(buildWorkflow, /production-source-evidence\.json/);
  assert.match(buildWorkflow, /production-artifact-evidence\.json/);
  assert.match(buildWorkflow, /Create durable draft before EAS/);
  assert.match(buildWorkflow, /Attach verified APK and immutable evidence/);
  assert.match(buildWorkflow, /android-production-release/);
  assert.match(buildWorkflow, /cancel-in-progress: false/);
  assert.match(buildWorkflow, /release-transaction\.mjs select-remote/);
  assert.match(buildWorkflow, /--no-wait --json/);
  assert.match(buildWorkflow, /eas build:view/);
  assert.match(buildWorkflow, /Download APK to quarantine path/);
  assert.match(buildWorkflow, /--published-filename gymnasia\.apk/);
  assert.doesNotMatch(buildWorkflow, /Update version in app\.json/);
  assert.doesNotMatch(buildWorkflow, /Compute next version from conventional commits/);
  const snapshotScript = readFileSync(
    new URL("./prepare-policy-snapshot.mjs", import.meta.url),
    "utf8",
  );
  assert.match(snapshotScript, /policySnapshot\.generated\.json/);
  assert.match(snapshotScript, /healthSafetyPolicy\.generated\.ts/);
  assert.match(snapshotScript, /runtimePolicySha256/);
});
