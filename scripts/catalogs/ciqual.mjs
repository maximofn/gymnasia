import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv from "ajv";
import sax from "sax";

import { applyCiqualTranslations } from "./ciqual-translations.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const ciqualRoot = resolve(here, "../../alimentos/ciqual");
export const ciqualSource = JSON.parse(await readFile(join(here, "ciqual-source.json"), "utf8"));
const schema = JSON.parse(await readFile(join(here, "schemas/ciqual-food.schema.json"), "utf8"));
const validateFood = new Ajv({ allErrors: true, strict: true }).compile(schema);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function code(value, context) {
  requireValue(typeof value === "string" && /^\d+$/.test(value), `Código inválido: ${context}.`);
  return value;
}

function insertUnique(map, key, value, context) {
  requireValue(!map.has(key), `Código duplicado: ${context} ${key}.`);
  map.set(key, value);
}

// SAX estricto: sin expansión de entidades externas ni consultas de red.
// No convertimos códigos a números: los ceros de las categorías son significativos.
export function parseXmlTable(text, rowTag) {
  const rows = [];
  const parser = sax.parser(true, { trim: false, normalize: false });
  let depth = 0;
  let row = null;
  let field = null;
  let value = "";
  parser.ondoctype = () => { throw new Error("No se admite DOCTYPE en los archivos CIQUAL."); };
  parser.onopentag = (node) => {
    depth += 1;
    if (depth === 1) requireValue(node.name === "TABLE", "Se esperaba la raíz XML TABLE.");
    if (depth === 2) {
      requireValue(node.name === rowTag, `Fila XML inesperada: ${node.name}.`);
      row = {};
    } else if (depth === 3) {
      field = node.name;
      requireValue(!Object.hasOwn(row, field), `Campo XML duplicado: ${field}.`);
      value = "";
    } else {
      requireValue(depth < 4, "No se admiten campos XML anidados.");
    }
  };
  parser.ontext = parser.oncdata = (textValue) => {
    if (field) value += textValue;
  };
  parser.onclosetag = () => {
    if (depth === 3) {
      row[field] = value.trim();
      field = null;
    } else if (depth === 2) {
      rows.push(row);
      row = null;
    }
    depth -= 1;
  };
  parser.write(text.replace(/^\uFEFF/, "")).close();
  requireValue(rows.length > 0, `La tabla ${rowTag} está vacía.`);
  return rows;
}

export function parseCiqualValue(raw) {
  requireValue(typeof raw === "string", "Falta un valor de composición CIQUAL.");
  const text = raw.trim();
  if (text === "-" || text === "") return { value: null, qualifier: "missing", source_value: text };
  if (/^traces?$/i.test(text)) return { value: null, qualifier: "trace", source_value: text };
  const match = /^(<\s*)?(\d+(?:[,.]\d+)?(?:[eE][+-]?\d+)?)$/.exec(text);
  requireValue(match, `Valor CIQUAL no reconocido: ${JSON.stringify(text)}.`);
  const amount = Number(match[2].replace(",", "."));
  requireValue(Number.isFinite(amount), `Valor CIQUAL no finito: ${text}.`);
  return match[1]
    ? { value: null, qualifier: "less_than", limit: amount, source_value: text }
    : { value: amount, qualifier: "reported", source_value: text };
}

function optionalNumber(raw) {
  if (!raw) return null;
  const parsed = parseCiqualValue(raw);
  requireValue(parsed.qualifier === "reported", `Se esperaba un número: ${raw}.`);
  return parsed.value;
}

function names(fr, en) {
  requireValue(fr?.length > 0 && en?.length > 0, "Falta un nombre oficial francés o inglés.");
  return { fr, en };
}

