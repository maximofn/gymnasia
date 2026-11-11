import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir, mkdir, rename, rm, lstat, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import Ajv from "ajv";
import { bedcaSource, bedcaQueries, bedcaFoodQuery, bedcaProtocolHash, buildBedcaQuery, parseBedcaXml, parseBedcaIndex, parseBedcaDetail, leafFields, numericCode, sha256, json, readSnapshotFile, assertLocalBedcaDirectory, bedcaRepositoryRoot, decodeBedcaXml } from "./bedca-source.mjs";

const schema = JSON.parse(await readFile(new URL("schemas/bedca-food.schema.json", import.meta.url), "utf8"));
const validateFood = new Ajv({ allErrors: true, strict: true }).compile(schema);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function parseBedcaValue(raw, type) {
  assert.equal(typeof raw, "string", "Valor BEDCA ausente");
  const source = { source_value: raw };
  const text = raw.trim();
  if (type === "TR") return { ...source, value: null, qualifier: "trace" };
  if (type === "UD") return { ...source, value: null, qualifier: "undecidable" };
  if (!text || text === "-") return { ...source, value: null, qualifier: type === "BL" ? "below_detection" : "missing" };
  if (/^(?:tr|trazas?|traces?)$/i.test(text)) return { ...source, value: null, qualifier: "trace" };
  const match = /^(<|>)?\s*(-?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?)$/.exec(text);
  assert.ok(match, `Notación BEDCA no reconocida: ${JSON.stringify(text)}`);
  const value = Number(match[2].replace(",", "."));
  assert.ok(Number.isFinite(value), "Valor BEDCA no finito");
  if ((type === "BL" && match[1] === ">") || (type === "LT" && match[1] === ">") || (type === "MT" && match[1] === "<")) return { ...source, value: null, qualifier: "inconsistent_type" };
  if (type === "BL") return { ...source, value: null, qualifier: "below_detection", limit: value };
  if (type === "LT" || match[1] === "<") return { ...source, value: null, qualifier: "less_than", limit: value };
  if (type === "MT" || match[1] === ">") return { ...source, value: null, qualifier: "greater_than", limit: value };
  if (type === "LZ" || type === "RZ") {
    if (value !== 0) return { ...source, value: null, qualifier: "inconsistent_type" };
    return { ...source, value: 0, qualifier: type === "LZ" ? "logical_zero" : "regulatory_zero" };
  }
  return { ...source, value, qualifier: type === "X" ? "unknown_type" : "reported" };
}

export function parseBedcaDictionary(text, key) {
  const root = parseBedcaXml(text);
  assert.equal(root.name, "foodresponse");
  const seen = new Set();
  return root.children.map((node) => {
    assert.equal(node.name, "food");
    const row = leafFields(node);
    assert.ok(row[key]?.trim(), `Diccionario BEDCA sin ${key}`);
    assert.ok(!seen.has(row[key]), `Código BEDCA duplicado en ${key}: ${row[key]}`);
    seen.add(row[key]);
    return row;
  });
}

