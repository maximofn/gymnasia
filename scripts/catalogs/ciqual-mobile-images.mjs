import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSampleManifest } from "./ciqual-image-samples.mjs";

export function projectCiqualImages(foods, manifests) {
  const images = {};
  for (const { directory, manifest, entryKey } of manifests) {
    validateSampleManifest(manifest, foods, entryKey);
    for (const entry of manifest[entryKey]) {
      assert.ok(!Object.hasOwn(images, entry.id), `Imagen CIQUAL duplicada: ${entry.id}`);
      images[entry.id] = `${directory}/${entry.image}`;
    }
  }
  assert.equal(Object.keys(images).length, foods.length, "Faltan imágenes CIQUAL para la integración móvil");
  return Object.fromEntries(Object.entries(images).sort(([a], [b]) => a.localeCompare(b, "en")));
}

export async function createCiqualMobileImageArtifact(root) {
  const catalogRoot = resolve(root, "alimentos/ciqual");
  const foods = JSON.parse(await readFile(resolve(catalogRoot, "all.json"), "utf8"));
  const samples = JSON.parse(await readFile(resolve(catalogRoot, "image-samples/manifest.json"), "utf8"));
  assert.equal(samples.status, "approved", "El estilo de las imágenes debe estar aprobado");
  const manifests = [{ directory: "image-samples", manifest: samples, entryKey: "samples" }];
  for (const batch of (await readdir(resolve(catalogRoot, "image-batches"))).sort()) {
    if (batch === "README.md") continue;
    assert.match(batch, /^\d{4}$/, "Carpeta de tanda no permitida");
    const directory = `image-batches/${batch}`;
    const manifest = JSON.parse(await readFile(resolve(catalogRoot, directory, "manifest.json"), "utf8"));
    assert.equal(manifest.batch_id, batch);
    manifests.push({ directory, manifest, entryKey: "images" });
  }
  const images = projectCiqualImages(foods, manifests);
  for (const { directory, manifest, entryKey } of manifests) {
    for (const entry of manifest[entryKey]) {
      const bytes = await readFile(resolve(catalogRoot, directory, entry.image));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, `Imagen alterada: ${entry.id}`);
    }
  }
  return `${JSON.stringify({
    attribution: "Imágenes ilustrativas generadas por IA por Gymnasia; no proporcionadas ni validadas por ANSES. La cantidad visible no representa una ración recomendada.",
    images,
  })}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(["--write", "--check"].includes(process.argv[2]) && process.argv.length === 3,
    "Uso: ciqual-mobile-images.mjs --write|--check");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const output = resolve(root, "apps/mobile/catalogs/generated/ciqualImages.generated.json");
  const expected = await createCiqualMobileImageArtifact(root);
  if (process.argv[2] === "--write") await writeFile(output, expected);
  else assert.equal(await readFile(output, "utf8"), expected, "Índice de imágenes CIQUAL desactualizado; ejecuta npm run sync:ciqual:images:mobile");
  console.log(`Imágenes CIQUAL enlazadas para móvil: ${Object.keys(JSON.parse(expected).images).length}.`);
}