export function convertCiqualTables(tables) {
  const nutrients = new Map();
  for (const row of tables.CONST) {
    const id = `ciqual-${code(row.const_code, "componente")}`;
    // La etiqueta francesa y la documentación establecen la base de 100 g.
    // La etiqueta inglesa de 51104 contiene la errata «µg/100mg»; se conserva.
    const unit = /\((kJ|kcal|g|mg|µg)\/100\s*g\)$/.exec(row.const_nom_fr)?.[1];
    requireValue(unit, `Unidad no reconocida para ${id}.`);
    insertUnique(nutrients, id, {
      id,
      source_code: row.const_code,
      names: names(row.const_nom_fr, row.const_nom_eng),
      unit: unit === "µg" ? "ug" : unit,
      infoods_code: row.code_INFOODS || null,
    }, "componente");
  }

  const groups = new Map();
  for (const row of tables.ALIM_GRP) {
    let parent = null;
    for (const prefix of ["alim_grp", "alim_ssgrp", "alim_ssssgrp"]) {
      const sourceCode = code(row[`${prefix}_code`], "grupo");
      if (/^0+$/.test(sourceCode)) continue;
      const id = `ciqual-${sourceCode}`;
      const group = {
        id,
        source_code: sourceCode,
        parent_id: parent,
        names: names(row[`${prefix}_nom_fr`], row[`${prefix}_nom_eng`]),
      };
      requireValue(!groups.has(id) || json(groups.get(id)) === json(group), `Grupo contradictorio: ${id}.`);
      groups.set(id, group);
      parent = id;
    }
  }

  const references = new Map();
  for (const row of tables.SOURCES) {
    const id = code(row.source_code, "referencia");
    insertUnique(references, id, { id, citation: row.ref_citation || null }, "referencia");
  }

  const foods = new Map();
  for (const row of tables.ALIM) {
    const sourceCode = code(row.alim_code, "alimento");
    const categoryIds = [row.alim_grp_code, row.alim_ssgrp_code, row.alim_ssssgrp_code]
      .filter((value) => !/^0+$/.test(value))
      .map((value) => `ciqual-${code(value, "categoría")}`);
    const food = {
      schema_version: 1,
      id: `ciqual-${sourceCode}`,
      kind: "generic",
      names: names(row.alim_nom_fr, row.alim_nom_eng),
      scientific_name: row.alim_nom_sci || null,
      category_ids: categoryIds,
      source: { dataset_id: ciqualSource.id, food_code: sourceCode },
      nitrogen_to_protein_factor: optionalNumber(row.facteur_Jones),
      nutrition_profiles: [{
        id: "ciqual-2025",
        basis: { amount: 100, unit: "g", portion: "edible" },
        nutrients: {},
      }],
    };
    for (const id of categoryIds) requireValue(groups.has(id), `Categoría desconocida: ${id}.`);
    insertUnique(foods, sourceCode, food, "alimento");
  }

  for (const row of tables.COMPO) {
    const food = foods.get(row.alim_code);
    const nutrientId = `ciqual-${row.const_code}`;
    requireValue(food, `Composición de alimento desconocido: ${row.alim_code}.`);
    requireValue(nutrients.has(nutrientId), `Componente desconocido: ${nutrientId}.`);
    const values = food.nutrition_profiles[0].nutrients;
    requireValue(!Object.hasOwn(values, nutrientId), `Composición duplicada: ${food.id}/${nutrientId}.`);
    const measurement = parseCiqualValue(row.teneur);
    if (row.min) {
      measurement.minimum = optionalNumber(row.min);
      measurement.source_minimum = row.min;
    }
    if (row.max) {
      measurement.maximum = optionalNumber(row.max);
      measurement.source_maximum = row.max;
    }
    if (row.code_confiance) measurement.confidence_code = row.code_confiance;
    if (row.source_code) {
      requireValue(references.has(row.source_code), `Referencia desconocida: ${row.source_code}.`);
      measurement.source_ref = row.source_code;
    }
    values[nutrientId] = measurement;
  }
  const sorted = (map) => [...map.values()].sort((a, b) => compare(a.id, b.id));
  const catalog = { foods: sorted(foods), nutrients: sorted(nutrients), groups: sorted(groups), references: sorted(references) };
  validateCiqualCatalog(catalog);
  return catalog;
}

