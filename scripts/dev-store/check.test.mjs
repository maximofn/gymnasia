import assert from "node:assert/strict";
import test from "node:test";

import {
  checkDevStoreGuard,
  evaluateDevStoreGuard,
} from "./check.mjs";

test("el repositorio real ignora el espejo y no lo versiona", () => {
  assert.deepEqual(checkDevStoreGuard(), []);
});

test("detecta la retirada de la regla de ignore", () => {
  assert.deepEqual(
    evaluateDevStoreGuard({ gitignore: "node_modules\n", trackedOutput: "" }),
    [".dev-store.json no está protegido por .gitignore"],
  );
});

test("detecta incluso un alta forzada en el índice", () => {
  assert.deepEqual(
    evaluateDevStoreGuard({
      gitignore: ".dev-store.json\n",
      trackedOutput: "100644 deadbeef 0\tapps/mobile/.dev-store.json\n",
    }),
    ["apps/mobile/.dev-store.json está versionado"],
  );
});
