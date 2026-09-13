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

test("pagina EAS y valida localmente la identidad de builds y submissions", () => {
  assert.match(
    workflow,
    /eas build:list --platform android[\s\\]*--limit 50 --offset "\$offset" --json/,
    "la consulta preventiva debe evitar los filtros remotos que fallan en EAS",
  );
  assert.match(workflow, /eas submit:list --platform android[\s\\]*--limit 50 --offset "\$offset" --json/);
  assert.match(workflow, /offset=\$\(\(offset \+ 50\)\)/, "las consultas deben paginar todo el historial");
  assert.match(workflow, /eas-release\.mjs select-build/);
  assert.match(workflow, /--profile "\$profile"[\s\S]*--version "\$VERSION"[\s\S]*--commit "\$SOURCE_COMMIT"[\s\S]*--message "\$message"/);
  assert.match(workflow, /eas-release\.mjs select-submission/);
  assert.match(workflow, /--build-id "\$AAB_BUILD_ID"[\s\S]*--track internal[\s\S]*--release-status completed/);
});

test("construye AAB antes que APK y fija las herramientas", () => {
  assert.ok(workflow.indexOf("ensure_build aab production") < workflow.indexOf("ensure_build apk production-apk"));
  assert.match(workflow, /eas-version: 24\.3\.0/);
  assert.match(workflow, /bundletool\.sha256/);
  assert.match(workflow, /sha256sum --check --strict/);
});

test("verifica AAB, APK y Play antes de hacer inmutable la release", () => {
  const verify = workflow.indexOf("Verify draft identity, both artifacts and Play evidence chain");
  const publish = workflow.indexOf("Publish immutable Android release");
  assert.ok(verify >= 0, "falta verificar la cadena de evidencia del draft");
  assert.ok(publish > verify, "la release solo puede publicarse después de verificar sus hashes");
  assert.match(workflow, /production-aab-evidence\.json/);
  assert.match(workflow, /production-apk-evidence\.json/);
  assert.match(workflow, /production-play-evidence\.json/);
  assert.match(workflow, /\.legs\[\$leg\]\.artifact\.evidenceSha256/);
  assert.match(workflow, /ASSET_DIGEST production-source-evidence\.json/);
  assert.match(workflow, /\.source\.evidenceSha256/);
});

test("usa Play Internal sin aprobador para el envío automático y conserva el orden recuperable", () => {
  assert.match(workflow, /environment: Play Internal/);
  assert.match(workflow, /PLAY_VERSION_CODE_FLOOR/);
  assert.match(workflow, /eas submit --platform android --profile production/);
  assert.match(workflow, /eas submit:view "\$SUBMISSION_ID" --json/);
  assert.match(workflow, /eas submit:retry "\$SUBMISSION_ID"/);
  assert.ok(
    workflow.indexOf("--event intent --leg play")
      < workflow.indexOf("eas submit --platform android --profile production"),
    "la intención durable debe guardarse antes de crear la submission",
  );
  assert.match(workflow, /la intención durable impide repetirla automáticamente/i);
  assert.match(workflow, /android-production-release/);
  assert.match(workflow, /cancel-in-progress: false/);
});