export function validateCiqualCatalog(catalog) {
  const nutrientIds = new Set(catalog.nutrients.map((row) => row.id));
  const groupIds = new Set(catalog.groups.map((row) => row.id));
  const referenceIds = new Set(catalog.references.map((row) => row.id));
  const foodIds = new Set();
  for (const food of catalog.foods) {
    requireValue(validateFood(food), `Ficha inválida ${food.id}: ${JSON.stringify(validateFood.errors)}.`);
    requireValue(!foodIds.has(food.id), `Alimento duplicado: ${food.id}.`);
    foodIds.add(food.id);
    requireValue(food.id === `ciqual-${food.source.food_code}`, `ID incoherente: ${food.id}.`);
    for (const id of food.category_ids) requireValue(groupIds.has(id), `Categoría desconocida: ${id}.`);
    const values = food.nutrition_profiles[0].nutrients;
    requireValue(Object.keys(values).length === nutrientIds.size, `Componentes incompletos: ${food.id}.`);
    for (const [id, measurement] of Object.entries(values)) {
      requireValue(nutrientIds.has(id), `Componente desconocido: ${id}.`);
      const expected = parseCiqualValue(measurement.source_value);
      for (const field of ["value", "qualifier", "limit"]) {
        requireValue(measurement[field] === expected[field], `Valor alterado: ${food.id}/${id}/${field}.`);
      }
      for (const field of ["minimum", "maximum"]) {
        if (Object.hasOwn(measurement, field) || Object.hasOwn(measurement, `source_${field}`)) {
          requireValue(measurement[field] === optionalNumber(measurement[`source_${field}`]), `Extremo alterado: ${food.id}/${id}/${field}.`);
        }
      }
      if (measurement.source_ref) requireValue(referenceIds.has(measurement.source_ref), `Referencia desconocida: ${measurement.source_ref}.`);
    }
  }
}

export async function loadCiqualSource(sourceDirectory) {
  const tables = {};
  for (const file of ciqualSource.files) {
    const bytes = await readFile(join(sourceDirectory, file.name));
    requireValue(sha256(bytes) === file.sha256, `SHA-256 distinto del original: ${file.name}.`);
    tables[file.tag] = parseXmlTable(bytes.toString("utf8"), file.tag);
  }
  const catalog = convertCiqualTables(tables);
  requireValue(catalog.foods.length === ciqualSource.expected_foods, "Número de alimentos distinto de la publicación fijada.");
  requireValue(catalog.nutrients.length === ciqualSource.expected_nutrients, "Número de componentes distinto de la publicación fijada.");
  return catalog;
}

