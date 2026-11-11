import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSampleImage } from "./ciqual-image-samples.mjs";

export const blsImageNameFingerprint = (names) => createHash("sha256").update(JSON.stringify({ de: names.de, en: names.en })).digest("hex");

export function validateBlsImageManifest(manifest, foods, styleReferences) {
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.dataset_id, "mri-bls-4.0-2025");
  assert.match(manifest.batch_id, /^\d{4}$/);
  assert.equal(manifest.status, "pending-review", "La revisión del agente no es aprobación del mantenedor");
  assert.match(manifest.generated_on, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(manifest.generator, "Codex integrated image generator");
  assert.ok(manifest.attribution?.includes("no proporcionadas ni validadas por Max Rubner-Institut"));
  assert.equal(manifest.review?.reviewed_by, "Codex");
  assert.match(manifest.review?.reviewed_on ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(manifest.review?.method, "all_final_webps_in_contact_sheets_and_full_size_when_needed");
  assert.ok(Array.isArray(manifest.images) && manifest.images.length > 0 && manifest.images.length <= 100);
  const source = new Map(foods.map((food) => [food.id, food]));
  const seen = new Set();
  for (const image of manifest.images) {
    assert.match(image.id, /^bls-[A-Z][A-Z0-9]{6}$/);
    assert.ok(!seen.has(image.id), `Imagen BLS duplicada: ${image.id}`);
    seen.add(image.id);
    const food = source.get(image.id);
    assert.ok(food, `Alimento BLS desconocido: ${image.id}`);
    assert.deepEqual(image.names, food.names, `Nombres BLS desactualizados: ${image.id}`);
    assert.equal(image.source_sha256, blsImageNameFingerprint(food.names), `Huella de origen BLS desactualizada: ${image.id}`);
    assert.equal(image.image, `${image.id}.webp`, "Ruta de imagen BLS no permitida");
    assert.match(image.sha256, /^[a-f0-9]{64}$/);
    assert.ok(styleReferences.has(image.reference_image), "Referencia de estilo sin aprobación");
    assert.equal(image.reference_sha256, styleReferences.get(image.reference_image), "Referencia de estilo BLS alterada");
    assert.ok(typeof image.prompt === "string" && image.prompt.includes("STYLE REFERENCE ONLY") && image.prompt.includes("Subject:") && image.prompt.includes(food.names.en) && image.prompt.includes(food.names.de), "Prompt BLS incompleto");
  }
  assert.deepEqual(manifest.review.reviewed_ids, manifest.images.map((image) => image.id), "Revisión visual BLS incompleta");
}

export async function checkBlsImageBatches(root) {
  const foods = JSON.parse(await readFile(resolve(root, "alimentos/bls/index.json")));
  const approved = JSON.parse(await readFile(resolve(root, "alimentos/ciqual/image-samples/manifest.json")));
  assert.equal(approved.status, "approved");
  assert.equal(approved.review?.approved_by, "maintainer");
  const styleReferences = new Map();
  for (const sample of approved.samples) {
    const path = `alimentos/ciqual/image-samples/${sample.image}`;
    assert.ok(/^ciqual-\d+\.webp$/.test(sample.image), "Ruta de referencia de estilo inválida");
    assert.ok(!(await lstat(resolve(root, path))).isSymbolicLink(), "Referencia de estilo enlazada");
    await validateSampleImage(await readFile(resolve(root, path)), sample.sha256);
    styleReferences.set(path, sample.sha256);
  }
  const directory = resolve(root, "alimentos/bls/image-batches");
  assert.ok(!(await lstat(directory)).isSymbolicLink(), "Directorio de imágenes BLS enlazado");
  const entries = [], batches = [], seen = new Set(), hashes = new Set();
  for (const name of (await readdir(directory)).sort()) {
    if (name === "README.md") continue;
    assert.match(name, /^\d{4}$/, "Carpeta de tanda BLS no permitida");
    const path = resolve(directory, name);
    assert.ok((await lstat(path)).isDirectory() && !(await lstat(path)).isSymbolicLink(), "Tanda BLS enlazada o inválida");
    assert.ok(!(await lstat(resolve(path, "manifest.json"))).isSymbolicLink(), "Manifiesto BLS enlazado");
    const manifest = JSON.parse(await readFile(resolve(path, "manifest.json")));
    assert.equal(manifest.batch_id, name);
    validateBlsImageManifest(manifest, foods, styleReferences);
    assert.deepEqual((await readdir(path)).sort(), ["manifest.json", ...manifest.images.map((image) => image.image)].sort(), "Imágenes BLS ausentes o archivos huérfanos");
    for (const image of manifest.images) {
      assert.ok(!seen.has(image.id), `Imagen BLS duplicada entre tandas: ${image.id}`);
      assert.ok(!hashes.has(image.sha256), "No reutilizar la misma imagen BLS para variantes distintas");
      assert.ok(!(await lstat(resolve(path, image.image))).isSymbolicLink(), "Imagen BLS enlazada");
      await validateSampleImage(await readFile(resolve(path, image.image)), image.sha256);
      seen.add(image.id); hashes.add(image.sha256);
      entries.push(image);
    }
    batches.push(name);
  }
  return { total: foods.length, generated: entries.length, pending: foods.filter((food) => !seen.has(food.id)), batches };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const count = args[0] === "--next" ? Number(args[1]) : null;
  assert.ok(args.length === 1 && args[0] === "--check" || args.length === 2 && args[0] === "--next" && Number.isInteger(count) && count >= 1 && count <= 100,
    "Uso: bls-image-batches.mjs --check | --next <1..100>. Solo lectura.");
  const result = await checkBlsImageBatches(fileURLToPath(new URL("../../", import.meta.url)));
  if (count) console.log(JSON.stringify(result.pending.slice(0, count).map(({ id, names }) => ({ id, names })), null, 2));
  else console.log(`Imágenes BLS verificadas: ${result.generated}/${result.total}; pendientes ${result.pending.length}; ${(100 * result.generated / result.total).toFixed(2)}%; tandas ${result.batches.join(", ")}.`);
}
