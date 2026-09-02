import assert from "node:assert/strict";
import * as realFileSystem from "node:fs/promises";
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import test from "node:test";

import fc from "fast-check";
import sharp from "sharp";

import {
  inspectCatalogs,
  repositoryRoot,
  resolveSafeCatalogPath,
  writeCatalogArtifacts,
} from "./catalogs.mjs";

const nutritionEntry = {
  id: "pera",
  name: "Pera",
  category: "fruta",
  calories_per_100g: 57,
  protein_per_100g: 0.4,
  carbs_per_100g: 15,
  fat_per_100g: 0.1,
  fiber_per_100g: 3.1,
  serving_size_g: 150,
  serving_description: "una pera",
  image: "pera.webp",
};

const productEntry = {
  ...nutritionEntry,
  id: "barrita-qa",
  name: "Barrita QA",
  image: "Barrita-QA.webp",
};

const exerciseEntry = {
  id: "sentadilla-qa",
  name: "Sentadilla QA",
  image_male: "images/sentadilla-qa-male.webp",
  image_female: "images/sentadilla-qa-female.webp",
  muscle_group: "pierna",
  secondary_muscles: ["glúteos"],
  equipment: "peso corporal",
  difficulty: "beginner",
  instructions: "Flexiona las rodillas con control.",
};

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeWebp(path, width, height) {
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 22, g: 30, b: 36, alpha: 1 },
    },
  }).webp({ lossless: true }).toFile(path);
}

async function createFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "gymnasia-catalogs-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  for (const domain of ["alimentos", "productos_comerciales", "recetas", "ejercicios"]) {
    await mkdir(join(root, domain), { recursive: true });
  }
  for (const domain of ["alimentos", "productos_comerciales", "ejercicios"]) {
    await mkdir(join(root, domain, "images"), { recursive: true });
  }

  await writeJson(join(root, "alimentos", "pera.json"), nutritionEntry);
  await writeJson(join(root, "productos_comerciales", "barrita-qa.json"), productEntry);
  await writeJson(join(root, "ejercicios", "sentadilla-qa.json"), exerciseEntry);
  await writeWebp(join(root, "alimentos", "images", "pera.webp"), 16, 16);
  await writeWebp(join(root, "productos_comerciales", "images", "Barrita-QA.webp"), 20, 20);
  await writeWebp(join(root, "ejercicios", "images", "sentadilla-qa-male.webp"), 32, 18);
  await writeWebp(join(root, "ejercicios", "images", "sentadilla-qa-female.webp"), 32, 18);

  const initial = await inspectCatalogs({ root, checkGenerated: false });
  assert.deepEqual(initial.violations, []);
  await writeCatalogArtifacts(initial.artifacts);
  return root;
}

function codes(inspection) {
  return inspection.violations.map((violation) => violation.code);
}

test("genera todos los agregados e índices de forma estable", async (t) => {
  const root = await createFixture(t);
  const first = await inspectCatalogs({ root });
  assert.deepEqual(first.violations, []);
  assert.deepEqual(first.summary, {
    alimentos: { records: 1, images: 1 },
    productos_comerciales: { records: 1, images: 1 },
    recetas: { records: 0, images: 0 },
    ejercicios: { records: 1, images: 2 },
  });

  const before = await Promise.all(first.artifacts.map((artifact) => readFile(artifact.path, "utf8")));
  await writeCatalogArtifacts(first.artifacts);
  const after = await Promise.all(first.artifacts.map((artifact) => readFile(artifact.path, "utf8")));
  assert.deepEqual(after, before);
  assert.equal(first.artifacts.some((artifact) => artifact.path.endsWith("productos_comerciales/index.json")), false);
  assert.equal(first.artifacts.some((artifact) => artifact.path.endsWith("recetas/index.json")), false);
});

test("rechaza schemas incompatibles, números negativos e IDs discordantes", async (t) => {
  const root = await createFixture(t);
  await writeJson(join(root, "alimentos", "pera.json"), {
    ...nutritionEntry,
    id: "otro-id",
    calories_per_100g: -1,
    protein_per_100g: "muchas",
    campo_desconocido: true,
  });

  const inspection = await inspectCatalogs({ root, checkGenerated: false });
  assert.ok(codes(inspection).includes("SCHEMA_INVALID"));
  assert.ok(codes(inspection).includes("FILENAME_ID_MISMATCH"));
});

test("rechaza IDs duplicados dentro del dominio y entre catálogos nutricionales", async (t) => {
  const root = await createFixture(t);
  await writeJson(join(root, "alimentos", "segunda-pera.json"), { ...nutritionEntry, id: "pera" });
  await writeJson(join(root, "productos_comerciales", "pera.json"), nutritionEntry);

  const inspection = await inspectCatalogs({ root, checkGenerated: false });
  assert.ok(codes(inspection).includes("DUPLICATE_ID"));
  assert.ok(codes(inspection).includes("DUPLICATE_NUTRITION_ID"));
});

