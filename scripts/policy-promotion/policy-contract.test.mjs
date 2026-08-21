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
});

test("EAS conserva preview como alias de staging y separa producción", () => {
  assert.equal(eas.build.preview.extends, "staging");
  assert.equal(eas.build.staging.env.APP_ENV, "staging");
  assert.equal(eas.build.staging.android.buildType, "apk");
  assert.equal(eas.build.production.env.APP_ENV, "production");
  assert.match(buildWorkflow, /Prepare integrated snapshot from the active policy channel/);
  assert.match(buildWorkflow, /Create draft APK release/);
  assert.match(buildWorkflow, /Attach APK before publishing release/);
  const snapshotScript = readFileSync(
    new URL("./prepare-policy-snapshot.mjs", import.meta.url),
    "utf8",
  );
  assert.match(snapshotScript, /policySnapshot\.generated\.json/);
});
