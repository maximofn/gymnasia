// Comprueba que el guion por pasos es coherente: node charla-agente/check.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const dir = new URL(".", import.meta.url);
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL("js/steps.js", dir), "utf8"), sandbox);
const { STATIONS, STEPS, resolveStation, resolveCamera } = sandbox.window;
Object.assign(sandbox, sandbox.window);

const world = readFileSync(new URL("js/world.js", dir), "utf8");
for (const id of Object.keys(STATIONS)) {
  assert.ok(world.includes(`WORLD.${id} = function`), `falta la parada ${id} en world.js`);
  assert.equal(STATIONS[id].cam.length, 6, `cámara de ${id}`);
}
STEPS.forEach((s, i) => {
  const n = `paso ${i + 1}`;
  assert.ok(STATIONS[s.station], `${n}: parada desconocida ${s.station}`);
  assert.ok(s.notes && s.notes.trim(), `${n}: sin guion`);
  assert.equal(typeof s.set, "object", `${n}: sin set`);
  if (s.cam) assert.equal(s.cam.length, 6, `${n}: cámara mal formada`);
  assert.equal(resolveCamera(i).length, 6);
});
// El estado se acumula dentro de la parada y no se filtra entre paradas.
const night = STEPS.findIndex((s) => s.set.night === 1);
assert.equal(resolveStation("duplicado", night).plates, 2);
assert.equal(resolveStation("mesa", night).title, 1);
console.log(`ok: ${STEPS.length} pasos en ${Object.keys(STATIONS).length} paradas`);