export async function downloadCiqualSource(sourceDirectory, fetchImpl = fetch) {
  await mkdir(sourceDirectory, { recursive: true });
  for (const file of ciqualSource.files) {
    const path = join(sourceDirectory, file.name);
    try {
      if (sha256(await readFile(path)) === file.sha256) continue;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const response = await fetchImpl(`${ciqualSource.record_url}/files/${file.name}?download=1`, {
      signal: AbortSignal.timeout(120_000),
    });
    requireValue(response.ok, `Descarga fallida: ${file.name} (HTTP ${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    requireValue(sha256(bytes) === file.sha256, `SHA-256 distinto del original: ${file.name}.`);
    await atomicWrite(path, bytes);
  }
}

export function createCiqualArtifacts(catalog) {
  if (catalog.translations) catalog = applyCiqualTranslations(catalog, catalog.translations);
  validateCiqualCatalog(catalog);
  const artifacts = new Map();
  for (const food of catalog.foods) artifacts.set(`foods/${food.id}.json`, json(food));
  // Un registro por línea facilita búsquedas y evita inflar el agregado con indentación.
  artifacts.set("all.json", `[\n${catalog.foods.map((food) => JSON.stringify(food)).join(",\n")}\n]\n`);
  artifacts.set("index.json", json(catalog.foods.map((food) => ({
    id: food.id, names: food.names, category_ids: food.category_ids, path: `foods/${food.id}.json`,
  }))));
  for (const key of ["nutrients", "groups", "references"]) artifacts.set(`${key}.json`, json(catalog[key]));
  if (catalog.translations) artifacts.set("translations.es.json", json(catalog.translations));

  const qualifiers = { reported: 0, less_than: 0, trace: 0, missing: 0 };
  for (const food of catalog.foods) {
    for (const value of Object.values(food.nutrition_profiles[0].nutrients)) qualifiers[value.qualifier] += 1;
  }
  const manifest = {
    schema_version: 1,
    source: ciqualSource,
    counts: {
      foods: catalog.foods.length, nutrients: catalog.nutrients.length,
      groups: catalog.groups.length, references: catalog.references.length,
      measurements: Object.values(qualifiers).reduce((sum, count) => sum + count, 0),
      qualifiers,
    },
    nutrient_roles: {
      energy_kcal_eu: "ciqual-328", energy_kj_eu: "ciqual-327",
      energy_kcal_jones: "ciqual-333", energy_kj_jones: "ciqual-332",
      protein_jones: "ciqual-25000", protein_crude: "ciqual-25003",
      carbs_available: "ciqual-31000", fat: "ciqual-40000", fiber: "ciqual-34100",
    },
    ...(catalog.translations ? { localization: {
      locale: catalog.translations.locale,
      file: "translations.es.json",
      provenance: catalog.translations.provenance,
      counts: Object.fromEntries(["foods", "groups", "nutrients"].map((domain) => [domain, catalog[domain].length])),
    } } : {}),
    files: Object.fromEntries([...artifacts].map(([path, text]) => [path, {
      sha256: sha256(text), bytes: Buffer.byteLength(text),
    }])),
  };
  artifacts.set("manifest.json", json(manifest));
  return artifacts;
}

async function atomicWrite(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, path);
}

async function unexpectedFoods(root, expected) {
  try {
    return (await readdir(join(root, "foods"))).filter((name) => !expected.has(`foods/${name}`));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function writeCiqualArtifacts(catalog, root = ciqualRoot) {
  const artifacts = createCiqualArtifacts(catalog);
  const unexpected = await unexpectedFoods(root, artifacts);
  requireValue(unexpected.length === 0, `Hay fichas ajenas a la importación; revísalas antes de continuar: ${unexpected.join(", ")}.`);
  // El manifiesto se publica al final; un fallo intermedio deja un check rojo.
  for (const [path, contents] of artifacts) await atomicWrite(join(root, path), contents);
  return artifacts.size;
}

export async function checkCiqualArtifacts(root = ciqualRoot, sourceCatalog = null) {
  const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
  const foods = [];
  for (const name of (await readdir(join(root, "foods"))).sort(compare)) {
    requireValue(/^ciqual-\d+\.json$/.test(name), `Fichero inesperado: foods/${name}.`);
    const food = await readJson(`foods/${name}`);
    requireValue(name === `${food.id}.json`, `Nombre de fichero e ID distintos: ${name}.`);
    foods.push(food);
  }
  const translations = await readJson("translations.es.json");
  const catalog = applyCiqualTranslations(sourceCatalog ?? {
    foods,
    nutrients: await readJson("nutrients.json"),
    groups: await readJson("groups.json"),
    references: await readJson("references.json"),
  }, translations);
  requireValue(foods.length === ciqualSource.expected_foods, "Número de fichas CIQUAL incorrecto.");
  requireValue(catalog.nutrients.length === ciqualSource.expected_nutrients, "Número de componentes CIQUAL incorrecto.");
  const artifacts = createCiqualArtifacts(catalog);
  const unexpected = await unexpectedFoods(root, artifacts);
  requireValue(unexpected.length === 0, `Fichas inesperadas: ${unexpected.join(", ")}.`);
  for (const [path, expected] of artifacts) {
    requireValue(await readFile(join(root, path), "utf8") === expected, `Artefacto CIQUAL desactualizado: ${path}.`);
  }
  return JSON.parse(artifacts.get("manifest.json")).counts;
}
