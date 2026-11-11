import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdtemp, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import fc from "fast-check";
import { blsImageNameFingerprint, validateBlsImageManifest, checkBlsImageBatches } from "./bls-image-batches.mjs";

const root = new URL("../../", import.meta.url).pathname;
const batchPath = "alimentos/bls/image-batches/0001";
const manifest = JSON.parse(await readFile(resolve(root, batchPath, "manifest.json")));
const source = JSON.parse(await readFile(resolve(root, "alimentos/bls/index.json")));
const approved = JSON.parse(await readFile(resolve(root, "alimentos/ciqual/image-samples/manifest.json")));
const references = new Map(approved.samples.map((image) => [`alimentos/ciqual/image-samples/${image.image}`, image.sha256]));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("BLS: cada imagen tiene alimento, prompt, fuente y referencia de estilo sin cambiar los nombres", async () => {
  const result = await checkBlsImageBatches(root);
  assert.equal(result.total, 7140);
  assert.ok(result.generated >= 100);
  assert.equal(result.generated + result.pending.length, 7140);
  assert.ok(result.batches.includes("0001"));
  validateBlsImageManifest(manifest, source, references);
  assert.equal(manifest.images.length, 100);
  for (const image of manifest.images) assert.ok(!result.pending.some((food) => food.id === image.id));
  const raw = JSON.parse(await readFile(resolve(root, `alimentos/bls/foods/${manifest.images[0].id}.json`)));
  assert.equal(Object.hasOwn(raw, "image"), false);
  assert.deepEqual(manifest.images[0].names, raw.names);
});

test("BLS: rechaza nombres/huellas obsoletos, IDs o rutas ajenos, revisión incompleta y falsa aprobación", () => {
  for (const mutate of [
    (m) => { m.dataset_id = "anses-ciqual-2025"; },
    (m) => { m.images[0].names.en += " changed"; },
    (m) => { m.images[0].names.es = "traducción inventada"; },
    (m) => { m.images[0].source_sha256 = "0".repeat(64); },
    (m) => { m.images[0].id = "bls-Z000000"; },
    (m) => { m.images[0].image = "../outside.webp"; },
    (m) => { m.images[0].reference_image = "alimentos/images/manzana.webp"; },
    (m) => { m.images[0].reference_sha256 = "0".repeat(64); },
    (m) => { m.images[0].prompt = "A generic food image"; },
    (m) => { m.images[1] = m.images[0]; },
    (m) => { m.review.reviewed_ids.pop(); },
    (m) => { m.status = "approved"; },
    (m) => { m.generator = "unrecorded generator"; },
  ]) {
    const altered = structuredClone(manifest);
    mutate(altered);
    assert.throws(() => validateBlsImageManifest(altered, source, references));
  }
});

test("BLS: huella DE/EN estable, sensible al nombre y sin depender del orden de claves", () => {
  fc.assert(fc.property(fc.string(), fc.string(), (de, en) => {
    assert.equal(blsImageNameFingerprint({ de, en }), blsImageNameFingerprint({ en, de }));
    assert.notEqual(blsImageNameFingerprint({ de, en }), blsImageNameFingerprint({ de: de + "x", en }));
  }), { numRuns: 100 });
});

async function fixture(t) {
  const temp = await mkdtemp(resolve(tmpdir(), "bls-images-test-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  await cp(resolve(root, "alimentos/ciqual/image-samples"), resolve(temp, "alimentos/ciqual/image-samples"), { recursive: true });
  await cp(resolve(root, batchPath), resolve(temp, batchPath), { recursive: true });
  await cp(resolve(root, "alimentos/bls/index.json"), resolve(temp, "alimentos/bls/index.json"));
  return temp;
}

test("BLS: detecta corrupción, WebP falso, tamaño y alfa sin confiar en la extensión", async (t) => {
  const temp = await fixture(t);
  const m = structuredClone(manifest);
  const file = resolve(temp, batchPath, m.images[0].image);
  const original = await readFile(file);
  await writeFile(file, "corrupted");
  await assert.rejects(() => checkBlsImageBatches(temp), /SHA-256/);
  for (const bytes of [
    await sharp(original).png().toBuffer(),
    await sharp(original).resize(256, 256).webp().toBuffer(),
    await sharp(original).ensureAlpha(.5).webp().toBuffer(),
  ]) {
    await writeFile(file, bytes);
    m.images[0].sha256 = hash(bytes);
    await writeFile(resolve(temp, batchPath, "manifest.json"), JSON.stringify(m));
    await assert.rejects(() => checkBlsImageBatches(temp));
  }
});

test("BLS: rechaza huérfanos, tandas incompletas, duplicados y enlaces simbólicos", async (t) => {
  const temp = await fixture(t);
  const directory = resolve(temp, batchPath);
  await writeFile(resolve(directory, "orphan.webp"), "x");
  await assert.rejects(() => checkBlsImageBatches(temp), /huérfanos/);
  await rm(resolve(directory, "orphan.webp"));
  await cp(directory, resolve(temp, "alimentos/bls/image-batches/0002"), { recursive: true });
  await writeFile(resolve(temp, "alimentos/bls/image-batches/0002/manifest.json"), JSON.stringify({ ...manifest, batch_id: "0002" }));
  await assert.rejects(() => checkBlsImageBatches(temp), /duplicada entre tandas/);
  await rm(resolve(temp, "alimentos/bls/image-batches/0002"), { recursive: true });
  const file = resolve(directory, manifest.images[0].image);
  await rm(file);
  await assert.rejects(() => checkBlsImageBatches(temp), /ausentes/);
  await symlink(resolve(root, batchPath, manifest.images[0].image), file);
  await assert.rejects(() => checkBlsImageBatches(temp), /enlazada/);
});

test("BLS: no se puede reutilizar una imagen para otro alimento aunque se actualice su hash", async (t) => {
  const temp = await fixture(t);
  const altered = structuredClone(manifest);
  await cp(resolve(temp, batchPath, altered.images[0].image), resolve(temp, batchPath, altered.images[1].image));
  altered.images[1].sha256 = altered.images[0].sha256;
  await writeFile(resolve(temp, batchPath, "manifest.json"), JSON.stringify(altered));
  await assert.rejects(() => checkBlsImageBatches(temp), /reutilizar/);
});

test("BLS: el CLI lista pendientes de forma reproducible y rechaza parámetros ambiguos", () => {
  const cli = resolve(root, "scripts/catalogs/bls-image-batches.mjs");
  const args = [cli, "--next", "2"];
  const first = execFileSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(execFileSync(process.execPath, args, { encoding: "utf8" }), first);
  const pending = JSON.parse(first);
  assert.equal(pending.length, 2);
  assert.ok(!manifest.images.some((image) => image.id === pending[0].id));
  for (const tail of [["--next", "0"], ["--next", "101"], ["--check", "--download"], ["--next", "2", "extra"]]) {
    assert.throws(() => execFileSync(process.execPath, [cli, ...tail], { stdio: "pipe" }));
  }
});
