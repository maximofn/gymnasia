import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ciqualNameFingerprint } from "./ciqual-translations.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Las muestras son material editorial separado: nunca modifican datos ANSES
// ni se incorporan automáticamente a la proyección móvil.
export function validateSampleManifest(manifest, foods, entryKey = "samples") {
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.dataset_id, "anses-ciqual-2025");
  assert.ok(["pending-review", "approved"].includes(manifest.status));
  if (manifest.status === "approved") {
    assert.equal(manifest.review?.approved_by, "maintainer");
    assert.match(manifest.review?.approved_on ?? "", /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.ok(manifest.attribution?.includes("no proporcionadas ni validadas por ANSES"));
  assert.ok(manifest.generator?.trim());
  assert.ok(Array.isArray(manifest[entryKey]) && manifest[entryKey].length > 0);
  const source = new Map(foods.map((food) => [food.id, food]));
  const seen = new Set();
  for (const sample of manifest[entryKey]) {
    assert.match(sample.id, /^ciqual-\d+$/);
    assert.ok(!seen.has(sample.id), `Muestra duplicada: ${sample.id}`);
    seen.add(sample.id);
    const food = source.get(sample.id);
    assert.ok(food, `Alimento desconocido: ${sample.id}`);
    assert.deepEqual(sample.names, food.names, `Nombres desactualizados: ${sample.id}`);
    assert.equal(sample.source_sha256, ciqualNameFingerprint(food.names), `Origen desactualizado: ${sample.id}`);
    assert.equal(sample.image, `${sample.id}.webp`, `Ruta no permitida: ${sample.id}`);
    assert.match(sample.sha256, /^[a-f0-9]{64}$/);
    assert.match(sample.reference_image, /^alimentos\/(?:images\/[a-z0-9_-]+|ciqual\/image-samples\/ciqual-\d+)\.webp$/);
    assert.ok(typeof sample.prompt === "string" && sample.prompt.includes("Subject:") && sample.prompt.includes("STYLE REFERENCE ONLY"));
  }
}

export async function validateSampleImage(bytes, expectedHash) {
  assert.equal(digest(bytes), expectedHash, "La imagen no coincide con su SHA-256");
  const metadata = await sharp(bytes, { failOn: "error" }).metadata();
  assert.equal(metadata.format, "webp", "Se requiere WebP real");
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
  assert.ok(!metadata.hasAlpha, "El fondo debe ser opaco");
  assert.ok(!metadata.pages || metadata.pages === 1, "No se admiten animaciones");
  await sharp(bytes, { failOn: "error" }).raw().toBuffer();
}

export async function checkCiqualImageSamples(root) {
  const directory = resolve(root, "alimentos/ciqual/image-samples");
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8"));
  const foods = JSON.parse(await readFile(resolve(root, "alimentos/ciqual/all.json"), "utf8"));
  validateSampleManifest(manifest, foods);
  assert.deepEqual((await readdir(directory)).filter((name) => name !== "README.md").sort(),
    ["manifest.json", ...manifest.samples.map((sample) => sample.image)].sort(), "Archivos sin registrar o ausentes");
  for (const sample of manifest.samples) {
    await validateSampleImage(await readFile(resolve(directory, sample.image)), sample.sha256);
    const reference = await readFile(resolve(root, sample.reference_image));
    assert.equal((await sharp(reference).metadata()).format, "webp");
  }
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--check"),
    "Uso: node scripts/catalogs/ciqual-image-samples.mjs [--check]. No genera ni publica imágenes.");
  const manifest = await checkCiqualImageSamples(fileURLToPath(new URL("../../", import.meta.url)));
  console.log(`${manifest.samples.length} muestras CIQUAL verificadas (${manifest.status}). Sin cambios en la app.`);
}
