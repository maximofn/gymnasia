// Comprueba que el guion por pasos es coherente: node charla-agente/check.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const dir = new URL(".", import.meta.url);
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL("js/qa.js", dir), "utf8"), sandbox);
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
// Toda ilustración que usa el mundo existe en js/assets.js (el carrito vacío es opcional).
const assets = readFileSync(new URL("js/assets.js", dir), "utf8");
for (const [, key] of world.matchAll(/img\(R, "([a-z-]+)"/g)) {
  assert.ok(assets.includes(`"${key}":"data:`), `falta la ilustración ${key}: ejecuta build-assets.mjs`);
}
// Preguntas: índice tras «Gracias» y una respuesta completa por pregunta.
const { QA, QA_INDEX } = sandbox.window;
assert.equal(STEPS[QA_INDEX - 1].set.thanks, 1, "el índice de preguntas va justo después de «Gracias»");
assert.equal(STEPS.length, QA_INDEX + 1 + QA.length);
QA.forEach((x, i) => {
  const n = `pregunta ${i + 1}`;
  assert.ok(x.q && x.short && x.notes && x.a.length >= 2, `${n}: incompleta`);
  if (x.img) assert.ok(assets.includes(`"${x.img}":"data:`), `${n}: falta la ilustración ${x.img}`);
});
console.log(`ok: ${QA.length} preguntas`);
console.log(`ok: ${STEPS.length} pasos en ${Object.keys(STATIONS).length} paradas`);
