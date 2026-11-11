import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir, mkdir, rename, writeFile, rm, lstat } from "node:fs/promises";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { readBlsWorkbook, unzipBls } from "./bls-xlsx.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const blsRoot = resolve(here, "../../alimentos/bls");
export const blsSource = JSON.parse(await readFile(join(here, "bls-source.json"), "utf8"));
const schema = JSON.parse(await readFile(join(here, "schemas/bls-food.schema.json"), "utf8"));
const validateFood = new Ajv({ allErrors: true, strict: true }).compile(schema);
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const valueAt = (row, column) => row.get(column)?.value ?? null;
const origins = new Set(["Analyse", "Rezeptberechnung", "Musterberechnung", "Literatur", "Aggregation", "Labelangabe", "Nährstoffdatenbank", "Übernommener Wert", "Reskalierung", "Logische Null", "Logische Annahme", "Spuren", "Formelberechnung", "-"]);

export function parseBlsValue(raw, origin) {
  assert.ok(raw === null || typeof raw === "string", "Valor BLS no textual");
  assert.ok(origin === null || origins.has(origin), `Origen BLS no documentado: ${origin}`);
  const text = raw?.trim() ?? "";
  if (text === "" || text === "-") return { value: null, qualifier: "missing" };
  if (text === "TR") return { value: null, qualifier: "trace" };
  if (text === "<LOD") return { value: null, qualifier: "below_detection" };
  if (text === "<LOQ") return { value: null, qualifier: "below_quantification" };
  if (text === "<LOD or <LOQ") return { value: null, qualifier: "below_detection_or_quantification" };
  const match = /^(<\s*)?(-?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?)$/.exec(text);
  assert.ok(match, `Notación BLS desconocida: ${JSON.stringify(text)}`);
  const value = Number(match[2].replace(",", "."));
  assert.ok(Number.isFinite(value), "Valor BLS no finito");
  if (origin === "Logische Null") return value === 0 && !match[1]
    ? { value: 0, qualifier: "logical_zero" } : { value: null, qualifier: "inconsistent_origin" };
  if (match[1]) return { value: null, qualifier: "less_than", limit: value };
  if (origin === "Spuren") return { value: null, qualifier: "trace" };
  return { value, qualifier: "reported" };
}

const componentHeaders = ["Index", "Nährstoffcode / Component code", "Nährstoffbezeichnung", "Component name", "Einheit / Unit", "Nährstoffgruppe", "Component group", "Formeln / Formula", "Formelanwendung / Formula application"];

export function readBlsComponents(bytes) {
  const components = [];
  const codes = new Set();
  readBlsWorkbook(bytes, "BLS_4_0", (row, number) => {
    if (number === 1) {
      assert.equal(row.size, componentHeaders.length, "Columnas de componentes BLS modificadas");
      assert.deepEqual(componentHeaders.map((_, column) => valueAt(row, column)), componentHeaders, "Cabeceras de componentes BLS modificadas");
      return;
    }
    if ([...row.values()].every((cell) => cell.value === null || cell.value.trim() === "")) return;
    const index = valueAt(row, 0);
    const code = valueAt(row, 1);
    assert.ok(/^\d+$/.test(index) && Number(index) === components.length + 1, "Índice de componente BLS discontinuo");
    assert.ok(/^[A-Z][A-Z0-9:]*$/.test(code) && !codes.has(code), "Componente BLS inválido o duplicado");
    assert.ok(![...row.keys()].some((column) => column > 8), "Campos de componente BLS desconocidos");
    codes.add(code);
    const fields = Object.fromEntries(componentHeaders.map((header, column) => [header, valueAt(row, column)]));
    const unit = fields[componentHeaders[4]];
    assert.ok(["g", "mg", "µg", "kcal", "kJ"].includes(unit), `Unidad BLS desconocida: ${unit}`);
    assert.ok(valueAt(row, 2) && valueAt(row, 3), "Componente BLS sin nombre");
    components.push({ id: `bls-${code}`, source_code: code, source_index: Number(index), names: { de: valueAt(row, 2), en: valueAt(row, 3) }, unit: unit === "µg" ? "ug" : unit, source_fields: fields });
  });
  assert.ok(components.length > 0, "Diccionario BLS vacío");
  return components;
}

