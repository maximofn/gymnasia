import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCiqualMobileImageArtifact, projectCiqualImages } from "./ciqual-mobile-images.mjs";

const root = new URL("../../", import.meta.url).pathname;
const foods = JSON.parse(await readFile(new URL("../../alimentos/ciqual/all.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../../alimentos/ciqual/image-samples/manifest.json", import.meta.url), "utf8"));
const sampleFoods = foods.filter((food) => manifest.samples.some((sample) => sample.id === food.id));
const sample = { directory: "image-samples", manifest, entryKey: "samples" };

test("el índice móvil cubre el catálogo completo con archivos y hashes verificados", async () => {
  const expected = await createCiqualMobileImageArtifact(root);
  assert.equal(await readFile(new URL("../../apps/mobile/catalogs/generated/ciqualImages.generated.json", import.meta.url), "utf8"), expected);
  const artifact = JSON.parse(expected);
  assert.equal(Object.keys(artifact.images).length, 3484);
  assert.equal(artifact.images["ciqual-9100"], "image-samples/ciqual-9100.webp");
  assert.equal(artifact.images["ciqual-1010"], "image-batches/0053/ciqual-1010.webp");
  assert.match(artifact.attribution, /no proporcionadas ni validadas por ANSES/);
});

test("rechaza duplicados, cobertura parcial y nombres de origen desactualizados", () => {
  assert.throws(() => projectCiqualImages(sampleFoods, [sample, sample]), /duplicada/);
  assert.throws(() => projectCiqualImages(foods, [sample]), /Faltan imágenes/);
  const stale = structuredClone(sample);
  stale.manifest.samples[0].names.es += " distinto";
  assert.throws(() => projectCiqualImages(sampleFoods, [stale]), /Nombres desactualizados/);
});