export async function loadBedcaSnapshot(directory) {
  await assertLocalBedcaDirectory(directory);
  const actualFiles = await listFiles(directory);
  const manifest = JSON.parse(await readFile(resolve(directory, "snapshot.json"), "utf8"));
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.dataset_id, bedcaSource.id);
  assert.equal(manifest.protocol_sha256, bedcaProtocolHash(), "Protocolo de captura BEDCA desconocido");
  assert.equal(manifest.complete, true, "La descarga BEDCA está incompleta; reanuda --download");
  assert.equal(manifest.license.status, "pending");
  assert.equal(manifest.license.redistribution, "blocked");
  assert.ok(manifest.started_at && manifest.completed_at);
  const files = new Map();
  for (const entry of manifest.files) {
    assert.ok(!files.has(entry.path), "Entrada de snapshot BEDCA duplicada");
    files.set(entry.path, await readSnapshotFile(directory, entry));
  }
  const text = (path) => { assert.ok(files.has(path), `Falta archivo BEDCA: ${path}`); return decodeBedcaXml(files.get(path)); };
  const index = parseBedcaIndex(text("responses/index.xml"));
  assert.equal(manifest.foods, index.length, "Contador BEDCA desactualizado");
  const expected = new Set(["documents/UsoBD.pdf", "documents/query.js", "documents/foodresponse1.xsl"]);
  for (const [name, definition] of Object.entries(bedcaQueries)) {
    expected.add(`requests/${name}.xml`); expected.add(`responses/${name}.xml`);
    assert.equal(text(`requests/${name}.xml`), buildBedcaQuery(definition), `Consulta BEDCA modificada: ${name}`);
  }
  const details = new Map();
  for (const row of index) {
    expected.add(`requests/foods/${row.f_id}.xml`); expected.add(`responses/foods/${row.f_id}.xml`);
    assert.equal(text(`requests/foods/${row.f_id}.xml`), buildBedcaQuery(bedcaFoodQuery(row.f_id)), "Consulta de ficha BEDCA modificada");
    details.set(row.f_id, parseBedcaDetail(text(`responses/foods/${row.f_id}.xml`), row.f_id));
  }
  assert.deepEqual([...files.keys()].sort(compare), [...expected].sort(compare), "Archivos inesperados o ausentes en el snapshot BEDCA");
  assert.deepEqual(actualFiles, [...expected, "snapshot.json"].sort(compare), "El snapshot BEDCA contiene archivos sin registrar");
  const dictionaries = Object.fromEntries(Object.keys(bedcaQueries).filter((name) => name !== "index").map((name) => [name, text(`responses/${name}.xml`)]));
  const snapshotId = sha256(json(manifest.files.map(({ path, sha256: hash, bytes }) => ({ path, sha256: hash, bytes }))));
  return { manifest, snapshotId, index, details, dictionaries };
}

