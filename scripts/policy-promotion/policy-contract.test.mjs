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

test("staging y producción ejecutan la puerta sanitaria exacta", () => {
  const exactCommands = workflow.match(/^\s+run: npm run check:health-safety\s*$/gm) || [];
  assert.equal(exactCommands.length, 2);
  assert.doesNotMatch(workflow, /authorizingReport:\s*true/);
  assert.match(workflow, /\.authorizing == false and \.summary\.failed == 0/);
});

test("solo maximofn puede constar como propietario o aprobador", () => {
  assert.match(workflow, /owner:\s*"maximofn"/);
  assert.doesNotMatch(workflow, /owner:\s*"(?!maximofn")[^"]+"/);
  assert.match(workflow, /environment: Staging/);
  assert.match(workflow, /'Production Critical'/);
});

test("producción reutiliza candidato y digest de staging", () => {
  assert.match(workflow, /verify prior Staging deployment/);
  assert.match(workflow, /stagingDeploymentId/);
  assert.match(workflow, /ASSET_SHA="\$\(jq -r \.assetSha256 promotion-evidence\.json\)"/);
  assert.doesNotMatch(workflow, /raw\.githubusercontent\.com.*main.*prompts\/AGENTS\.md/);
  assert.match(workflow, /health-safety-runtime\.json/);
  assert.match(workflow, /runtimePolicySha256/);
  assert.equal((workflow.match(/schemaVersion: 2/g) || []).length, 3);
});

test("el bootstrap solo puede ejecutarse una vez desde el HEAD actual de main", () => {
  assert.match(workflow, /bootstrap_main:/);
  assert.match(workflow, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow, /test "\$SOURCE_COMMIT" = "\$GITHUB_SHA"/);
  const absenceChecks = workflow.match(/deployments\?task=gymnasia-policy&per_page=1/g) || [];
  assert.equal(absenceChecks.length, 2);
  assert.match(workflow, /bootstrap_main is disabled after the first policy deployment/);
  assert.match(workflow, /another policy deployment won the bootstrap race/);
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
