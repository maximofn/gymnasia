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
  assert.match(buildWorkflow, /PROFILE="production-apk"/);
  assert.match(buildWorkflow, /environment: Production/);
  assert.match(buildWorkflow, /Prepare integrated snapshot from the Production policy channel/);
  assert.match(buildWorkflow, /--environment production/);
  assert.doesNotMatch(buildWorkflow, /--environment staging/);
  assert.doesNotMatch(buildWorkflow, /inputs\.profile/);
  assert.match(buildWorkflow, /Create draft APK release/);
  assert.match(buildWorkflow, /Attach APK before publishing release/);
  const snapshotScript = readFileSync(
    new URL("./prepare-policy-snapshot.mjs", import.meta.url),
    "utf8",
  );
  assert.match(snapshotScript, /policySnapshot\.generated\.json/);
  assert.match(snapshotScript, /healthSafetyPolicy\.generated\.ts/);
  assert.match(snapshotScript, /runtimePolicySha256/);
});