export function convertBedcaSnapshot(snapshot) {
  const dictionaries = {
    components: parseBedcaDictionary(snapshot.dictionaries.components, "c_id"),
    food_groups: parseBedcaDictionary(snapshot.dictionaries.food_groups, "fg_id"),
    component_groups: parseBedcaDictionary(snapshot.dictionaries.component_groups, "cg_id"),
    value_types: parseBedcaDictionary(snapshot.dictionaries.value_types, "vt_id"),
    expressions: parseBedcaDictionary(snapshot.dictionaries.expressions, "mu_id"),
    units: parseBedcaDictionary(snapshot.dictionaries.units, "u_id"),
  };
  const knownComponents = new Set(dictionaries.components.map((row) => row.c_id));
  const knownTypes = new Set(dictionaries.value_types.map((row) => row.vt_id));
  const knownExpressions = new Set(dictionaries.expressions.map((row) => row.mu_id));
  const knownUnits = new Set(dictionaries.units.map((row) => row.u_id));
  const observedUnits = new Map();
  const references = new Map();
  const diagnostics = [];
  const seen = new Set();
  const foods = snapshot.index.map((indexRow) => {
    assert.ok(numericCode(indexRow.f_id) && !seen.has(indexRow.f_id), "ID de alimento BEDCA inválido o duplicado");
    seen.add(indexRow.f_id);
    const detail = snapshot.details.get(indexRow.f_id);
    assert.ok(detail, `Falta el detalle BEDCA ${indexRow.f_id}`);
    const row = detail.fields;
    if (!detail.empty) {
      for (const key of ["f_id", "f_ori_name", "f_eng_name", "f_origen", "edible_portion"]) {
        assert.equal(row[key], indexRow[key], `Índice y ficha BEDCA discrepan: ${indexRow.f_id} ${key}`);
      }
    }
    const profiles = new Map();
    for (const [position, measurement] of detail.values.entries()) {
      assert.ok(numericCode(measurement.c_id), "Componente BEDCA inválido");
      assert.ok(knownComponents.has(measurement.c_id), `Componente BEDCA sin definición: ${measurement.c_id}`);
      assert.ok(knownTypes.has(measurement.value_type), `Tipo de valor BEDCA no documentado: ${measurement.value_type}`);
      const value = parseBedcaValue(measurement.best_location, measurement.value_type);
      const profileKey = JSON.stringify([measurement.moex, measurement.mu_id]);
      if (!profiles.has(profileKey)) profiles.set(profileKey, {
        id: `bedca-profile-${profiles.size + 1}`,
        expression_code: measurement.moex,
        basis: measurement.moex === "W" && measurement.mu_id === "W" ? { amount: 100, unit: "g", portion: "edible" } : null,
        measurements: [],
      });
      profiles.get(profileKey).measurements.push({ component_id: `bedca-${measurement.c_id}`, unit: measurement.v_unit, value_type: measurement.value_type, source_position: position, ...value, source_fields: measurement });
      if (!observedUnits.has(measurement.c_id)) observedUnits.set(measurement.c_id, new Set());
      observedUnits.get(measurement.c_id).add(measurement.v_unit);
      if (!knownExpressions.has(measurement.moex) || !knownExpressions.has(measurement.mu_id)) diagnostics.push({ code: "unlisted_expression", food_id: `bedca-${indexRow.f_id}`, position });
      if (!knownUnits.has(measurement.u_id)) diagnostics.push({ code: "unlisted_unit", food_id: `bedca-${indexRow.f_id}`, position });
      if (value.qualifier === "inconsistent_type") diagnostics.push({ code: "inconsistent_value_type", food_id: `bedca-${indexRow.f_id}`, position });
      if (value.value !== null && value.value < 0) diagnostics.push({ code: "negative_source_value", food_id: `bedca-${indexRow.f_id}`, position });
      if (measurement.ref_id) {
        if (!references.has(measurement.ref_id)) references.set(measurement.ref_id, new Map());
        const reference = Object.fromEntries(["ref_id", "citation", "at_descripcion", "at_description", "pt_descripcion", "pt_description"].map((key) => [key, measurement[key] ?? ""]));
        references.get(measurement.ref_id).set(JSON.stringify(reference), reference);
      }
    }
    const fractionText = indexRow.edible_portion;
    const fraction = parseBedcaValue(fractionText, "AR");
    assert.ok(fraction.qualifier === "reported" && fraction.value >= 0 && fraction.value <= 1, "Fracción comestible BEDCA inválida");
    const food = {
      schema_version: 1, id: `bedca-${indexRow.f_id}`, kind: "generic",
      names: { es: indexRow.f_ori_name, en: indexRow.f_eng_name || null },
      scientific_name: row.sci_name || null,
      source: { dataset_id: bedcaSource.id, food_code: indexRow.f_id, origin: indexRow.f_origen },
      availability: detail.empty ? "empty" : "available",
      edible_fraction: { value: fraction.value, source_value: fractionText },
      source_index: indexRow, source_fields: row,
      nutrition_profiles: [...profiles.values()],
    };
    assert.ok(validateFood(food), `Ficha BEDCA no válida: ${JSON.stringify(validateFood.errors)}`);
    return food;
  }).sort((a, b) => compare(a.id, b.id));
  const nutrients = dictionaries.components.map((row) => ({ id: `bedca-${row.c_id}`, source_fields: row, observed_units: [...(observedUnits.get(row.c_id) ?? [])].sort(compare) }));
  return { foods, nutrients, dictionaries, references: [...references].sort(([a], [b]) => compare(a, b)).map(([id, variants]) => ({ id, variants: [...variants.values()] })), diagnostics };
}

export function createBedcaArtifacts(snapshot) {
  const catalog = convertBedcaSnapshot(snapshot);
  const artifacts = new Map();
  for (const food of catalog.foods) artifacts.set(`foods/${food.id}.json`, json(food));
  artifacts.set("all.json", `${JSON.stringify(catalog.foods, null, 2)}\n`);
  artifacts.set("index.json", json(catalog.foods.map((food) => ({ id: food.id, names: food.names, availability: food.availability, source: food.source, path: `foods/${food.id}.json` }))));
  artifacts.set("nutrients.json", json(catalog.nutrients));
  artifacts.set("references.json", json(catalog.references));
  artifacts.set("diagnostics.json", json(catalog.diagnostics));
  for (const [name, rows] of Object.entries(catalog.dictionaries)) artifacts.set(`${name}.json`, json(rows));
  const counts = { foods: catalog.foods.length, available: catalog.foods.filter((food) => food.availability === "available").length, empty: catalog.foods.filter((food) => food.availability === "empty").length, components: catalog.nutrients.length, used_components: 0, measurements: 0, qualifiers: {}, diagnostics: catalog.diagnostics.length };
  const used = new Set();
  for (const food of catalog.foods) for (const profile of food.nutrition_profiles) for (const value of profile.measurements) {
    counts.measurements += 1; used.add(value.component_id); counts.qualifiers[value.qualifier] = (counts.qualifiers[value.qualifier] ?? 0) + 1;
  }
  counts.used_components = used.size;
  artifacts.set("manifest.json", json({ schema_version: 1, dataset_id: bedcaSource.id, snapshot_id: snapshot.snapshotId, attribution: bedcaSource.attribution, license: bedcaSource.license, capture_started_at: snapshot.manifest.started_at, capture_completed_at: snapshot.manifest.completed_at, counts, source_files: snapshot.manifest.files, artifacts: [...artifacts].map(([path, text]) => ({ path, bytes: Buffer.byteLength(text), sha256: sha256(text) })) }));
  return artifacts;
}

