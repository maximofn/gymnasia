import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
import { checkCiqualImageSamples, validateSampleImage, validateSampleManifest } from "./ciqual-image-samples.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const foods = JSON.parse(await readFile(new URL("../../alimentos/ciqual/all.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../../alimentos/ciqual/image-samples/manifest.json", import.meta.url), "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("tres muestras reales, trazables y pendientes sin alterar la fuente nutricional", async () => {
  const original = JSON.stringify(foods);
  const result = await checkCiqualImageSamples(root);
  assert.deepEqual(result.samples.map((sample) => sample.id), ["ciqual-9100", "ciqual-13620", "ciqual-20587"]);
  assert.equal(JSON.stringify(foods), original);
  const mobile = JSON.parse(await readFile(new URL("../../apps/mobile/catalogs/generated/ciqualBaseline.generated.json", import.meta.url), "utf8"));
  for (const sample of result.samples) assert.equal(mobile.foods.find((food) => food.id === sample.id).image, undefined);
});

test("rechaza IDs, rutas, atribución, nombres y huellas incorrectos", () => {
  const mutations = [
    (m) => { m.samples[0].id = "ciqual-99999999"; },
    (m) => { m.samples.push(m.samples[0]); },
    (m) => { m.samples[0].image = "../arroz.webp"; },
    (m) => { m.samples[0].reference_image = "https://example.com/image.webp"; },
    (m) => { m.samples[0].names.en += " cooked"; },
    (m) => { m.samples[0].source_sha256 = "0".repeat(64); },
    (m) => { m.attribution = "ANSES"; },
    (m) => { m.status = "approved"; },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(manifest);
    mutate(copy);
    assert.throws(() => validateSampleManifest(copy, foods));
  }
});

test("rechaza cambios de bytes, PNG renombrado, tamaño incorrecto e imagen dañada", async () => {
  const image = await readFile(new URL("../../alimentos/ciqual/image-samples/ciqual-9100.webp", import.meta.url));
  await assert.rejects(validateSampleImage(image, "0".repeat(64)), /SHA-256/);
  const png = await sharp(image).png().toBuffer();
  await assert.rejects(validateSampleImage(png, digest(png)), /WebP real/);
  const tiny = await sharp(image).resize(48, 48).webp().toBuffer();
  await assert.rejects(validateSampleImage(tiny, digest(tiny)));
  const corrupt = Buffer.from("not an image");
  await assert.rejects(validateSampleImage(corrupt, digest(corrupt)));
});
