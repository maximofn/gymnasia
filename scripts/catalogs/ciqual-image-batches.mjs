import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCiqualImageSamples, validateSampleImage, validateSampleManifest } from "./ciqual-image-samples.mjs";

export function pendingImageFoods(foods, entries) {
  const generated = new Set();
  for (const entry of entries) {
    assert.ok(!generated.has(entry.id), `Imagen duplicada entre tandas: ${entry.id}`);
    generated.add(entry.id);
  }
  return foods.filter((food) => !generated.has(food.id));
}

export async function checkCiqualImageBatches(root) {
  const samples = await checkCiqualImageSamples(root);
  assert.equal(samples.status, "approved", "El estilo debe estar aprobado antes de generar tandas");
  const foods = JSON.parse(await readFile(resolve(root, "alimentos/ciqual/all.json"), "utf8"));
  const directory = resolve(root, "alimentos/ciqual/image-batches");
  const entries = [...samples.samples];
  const batches = [];
  const styleReferences = new Set(samples.samples.map((sample) => `alimentos/ciqual/image-samples/${sample.image}`));
  for (const name of (await readdir(directory)).sort()) {
    if (name === "README.md") continue;
    assert.match(name, /^\d{4}$/, "Carpeta de tanda no permitida");
    const path = resolve(directory, name);
    const manifest = JSON.parse(await readFile(resolve(path, "manifest.json"), "utf8"));
    assert.equal(manifest.batch_id, name);
    validateSampleManifest(manifest, foods, "images");
    assert.deepEqual((await readdir(path)).sort(), ["manifest.json", ...manifest.images.map((image) => image.image)].sort(),
      `Archivos sin registrar o ausentes en tanda ${name}`);
    for (const image of manifest.images) {
      assert.ok(styleReferences.has(image.reference_image), `Referencia sin aprobación: ${image.reference_image}`);
      await validateSampleImage(await readFile(resolve(path, image.image)), image.sha256);
    }
    entries.push(...manifest.images);
    batches.push(manifest.batch_id);
  }
  const pending = pendingImageFoods(foods, entries);
  return { total: foods.length, generated: entries.length, pending, batches };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const nextMode = args[0] === "--next";
  const count = nextMode ? Number(args[1]) : 0;
  assert.ok((args.length === 1 && args[0] === "--check") ||
    (args.length === 2 && nextMode && Number.isInteger(count) && count >= 1 && count <= 50),
  "Uso: node scripts/catalogs/ciqual-image-batches.mjs --check | --next <1..50>. Solo lectura, no genera ni publica.");
  const result = await checkCiqualImageBatches(fileURLToPath(new URL("../../", import.meta.url)));
  if (nextMode) console.log(JSON.stringify(result.pending.slice(0, count).map(({ id, names }) => ({ id, names })), null, 2));
  else console.log(`Imágenes CIQUAL verificadas: ${result.generated}/${result.total}; pendientes ${result.pending.length}; tandas ${result.batches.join(", ")}. Sin integración móvil.`);
}