async function listFiles(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    assert.ok(!entry.isSymbolicLink(), `Symlink inesperado en BEDCA: ${path}`);
    if (entry.isDirectory()) result.push(...await listFiles(resolve(directory, entry.name), `${path}/`));
    else { assert.ok(entry.isFile(), "Archivo BEDCA no regular"); result.push(path); }
  }
  return result.sort(compare);
}
export async function checkBedcaArtifacts(directory, expected) {
  await assertLocalBedcaDirectory(directory);
  const actualFiles = await listFiles(directory);
  const manifestBytes = await readFile(resolve(directory, "manifest.json"));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.dataset_id, bedcaSource.id);
  assert.equal(manifest.license.status, "pending");
  assert.equal(manifest.license.redistribution, "blocked");
  const paths = manifest.artifacts.map((entry) => entry.path);
  assert.equal(new Set(paths).size, paths.length, "Artefacto BEDCA duplicado");
  for (const entry of manifest.artifacts) {
    assert.match(entry.path, /^(?:foods\/bedca-\d+|[a-z_]+)\.json$/, "Ruta de catálogo BEDCA no permitida");
    const bytes = await readFile(resolve(directory, entry.path));
    assert.equal(bytes.length, entry.bytes, `Tamaño alterado: ${entry.path}`);
    assert.equal(sha256(bytes), entry.sha256, `SHA-256 alterado: ${entry.path}`);
  }
  assert.deepEqual(actualFiles, [...paths, "manifest.json"].sort(compare), "Archivos BEDCA sin registrar o ausentes");
  if (expected) {
    assert.deepEqual([...expected.keys()].sort(compare), [...paths, "manifest.json"].sort(compare));
    for (const [path, text] of expected) assert.equal(await readFile(resolve(directory, path), "utf8"), text, `BEDCA no reproducible: ${path}`);
  }
  return manifest.counts;
}

export async function writeBedcaArtifacts(directory, artifacts) {
  await assertLocalBedcaDirectory(directory);
  let exists = false;
  try { assert.ok((await lstat(directory)).isDirectory(), "Destino BEDCA no es un directorio"); exists = true; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (exists) await checkBedcaArtifacts(directory); // Nunca borrar archivos ajenos.
  await mkdir(dirname(directory), { recursive: true });
  const temporary = `${directory}.stage-${randomUUID()}`;
  const backup = `${directory}.backup-${randomUUID()}`;
  await mkdir(temporary);
  let moved = false;
  let installed = false;
  try {
    for (const [path, contents] of artifacts) {
      assert.match(path, /^(?:foods\/bedca-\d+|[a-z_]+)\.json$/, "Ruta de salida BEDCA no permitida");
      await mkdir(dirname(resolve(temporary, path)), { recursive: true }); await writeFile(resolve(temporary, path), contents);
    }
    await checkBedcaArtifacts(temporary, artifacts);
    if (exists) { await rename(directory, backup); moved = true; }
    try { await rename(temporary, directory); installed = true; }
    catch (error) { if (moved) { await rename(backup, directory); moved = false; } throw error; }
    if (moved) await rm(backup, { recursive: true });
  } finally {
    if (!installed) await rm(temporary, { recursive: true, force: true });
  }
}

export function checkBedcaPublication() {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: bedcaRepositoryRoot, encoding: "utf8" }).split("\0").filter(Boolean);
  assertBedcaPublicationPaths(files);
  return true;
}
export function assertBedcaPublicationPaths(files) {
  const forbidden = files.filter((path) => path.startsWith("alimentos/bedca/") && !["alimentos/bedca/.gitignore", "alimentos/bedca/README.md"].includes(path));
  assert.deepEqual(forbidden, [], "No se pueden publicar datos BEDCA mientras la reutilización esté pendiente");
}