export function createBlsConverter(components, knownIssues = { issues: [] }) {
  const foods = [];
  const references = new Map();
  const codes = new Set();
  let headers;
  const warnings = new Map();
  const issueIds = new Set();
  const componentCodes = new Set(components.map((component) => component.source_code));
  assert.ok(knownIssues.corrections_applied === undefined || knownIssues.corrections_applied === false, "El índice BLS no debe aplicar correcciones");
  for (const issue of knownIssues.issues) {
    assert.ok(!issueIds.has(issue.id), "Errata BLS duplicada");
    issueIds.add(issue.id);
    for (const component of issue.component_codes) assert.ok(componentCodes.has(component), "Componente de errata BLS desconocido");
    assert.equal(new Set(issue.food_codes).size, issue.food_codes.length, "Código de errata BLS duplicado");
    for (const code of issue.food_codes) {
      if (!warnings.has(code)) warnings.set(code, []);
      warnings.get(code).push(issue.id);
    }
  }
  const acceptRow = (row, number) => {
    if (number === 1) {
      headers = ["BLS Code", "Lebensmittelbezeichnung", "Food name"];
      for (const component of components) {
        const fields = component.source_fields;
        headers.push(`${component.source_code} ${component.names.de.trimEnd()} [${fields[componentHeaders[4]]}/100g]`, `${component.source_code} Datenherkunft`, `${component.source_code} Referenz`);
      }
      headers.push("Hinweis");
      assert.equal(row.size, headers.length, "Columnas de alimentos BLS modificadas");
      assert.deepEqual(headers.map((_, column) => valueAt(row, column)), headers, "Cabeceras de alimentos BLS modificadas");
      for (const [index, component] of components.entries()) component.source_columns = headers.slice(3 + index * 3, 6 + index * 3);
      return;
    }
    assert.ok(headers, "Falta la cabecera BLS");
    const code = valueAt(row, 0);
    assert.ok(/^[A-Z][A-Z0-9]{6}$/.test(code) && !codes.has(code), `Código de alimento BLS inválido o duplicado: ${code}`);
    assert.ok(valueAt(row, 1) && valueAt(row, 2), "Alimento BLS sin nombres oficiales");
    assert.ok(![...row.keys()].some((column) => column >= headers.length), "Columna BLS desconocida");
    codes.add(code);
    const nutrients = {};
    for (const [index, component] of components.entries()) {
      const column = 3 + index * 3;
      const cell = row.get(column);
      const raw = valueAt(row, column);
      const origin = valueAt(row, column + 1);
      const reference = valueAt(row, column + 2);
      const sourceRef = reference === null ? null : `bls-ref-${sha256(reference)}`;
      if (sourceRef) references.set(sourceRef, { id: sourceRef, source_text: reference, citation: reference === "-" || reference === "" ? null : reference });
      nutrients[component.id] = { ...parseBlsValue(raw, origin), source_value: raw, source_type: cell?.type ?? null, source_origin: origin, source_ref: sourceRef };
    }
    const food = {
      schema_version: 1, id: `bls-${code}`, kind: "generic", names: { de: valueAt(row, 1), en: valueAt(row, 2) },
      source: { dataset_id: blsSource.id, food_code: code, worksheet_row: number },
      source_note: valueAt(row, headers.length - 1), source_warning_ids: warnings.get(code) ?? [],
      nutrition_profiles: [{ id: "bls-4.0", basis: { amount: 100, unit: "g", portion: "edible" }, nutrients }],
    };
    assert.ok(validateFood(food), `Ficha BLS inválida: ${JSON.stringify(validateFood.errors)}`);
    foods.push(food);
  };
  return { acceptRow, finish: () => {
    assert.ok(foods.length > 0, "Catálogo BLS vacío");
    for (const code of warnings.keys()) assert.ok(codes.has(code), `Errata BLS de alimento inexistente: ${code}`);
    return { foods: foods.sort((a, b) => compare(a.id, b.id)), nutrients: components, references: [...references.values()].sort((a, b) => compare(a.id, b.id)), knownIssues };
  } };
}

export async function loadBlsSource(sourceDirectory = join(blsRoot, "source")) {
  const bytes = {};
  for (const file of blsSource.files) {
    assert.ok(!(await lstat(join(sourceDirectory, file.name))).isSymbolicLink(), "Symlink de fuente BLS no permitido");
    bytes[file.role] = await readFile(join(sourceDirectory, file.name));
    assert.equal(sha256(bytes[file.role]), file.sha256, `SHA-256 BLS distinto del original: ${file.name}`);
  }
  const knownIssuesBytes = await readFile(join(here, "bls-known-issues.json"));
  assert.equal(sha256(knownIssuesBytes), blsSource.errata.index_sha256, "Índice de erratas BLS alterado");
  const knownIssues = JSON.parse(knownIssuesBytes);
  const components = readBlsComponents(bytes.components);
  assert.equal(components.length, blsSource.expected_nutrients);
  const converter = createBlsConverter(components, knownIssues);
  readBlsWorkbook(bytes.foods, blsSource.worksheet, converter.acceptRow);
  const catalog = converter.finish();
  assert.equal(catalog.foods.length, blsSource.expected_foods);
  return catalog;
}

