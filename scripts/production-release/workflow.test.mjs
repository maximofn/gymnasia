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

test("consulta EAS con filtros estables y valida la identidad localmente", () => {
  assert.match(
    workflow,
    /eas build:list --platform android[\s\\]*--limit 50 --offset "\$EAS_OFFSET" --json/,
    "la consulta preventiva debe evitar los filtros remotos que fallan en EAS",
  );
  assert.match(workflow, /EAS_OFFSET=\$\(\(EAS_OFFSET \+ 50\)\)/, "la consulta debe paginar todo el historial");
  assert.match(
    workflow,
    /--arg profile "production-apk"[\s\S]*--arg version "\$VERSION"[\s\S]*--arg sourceCommit "\$SOURCE_COMMIT"[\s\S]*--arg message "android-v\$\{VERSION\}"/,
    "la adopción debe comprobar perfil, versión, commit y mensaje",
  );
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
