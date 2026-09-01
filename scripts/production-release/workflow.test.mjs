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