test("detecta mayúsculas incorrectas, MIME falso, corrupción, ratio y huérfanos", async (t) => {
  const root = await createFixture(t);
  await writeJson(join(root, "alimentos", "pera.json"), { ...nutritionEntry, image: "Pera.webp" });
  const caseInspection = await inspectCatalogs({ root, checkGenerated: false });
  assert.ok(codes(caseInspection).includes("IMAGE_PATH_CASE"));

  await writeJson(join(root, "alimentos", "pera.json"), nutritionEntry);
  const temporaryPng = join(root, "alimentos", "images", "pera.png.tmp");
  await sharp({
    create: { width: 16, height: 16, channels: 4, background: "#123456" },
  }).png().toFile(temporaryPng);
  await rename(temporaryPng, join(root, "alimentos", "images", "pera.webp"));
  const mimeInspection = await inspectCatalogs({ root, checkGenerated: false });
  assert.ok(codes(mimeInspection).includes("IMAGE_MIME_MISMATCH"));

  await writeWebp(join(root, "alimentos", "images", "pera.webp"), 20, 10);
  const ratioInspection = await inspectCatalogs({ root, checkGenerated: false });
  assert.ok(codes(ratioInspection).includes("IMAGE_ASPECT_RATIO"));

  await writeFile(join(root, "alimentos", "images", "pera.webp"), "bytes rotos");
  const corruptInspection = await inspectCatalogs({ root, checkGenerated: false });
  assert.ok(codes(corruptInspection).includes("IMAGE_DECODE_FAILED"));

  await writeWebp(join(root, "alimentos", "images", "pera.webp"), 16, 16);
  await writeWebp(join(root, "alimentos", "images", "huerfana.webp"), 16, 16);
  const orphanInspection = await inspectCatalogs({ root, checkGenerated: false });
  assert.ok(codes(orphanInspection).includes("IMAGE_ORPHAN"));
});

test("exige que las imágenes de ejercicio deriven exactamente del ID", async (t) => {
  const root = await createFixture(t);
  await writeJson(join(root, "ejercicios", "sentadilla-qa.json"), {
    ...exerciseEntry,
    image_male: "images/otro-ejercicio-male.webp",
  });
  const inspection = await inspectCatalogs({ root, checkGenerated: false });
  assert.ok(codes(inspection).includes("IMAGE_NAME_MISMATCH"));
  assert.ok(codes(inspection).includes("IMAGE_MISSING"));
});

test("revierte todos los agregados si falla una sustitución", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "gymnasia-catalog-write-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = join(root, "first.json");
  const second = join(root, "second.json");
  await writeFile(first, "anterior-1");
  await writeFile(second, "anterior-2");

  let renameCount = 0;
  const failingFileSystem = new Proxy(realFileSystem, {
    get(target, property) {
      if (property === "rename") {
        return async (...arguments_) => {
          renameCount += 1;
          if (renameCount === 2) throw new Error("rename simulado");
          return target.rename(...arguments_);
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  await assert.rejects(() => writeCatalogArtifacts([
    { domain: "alimentos", path: first, contents: "nuevo-1" },
    { domain: "alimentos", path: second, contents: "nuevo-2" },
  ], { domains: ["alimentos"], fileSystem: failingFileSystem }), /rename simulado/);
  assert.equal(await readFile(first, "utf8"), "anterior-1");
  assert.equal(await readFile(second, "utf8"), "anterior-2");
});

test("las rutas arbitrarias nunca escapan del catálogo", () => {
  const root = resolve(tmpdir(), "gymnasia-safe-catalog-root");
  fc.assert(fc.property(fc.string(), (candidate) => {
    const resolved = resolveSafeCatalogPath(root, candidate);
    if (resolved !== null) {
      assert.ok(resolved.startsWith(`${root}${sep}`));
      assert.equal(candidate.includes("\\"), false);
      assert.equal(candidate.split("/").some((segment) => ["", ".", ".."].includes(segment)), false);
    }
  }), { numRuns: 1_000 });
  for (const unsafe of ["../secret", "images/../../secret", "/absolute", "images\\secret.webp", ""]){
    assert.equal(resolveSafeCatalogPath(root, unsafe), null);
  }
});

test("el inventario versionado cumple el contrato completo", async () => {
  const inspection = await inspectCatalogs({ root: repositoryRoot });
  assert.deepEqual(inspection.violations, []);
});