async function atomicWrite(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temp, bytes); await rename(temp, path); }
  finally { await rm(temp, { force: true }); }
}

async function fetchBytes(url, fetchImpl, maximum) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(120000) });
  assert.ok(response.ok, `Descarga BLS fallida: HTTP ${response.status}`);
  assert.ok(new URL(response.url || url).hostname === "www.blsdb.de", "Redirección de descarga BLS a otro host");
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    assert.ok(length <= maximum, "Respuesta BLS demasiado grande");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function downloadBlsSource(sourceDirectory, fetchImpl = fetch, definition = blsSource) {
  let complete = true;
  for (const file of definition.files) {
    try { assert.equal(sha256(await readFile(join(sourceDirectory, file.name))), file.sha256, `Fuente BLS existente alterada: ${file.name}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; complete = false; }
  }
  if (complete) return;
  const page = (await fetchBytes(definition.download_page, fetchImpl, 1024 * 1024)).toString("utf8");
  // MRI encodes even '/', '_' and '.' as numeric HTML entities in hrefs.
  const decodeAttribute = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (_, entity) => {
    if (entity.startsWith("#")) return String.fromCodePoint(entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
    return { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" }[entity.toLowerCase()];
  });
  const links = [...page.matchAll(/href=["']([^"']+)["']/g)].map((match) => decodeAttribute(match[1]));
  const urls = links.map((link) => new URL(link, definition.download_page)).filter((url) => url.pathname === definition.archive.path && url.hostname === "www.blsdb.de" && url.protocol === "https:");
  assert.equal(urls.length, 1, "La página oficial BLS no contiene un enlace ZIP único");
  const bytes = await fetchBytes(urls[0].href, fetchImpl, 32 * 1024 * 1024);
  assert.equal(sha256(bytes), definition.archive.sha256, "SHA-256 del ZIP BLS distinto de la publicación fijada");
  const archive = unzipBls(bytes, 32 * 1024 * 1024);
  for (const entry of definition.archive.entries) {
    assert.ok(archive[entry.path], `Falta entrada BLS: ${entry.path}`);
    assert.equal(sha256(archive[entry.path]), entry.sha256, `Entrada BLS alterada: ${entry.path}`);
  }
  assert.deepEqual(Object.keys(archive).filter((path) => !path.endsWith("/")).sort(), definition.archive.entries.map((entry) => entry.path).sort(), "Contenido ZIP BLS desconocido");
  for (const file of definition.files) assert.equal(sha256(archive[`${definition.archive.folder}/${file.name}`]), file.sha256, "Pin XLSX BLS incoherente");
  for (const file of definition.files) await atomicWrite(join(sourceDirectory, file.name), archive[`${definition.archive.folder}/${file.name}`]);
}

export function createBlsArtifacts(catalog) {
  const artifacts = new Map();
  const counts = { foods: catalog.foods.length, nutrients: catalog.nutrients.length, references: catalog.references.length, measurements: 0, qualifiers: {}, origins: {}, foods_with_warnings: 0 };
  const nutrientIds = new Set(catalog.nutrients.map((nutrient) => nutrient.id));
  const referenceIds = new Set(catalog.references.map((reference) => reference.id));
  const issueIds = new Set(catalog.knownIssues.issues.map((issue) => issue.id));
  assert.equal(nutrientIds.size, catalog.nutrients.length, "Componentes BLS duplicados");
  assert.equal(referenceIds.size, catalog.references.length, "Referencias BLS duplicadas");
  const foodIds = new Set();
  const index = [];
  // Compact per-food files plus bounded aggregate pages: no single >100 MB JSON.
  for (const food of catalog.foods) {
    assert.ok(validateFood(food), `Ficha BLS inválida: ${food.id}`);
    assert.equal(food.id, `bls-${food.source.food_code}`, "ID BLS incoherente");
    assert.ok(!foodIds.has(food.id), "Alimento BLS duplicado");
    foodIds.add(food.id);
    const values = food.nutrition_profiles[0].nutrients;
    assert.deepEqual(Object.keys(values), [...nutrientIds], `Componentes BLS incompletos: ${food.id}`);
    for (const value of Object.values(values)) {
      assert.deepEqual(parseBlsValue(value.source_value, value.source_origin), Object.fromEntries(["value", "qualifier", "limit"].filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]])), "Interpretación BLS alterada");
      assert.ok(value.source_ref === null || referenceIds.has(value.source_ref), "Referencia BLS rota");
      counts.measurements++;
      counts.qualifiers[value.qualifier] = (counts.qualifiers[value.qualifier] ?? 0) + 1;
      const origin = value.source_origin ?? "(absent)";
      counts.origins[origin] = (counts.origins[origin] ?? 0) + 1;
    }
    for (const id of food.source_warning_ids) assert.ok(issueIds.has(id), "Aviso BLS desconocido");
    if (food.source_warning_ids.length) counts.foods_with_warnings++;
    artifacts.set(`foods/${food.id}.json`, `${JSON.stringify(food)}\n`);
    index.push({ id: food.id, names: food.names, source: food.source, source_warning_ids: food.source_warning_ids, path: `foods/${food.id}.json` });
  }
  const pages = [];
  for (let start = 0; start < catalog.foods.length; start += 100) {
    const path = `pages/${String(pages.length + 1).padStart(4, "0")}.json`;
    const foods = catalog.foods.slice(start, start + 100);
    artifacts.set(path, `[\n${foods.map((food) => JSON.stringify(food)).join(",\n")}\n]\n`);
    pages.push({ path, count: foods.length, first_id: foods[0].id, last_id: foods.at(-1).id });
  }
  artifacts.set("index.json", json(index));
  artifacts.set("pages.json", json(pages));
  artifacts.set("nutrients.json", json(catalog.nutrients));
  artifacts.set("references.json", json(catalog.references));
  artifacts.set("known-issues.json", json(catalog.knownIssues));
  artifacts.set("manifest.json", json({
    schema_version: 1, source: blsSource, transformations: ["XLSX a JSON; textos originales y léxico numérico conservados", "Microgramos normalizados como ug; sin convertir cantidades ni bases", "Calificadores explícitos; sin imputación ni recálculo", "Índice de erratas separado; no se aplican correcciones de BLS 4.1"],
    localization: { official: ["de", "en"], spanish: "not_provided" },
    counts, nutrient_roles: { energy_kj: "bls-ENERCJ", energy_kcal: "bls-ENERCC", protein_crude_n625: "bls-PROT625", carbs_available: "bls-CHO", fat: "bls-FAT", fiber: "bls-FIBT" },
    files: Object.fromEntries([...artifacts].map(([path, bytes]) => [path, { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }])),
  }));
  return artifacts;
}

async function generatedFiles(root, prefix = "") {
  const paths = [];
  try {
    assert.ok(!(await lstat(join(root, prefix))).isSymbolicLink(), "Directorio BLS enlazado");
    for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (!prefix && ["source", ".source", "README.md", "LICENSE.md", ".gitignore"].includes(entry.name)) continue;
      assert.ok(!entry.isSymbolicLink(), `Symlink de salida BLS: ${path}`);
      if (entry.isDirectory()) paths.push(...await generatedFiles(root, `${path}/`));
      else paths.push(path);
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  return paths.sort(compare);
}

export async function checkBlsArtifacts(catalog, root = blsRoot) {
  const artifacts = createBlsArtifacts(catalog);
  assert.deepEqual(await generatedFiles(root), [...artifacts.keys()].sort(compare), "Archivos BLS inesperados o ausentes");
  for (const [path, expected] of artifacts) assert.equal(await readFile(join(root, path), "utf8"), expected, `Artefacto BLS desactualizado: ${path}`);
  return JSON.parse(artifacts.get("manifest.json")).counts;
}

export async function writeBlsArtifacts(catalog, root = blsRoot) {
  const artifacts = createBlsArtifacts(catalog);
  for (const path of await generatedFiles(root)) assert.ok(artifacts.has(path), `Archivo BLS ajeno; no se borrará: ${path}`);
  // Commit marker last. An interruption cannot pass --check; rerunning is safe.
  for (const [path, bytes] of artifacts) await atomicWrite(join(root, path), bytes);
  return JSON.parse(artifacts.get("manifest.json")).counts;
}

export function assertBlsDirectories(sourceDirectory, outputDirectory) {
  if (resolve(sourceDirectory) === join(resolve(outputDirectory), "source")) return;
  for (const [parent, child] of [[sourceDirectory, outputDirectory], [outputDirectory, sourceDirectory]]) {
    const path = relative(resolve(parent), resolve(child));
    assert.ok(path && (path === ".." || path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(path)), "Los directorios de fuente y salida BLS deben estar separados");
  }
}
