import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/build-apk.yml", import.meta.url), "utf8");
const localBuild = readFileSync(new URL("./run-local-build.mjs", import.meta.url), "utf8");
const submit = readFileSync(new URL("./eas-submit.mjs", import.meta.url), "utf8");

test("mantiene filtros, cola y aprobación humana de Production", () => {
  assert.match(workflow, /name: Build Android APK \+ AAB on wallabot & Publish Play Internal/);
  assert.match(workflow, /group: android-production-release/);
  assert.match(workflow, /cancel-in-progress: false/);
  for (const path of ["apps/mobile/**", "!apps/mobile/scripts/**", "!apps/mobile/**/*.md", "!apps/mobile/public/**"]) {
    assert.ok(workflow.includes(`- "${path}"`));
  }
  assert.equal((workflow.match(/environment: Production/g) ?? []).length, 1);
  const compile = workflow.slice(workflow.indexOf("  compile-android:"), workflow.indexOf("  verify-artifacts:"));
  assert.match(compile, /environment: Production/);
  assert.ok(compile.indexOf("environment: Production") < compile.indexOf("Build AAB first and APK second"));
});

test("ejecuta una sola evidencia de fuente V2 para AAB y APK", () => {
  assert.equal((workflow.match(/npm run verify:production-source/g) ?? []).length, 1);
  assert.doesNotMatch(workflow, /--profile production-apk\s+--artifact-type apk/);
  assert.match(workflow, /Validate one source for both Android artifacts/);
  assert.match(readFileSync(new URL("./verify-source.mjs", import.meta.url), "utf8"), /ProductionSourceEvidenceV2/);
});

test("solo wallabot compila y lo hace AAB antes de APK sin builds cloud", () => {
  assert.equal((workflow.match(/runs-on: \[self-hosted/g) ?? []).length, 1);
  const job = workflow.slice(workflow.indexOf("  compile-android:"), workflow.indexOf("  verify-artifacts:"));
  assert.match(job, /runs-on: \[self-hosted, linux, x64, wallabot, android-build/);
  assert.match(job, /environment: Production/);
  assert.match(job, /permissions:\n      contents: read/);
  assert.doesNotMatch(job, /contents: write|gh release|sudo|docker/);
  assert.doesNotMatch(workflow, /eas build(?::|\s)/);
  assert.ok(localBuild.indexOf('aab: { profile: "production"') < localBuild.indexOf('apk: { profile: "production-apk"'));
  assert.match(localBuild, /"--local", "--non-interactive", "--freeze-credentials"/);
  assert.doesNotMatch(localBuild, /--auto-submit|build:list|build:view/);
});

test("fija herramientas y verifica bundletool antes del AAB", () => {
  assert.match(workflow, /eas-version: 24\.3\.0/);
  assert.match(workflow, /echo "\$\{BUNDLETOOL_SHA\}  \/tmp\/bundletool\.jar" \| sha256sum --check --strict/);
  const policy = JSON.parse(readFileSync(new URL("./policy.json", import.meta.url)));
  assert.equal(policy.bundletool.version, "1.18.3");
  assert.equal(policy.bundletool.sha256, "a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29");
});

test("eas.json reserva el código con AAB y lo reutiliza en APK y Play Interno", () => {
  const eas = JSON.parse(readFileSync(new URL("../../apps/mobile/eas.json", import.meta.url)));
  assert.equal(eas.cli.version, "24.3.0");
  assert.equal(eas.cli.appVersionSource, "remote");
  assert.equal(eas.build.production.autoIncrement, true);
  assert.equal(eas.build["production-apk"].autoIncrement, false);
  assert.deepEqual(eas.submit.production.android, { track: "internal", releaseStatus: "completed" });
});

test("sube solo el AAB validado por path y persiste intención e ID", () => {
  assert.match(submit, /"submit", "--platform", "android", "--profile", "production"/);
  assert.match(submit, /"--path", resolve\(options\.artifact\)/);
  assert.doesNotMatch(submit, /"--id"|submittedBuild/);
  const intent = workflow.indexOf("Persist submission intent before contacting EAS");
  const create = workflow.indexOf("Submit only the validated wallabot AAB");
  const adopt = workflow.indexOf("Adopt the exact submission ID durably");
  assert.ok(intent >= 0 && intent < create && create < adopt);
  assert.match(workflow, /Refuse to duplicate an uncertain path submission/);
  assert.match(workflow, /--event fail-play --leg play --uncertain true/);
});

test("Play Internal es automático después de Production y usa su propio token", () => {
  const playJob = workflow.slice(workflow.indexOf("  submit-play-and-release:"), workflow.indexOf("  enqueue-next:"));
  assert.equal((workflow.match(/environment: Play Internal/g) ?? []).length, 1);
  assert.match(playJob, /environment: Play Internal/);
  assert.match(playJob, /token: \$\{\{ secrets\.EXPO_TOKEN \}\}/);
  assert.match(playJob, /needs\.verify-artifacts\.result == 'success'/);
  assert.match(workflow, /PLAY_VERSION_CODE_FLOOR: \$\{\{ vars\.PLAY_VERSION_CODE_FLOOR \}\}/);
});

test("reintenta submission conocido y nunca salta automáticamente una versión fallida", () => {
  assert.match(submit, /"submit:retry", options\["submission-id"\]/);
  assert.match(workflow, /options: \[reconcile, retry-failed, adopt-submission, supersede-failed\]/);
  assert.match(workflow, /start-play-retry/);
  assert.match(workflow, /Adopt a manually reconciled uncertain submission/);
});

test("la release sigue en draft hasta verificar AAB, APK y Play", () => {
  const verifyAssets = workflow.indexOf("Verify durable draft contains both validated artifacts");
  const playEvidence = workflow.indexOf("Create and bind Play evidence");
  const publish = workflow.indexOf("gh release edit \"$TAG\" --repo \"$GITHUB_REPOSITORY\" --draft=false --latest");
  assert.ok(verifyAssets >= 0 && verifyAssets < playEvidence && playEvidence < publish);
  for (const asset of [
    "gymnasia.aab", "gymnasia.apk", "production-aab-evidence.json", "production-apk-evidence.json",
    "production-play-evidence.json", "production-source-evidence.json", "android-release-transaction.json",
  ]) assert.ok(workflow.includes(asset));
  assert.match(workflow, /versionCode:/);
  assert.match(workflow, /EAS submission:/);
  assert.match(workflow, /Play: \\`internal \/ completed \/ FINISHED\\`/);
});
