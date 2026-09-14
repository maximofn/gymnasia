import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/build-apk.yml", import.meta.url), "utf8");

test("instala Chromium antes de ejecutar los E2E de la puerta de Production", () => {
  const install = workflow.indexOf("npm exec -- playwright install --with-deps chromium");
  const validate = workflow.indexOf("npm run verify:production-source");

  assert.ok(install >= 0, "falta instalar Chromium en el runner limpio");
  assert.ok(validate >= 0, "falta la verificación de la fuente de Production");
  assert.ok(install < validate, "Chromium debe instalarse antes de lanzar los E2E");
});

test("el selector puede descubrir releases borrador", () => {
  assert.match(
    workflow,
    /select-transaction:[\s\S]*?permissions:\n(?:\s+#.*\n)*\s+contents: write[\s\S]*?validate-production:/,
    "GitHub oculta los drafts a tokens sin acceso de escritura",
  );
});

test("lee el borrador duradero por ID después de adjuntar evidencias", () => {
  assert.doesNotMatch(
    workflow,
    /gh api "\/repos\/\$\{GITHUB_REPOSITORY\}\/releases\/tags\/\$\{TAG\}"/,
    "el endpoint por tag devuelve 404 mientras la release sigue en borrador",
  );
  assert.equal(
    [...workflow.matchAll(/gh api "\/repos\/\$\{GITHUB_REPOSITORY\}\/releases\/\$\{RELEASE_ID\}"/g)].length,
    2,
    "adjuntar el APK y verificar el borrador deben reutilizar el ID duradero seleccionado",
  );
});

test("solo compila localmente y no consulta recursos remotos de EAS", () => {
  assert.doesNotMatch(workflow, /eas build(?::|\s)|eas-version: latest|apk_url|build_id/);
  const script = readFileSync(new URL("./run-local-build.mjs", import.meta.url), "utf8");
  assert.match(script, /"eas", \["build", "--platform", "android", "--profile", "production-apk",\s*"--local", "--non-interactive", "--freeze-credentials", "--output", output\]/);
  assert.doesNotMatch(script, /build:list|build:view|--no-wait|--auto-submit/);
});

test("solo el job de compilación usa wallabot y permisos de lectura", () => {
  const job = workflow.slice(workflow.indexOf("  compile-android:"), workflow.indexOf("  verify-and-release:"));
  assert.match(job, /runs-on: \[self-hosted, linux, x64, wallabot, android-build, "gymnasia-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}"\]/);
  assert.match(job, /github.repository == 'maximofn\/gymnasia' && github.ref == 'refs\/heads\/main'/);
  assert.match(job, /ref: \$\{\{ needs.validate-production.outputs.source_commit \}\}/);
  assert.match(job, /needs.validate-production.result == 'success'/);
  assert.match(job, /environment: Production/);
  assert.match(job, /permissions:\n      contents: read/);
  assert.doesNotMatch(job, /contents: write|gh release|sudo|docker/);
  assert.equal((workflow.match(/runs-on: \[self-hosted/g) ?? []).length, 1);
  assert.doesNotMatch(workflow, /pull_request:/);
});

test("reserva antes de despachar y verifica el artifact antes de adjuntar o publicar", () => {
  assert.ok(workflow.indexOf("Reserve local attempt durably") < workflow.indexOf("  compile-android:"));
  const verify = workflow.indexOf("      - name: Verify quarantined Production APK");
  assert.ok(verify > workflow.indexOf("      - name: Download APK to quarantine path"));
  assert.ok(verify < workflow.indexOf("      - name: Attach verified APK"));
  assert.match(workflow, /--transaction \/tmp\/android-release-transaction.json/);
  assert.match(workflow, /--previous-evidence \/tmp\/inputs\/previous-artifact-evidence.json/);
  assert.match(workflow, /test -f \/tmp\/quarantine\/gymnasia.apk/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.match(workflow, /--event fail-local --reason/);
  assert.match(workflow, /if: failure\(\) \|\| cancelled\(\)/);
});

test("verifica la cadena de hashes antes de hacer inmutable la release", () => {
  const verify = workflow.indexOf("Verify draft identity, bounds, MIME and evidence chain");
  const publish = workflow.indexOf("Publish immutable APK release");
  assert.ok(verify >= 0, "falta verificar la cadena de evidencia del draft");
  assert.ok(publish > verify, "la release solo puede publicarse después de verificar sus hashes");
  assert.match(workflow, /ASSET_DIGEST production-artifact-evidence\.json/);
  assert.match(workflow, /\.artifact\.evidenceSha256/);
  assert.match(workflow, /ASSET_DIGEST production-source-evidence\.json/);
  assert.match(workflow, /\.source\.evidenceSha256/);
});
