import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import fc from "fast-check";
import { checkCiqualImageBatches, pendingImageFoods } from "./ciqual-image-batches.mjs";

const root = new URL("../../", import.meta.url).pathname;

test("valida tandas completas, cuenta cada alimento una sola vez y conserva la fuente", async () => {
  const report = await checkCiqualImageBatches(root);
  assert.equal(report.total, 3484);
  assert.equal(report.generated + report.pending.length, report.total);
  assert.ok(report.generated >= 13);
  assert.ok(report.batches.includes("0001"));
  const first = JSON.parse(await readFile(resolve(root, "alimentos/ciqual/image-batches/0001/manifest.json"), "utf8"));
  assert.equal(first.images.length, 10);
  assert.equal(first.status, "pending-review");
  const mobile = JSON.parse(await readFile(resolve(root, "apps/mobile/catalogs/generated/ciqualBaseline.generated.json"), "utf8"));
  for (const image of first.images) {
    assert.ok(!report.pending.some((food) => food.id === image.id));
    assert.equal(mobile.foods.find((food) => food.id === image.id).image, undefined);
  }
});

test("propiedades: reanudar solo devuelve alimentos pendientes en el orden de origen", () => {
  fc.assert(fc.property(fc.uniqueArray(fc.integer({ min: 1, max: 3484 }), { maxLength: 40 }), (numbers) => {
    const foods = numbers.map((number) => ({ id: `ciqual-${number}` }));
    const generated = foods.filter((_, index) => index % 2 === 0);
    const pending = pendingImageFoods(foods, generated);
    assert.deepEqual(pending, foods.filter((_, index) => index % 2 !== 0));
    assert.equal(pending.length + generated.length, foods.length);
    if (generated.length) assert.throws(() => pendingImageFoods(foods, [...generated, generated[0]]), /duplicada/);
  }), { numRuns: 100 });
});

test("detecta manifiesto roto, referencia sin aprobación, duplicados entre tandas y archivos huérfanos", async (t) => {
  const fixture = await mkdtemp(resolve(tmpdir(), "ciqual-image-batches-"));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const target = resolve(fixture, "alimentos/ciqual");
  await cp(resolve(root, "alimentos/ciqual/image-samples"), resolve(target, "image-samples"), { recursive: true });
  // La segunda tanda de esta fixture es un duplicado deliberado: no copiar
  // tandas reales adicionales que colisionarían con ese escenario.
  await cp(resolve(root, "alimentos/ciqual/image-batches/0001"), resolve(target, "image-batches/0001"), { recursive: true });
  await cp(resolve(root, "alimentos/ciqual/all.json"), resolve(target, "all.json"));
  await cp(resolve(root, "alimentos/images"), resolve(fixture, "alimentos/images"), { recursive: true });
  const path = resolve(target, "image-batches/0001/manifest.json");
  const original = await readFile(path, "utf8");
  const wrong = JSON.parse(original);
  wrong.batch_id = "9999";
  await writeFile(path, JSON.stringify(wrong));
  await assert.rejects(checkCiqualImageBatches(fixture));
  wrong.batch_id = "0001";
  wrong.images[0].reference_image = "alimentos/images/arroz-blanco.webp";
  await writeFile(path, JSON.stringify(wrong));
  await assert.rejects(checkCiqualImageBatches(fixture), /Referencia sin aprobación/);
  await writeFile(path, original);
  await cp(resolve(target, "image-batches/0001"), resolve(target, "image-batches/0002"), { recursive: true });
  const duplicate = { ...JSON.parse(original), batch_id: "0002" };
  await writeFile(resolve(target, "image-batches/0002/manifest.json"), JSON.stringify(duplicate));
  await assert.rejects(checkCiqualImageBatches(fixture), /duplicada entre tandas/);
  await rm(resolve(target, "image-batches/0002"), { recursive: true });
  await writeFile(resolve(target, "image-batches/0001/orphan.webp"), "orphan");
  await assert.rejects(checkCiqualImageBatches(fixture), /Archivos sin registrar/);
});
