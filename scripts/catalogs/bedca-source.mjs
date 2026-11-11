import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdir, rename, writeFile, lstat, realpath, open, unlink } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sax from "sax";

export const bedcaRepositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
export const bedcaSource = JSON.parse(await readFile(new URL("bedca-source.json", import.meta.url), "utf8"));
export const bedcaLocalRoot = resolve(bedcaRepositoryRoot, "alimentos/bedca/.local");
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const numericCode = (value) => typeof value === "string" && /^\d+$/.test(value);
export const decodeBedcaXml = (bytes) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);

const foodFields = ["f_id", "f_ori_name", "f_eng_name", "sci_name", "langual", "foodexcode", "mainlevelcode", "codlevel1", "namelevel1", "codsublevel", "codlevel2", "namelevel2", "f_des_esp", "f_des_ing", "photo", "edible_portion", "f_origen"];
const valueFields = ["c_id", "c_ori_name", "c_eng_name", "eur_name", "componentgroup_id", "glos_esp", "glos_ing", "cg_descripcion", "cg_description", "best_location", "v_unit", "moex", "stdv", "min", "max", "v_n", "u_id", "u_descripcion", "u_description", "value_type", "vt_descripcion", "vt_description", "mu_id", "mu_descripcion", "mu_description", "ref_id", "citation", "at_descripcion", "at_description", "pt_descripcion", "pt_description", "method_id", "mt_descripcion", "mt_description", "m_descripcion", "m_description", "m_nom_esp", "m_nom_ing", "mhd_descripcion", "mhd_description"];

export const bedcaQueries = {
  index: { level: "1", fields: ["f_id", "f_ori_name", "langual", "f_eng_name", "f_origen", "edible_portion"], conditions: [["f_origen", "BEDCA"]], order: "f_ori_name" },
  components: { level: "3h", fields: ["cg_id", "c_id", "c_ori_name", "c_eng_name", "eur_name", "c_com_esp", "c_com_ing", "glos_esp", "glos_ing"], conditions: [["publico", "1"]], order: "cg_id" },
  food_groups: { level: "3", fields: ["fg_id", "fg_ori_name", "fg_eng_name"], order: "fg_id" },
  component_groups: { level: "3g", fields: ["cg_id", "cg_descripcion", "cg_description"], order: "cg_id" },
  value_types: { level: "3j", fields: ["vt_id", "vt_descripcion", "vt_description"], order: "vt_id" },
  expressions: { level: "3k", fields: ["mu_id", "mu_descripcion", "mu_description"], order: "mu_id" },
  units: { level: "3l", fields: ["u_id", "u_descripcion", "u_description"], order: "u_id" },
};
export function bedcaFoodQuery(id) {
  assert.ok(numericCode(id), "ID BEDCA inválido");
  return { level: "2", fields: [...foodFields, ...valueFields], conditions: [["f_id", id], ["publico", "1"]], order: "componentgroup_id" };
}
export const bedcaProtocolHash = () => sha256(json({ bedcaQueries, detail: bedcaFoodQuery("0"), source: bedcaSource }));
const xmlEscape = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function buildBedcaQuery({ level, fields, conditions = [], order }) {
  assert.ok(["1", "2", "3", "3g", "3h", "3j", "3k", "3l"].includes(level), "Solo se permiten consultas de lectura BEDCA");
  const selection = fields.map((name) => `<atribute name="${xmlEscape(name)}"/>`).join("");
  const filters = conditions.map(([field, value]) => `<condition><cond1><atribute1 name="${xmlEscape(field)}"/></cond1><relation type="EQUAL"/><cond3>${xmlEscape(value)}</cond3></condition>`).join("");
  return `<?xml version="1.0" encoding="utf-8"?><foodquery><type level="${level}"/><selection>${selection}</selection>${filters}<order ordtype="ASC"><atribute3 name="${xmlEscape(order)}"/></order></foodquery>`;
}

export function parseBedcaXml(input) {
  assert.ok(Buffer.byteLength(input) <= bedcaSource.max_response_bytes, "XML BEDCA demasiado grande");
  const parser = sax.parser(true, { trim: false, normalize: false });
  const stack = [];
  let root;
  parser.ondoctype = () => { throw new Error("DOCTYPE no permitido en BEDCA"); };
  parser.onopentag = ({ name, attributes }) => {
    assert.ok(stack.length < 12, "XML BEDCA demasiado profundo");
    const node = { name, attributes, text: "", children: [] };
    if (stack.length) stack.at(-1).children.push(node);
    else { assert.ok(!root, "Más de una raíz XML"); root = node; }
    stack.push(node);
  };
  parser.ontext = parser.oncdata = (text) => {
    if (stack.length) stack.at(-1).text += text;
    else assert.ok(!text.trim(), "Texto fuera de la raíz XML");
  };
  parser.onclosetag = () => stack.pop();
  parser.write(input.replace(/^\uFEFF/, "")).close();
  assert.ok(root && stack.length === 0, "XML BEDCA vacío o truncado");
  return root;
}
export function leafFields(node, skip = []) {
  const fields = {};
  assert.ok(!node.text.trim(), `Texto inesperado en ${node.name}`);
  for (const field of node.children) {
    if (skip.includes(field.name)) continue;
    assert.equal(field.children.length, 0, `Campo BEDCA anidado: ${field.name}`);
    assert.ok(!Object.hasOwn(fields, field.name), `Campo BEDCA duplicado: ${field.name}`);
    assert.ok(!["__proto__", "constructor", "prototype"].includes(field.name), "Campo XML reservado");
    fields[field.name] = field.text;
  }
  return fields;
}
export function parseBedcaIndex(text) {
  const root = parseBedcaXml(text);
  assert.equal(root.name, "foodresponse", "No es un listado BEDCA");
  assert.ok(root.children.length > 0, "Listado BEDCA vacío");
  const seen = new Set();
  return root.children.map((node) => {
    assert.equal(node.name, "food", "Fila inesperada en el listado BEDCA");
    const row = leafFields(node);
    assert.ok(numericCode(row.f_id) && row.f_ori_name?.trim(), "Listado BEDCA sin ID o nombre");
    assert.ok(!seen.has(row.f_id), `ID BEDCA duplicado: ${row.f_id}`);
    seen.add(row.f_id);
    return row;
  });
}
export function parseBedcaDetail(text, id) {
  const root = parseBedcaXml(text);
  assert.equal(root.name, "foodresponse", "No es una ficha BEDCA");
  const foods = root.children.filter((node) => node.name === "food");
  assert.equal(foods.length, 1, "La respuesta debe contener una única ficha BEDCA");
  const fields = leafFields(foods[0], ["foodvalue"]);
  if (!foods[0].children.length) return { fields, values: [], empty: true };
  assert.equal(fields.f_id, id, "La ficha BEDCA no corresponde al ID solicitado");
  return { fields, values: foods[0].children.filter((node) => node.name === "foodvalue").map((node) => leafFields(node)), empty: false };
}

export async function assertLocalBedcaDirectory(directory) {
  const target = resolve(directory);
  // No permitir salidas mediante symlinks a una carpeta publicable.
  let ancestor = target;
  while (true) {
    try { assert.ok(["/tmp", "/var"].includes(ancestor) || !(await lstat(ancestor)).isSymbolicLink(), "Directorio BEDCA con symlink"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (dirname(ancestor) === ancestor) break;
    ancestor = dirname(ancestor);
  }
  // realpath también normaliza /tmp en macOS.
  let existing = target;
  while (true) {
    try { await realpath(existing); break; }
    catch (error) { if (error.code !== "ENOENT") throw error; existing = dirname(existing); }
  }
  const canonical = resolve(await realpath(existing), relative(existing, target));
  const path = relative(await realpath(bedcaRepositoryRoot), canonical);
  if (!path.startsWith("../") && path !== ".." && !isAbsolute(path)) {
    assert.ok(path === "alimentos/bedca/.local" || path.startsWith("alimentos/bedca/.local/"), "BEDCA no puede escribirse fuera de su cuarentena local dentro del repositorio");
    let ignored = false;
    try { execFileSync("git", ["check-ignore", "--no-index", "--quiet", "--", `${path}/bedca-local-probe`], { cwd: bedcaRepositoryRoot, stdio: "pipe" }); ignored = true; } catch { /* Fallar cerrado. */ }
    assert.ok(ignored, "BEDCA solo puede escribirse en una carpeta local ignorada por Git");
  }
  return canonical;
}
export async function atomicWrite(path, bytes) {
  await assertLocalBedcaDirectory(dirname(path));
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, bytes, { flag: "wx" });
  await rename(temporary, path);
}
export async function readSnapshotFile(directory, entry) {
  assert.ok(/^(?:responses\/[a-z_]+|responses\/foods\/\d+|requests\/[a-z_]+|requests\/foods\/\d+|documents\/[a-zA-Z0-9._-]+)\.(?:xml|pdf|js|xsl)$/.test(entry.path), "Ruta de snapshot BEDCA no permitida");
  const path = resolve(directory, entry.path);
  assert.ok((await lstat(path)).isFile() && !(await lstat(path)).isSymbolicLink(), "Archivo BEDCA no regular");
  const bytes = await readFile(path);
  assert.equal(bytes.length, entry.bytes, `Tamaño BEDCA alterado: ${entry.path}`);
  assert.equal(sha256(bytes), entry.sha256, `SHA-256 BEDCA alterado: ${entry.path}`);
  return bytes;
}

async function downloadBedcaSourceUnlocked(directory, { fetchImpl = fetch, intervalMs = bedcaSource.interval_ms, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => new Date().toISOString(), progress = () => {}, signal } = {}) {
  await assertLocalBedcaDirectory(directory);
  await mkdir(directory, { recursive: true });
  const manifestPath = resolve(directory, "snapshot.json");
  const protocol = bedcaProtocolHash();
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!manifest) manifest = { schema_version: 1, dataset_id: bedcaSource.id, protocol_sha256: protocol, license: bedcaSource.license, started_at: now(), completed_at: null, complete: false, files: [] };
  assert.equal(manifest.protocol_sha256, protocol, "Protocolo BEDCA distinto: usa un directorio nuevo");
  assert.equal(manifest.dataset_id, bedcaSource.id);
  const files = new Map();
  for (const entry of manifest.files) {
    assert.ok(!files.has(entry.path), "Entrada de snapshot duplicada");
    await readSnapshotFile(directory, entry);
    files.set(entry.path, entry);
  }
  const save = async () => { manifest.files = [...files.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0); await atomicWrite(manifestPath, json(manifest)); };
  const store = async (path, bytes, extra = {}) => {
    if (files.has(path)) return readSnapshotFile(directory, files.get(path));
    await atomicWrite(resolve(directory, path), bytes);
    files.set(path, { path, bytes: bytes.length, sha256: sha256(bytes), ...extra });
    await save();
    return bytes;
  };
  let requested = false;
  const request = async (url, body) => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      signal?.throwIfAborted();
      if (requested) await sleep(Math.max(intervalMs, attempt ? 1000 * 2 ** attempt : 0));
      requested = true;
      let response;
      try {
        response = await fetchImpl(url, { method: body ? "POST" : "GET", redirect: "error", headers: body ? { "Content-Type": "text/xml" } : {}, ...(body ? { body } : {}), signal: AbortSignal.any([AbortSignal.timeout(bedcaSource.timeout_ms), ...(signal ? [signal] : [])]) });
        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attempt < 3) continue;
          throw new Error(`BEDCA HTTP ${response.status}`);
        }
        assert.ok(Number(response.headers.get("content-length") || 0) <= bedcaSource.max_response_bytes, "Respuesta BEDCA demasiado grande");
        const chunks = []; let size = 0;
        for await (const chunk of response.body) { size += chunk.length; assert.ok(size <= bedcaSource.max_response_bytes, "Respuesta BEDCA demasiado grande"); chunks.push(chunk); }
        return Buffer.concat(chunks);
      } catch (error) {
        signal?.throwIfAborted();
        if (attempt < 3 && (error.name === "TimeoutError" || error.name === "AbortError" || error instanceof TypeError)) continue;
        throw error;
      }
    }
  };
  const query = async (name, definition, validate) => {
    signal?.throwIfAborted();
    const requestPath = `requests/${name}.xml`;
    const body = buildBedcaQuery(definition);
    if (files.has(requestPath)) assert.equal(decodeBedcaXml(await readSnapshotFile(directory, files.get(requestPath))), body, "Consulta BEDCA modificada");
    else {
      try { assert.equal(decodeBedcaXml(await readFile(resolve(directory, requestPath))), body, "Consulta huérfana BEDCA distinta"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      await store(requestPath, Buffer.from(body));
    }
    const path = `responses/${name}.xml`;
    let bytes;
    if (files.has(path)) bytes = await readSnapshotFile(directory, files.get(path));
    else {
      try { bytes = await readFile(resolve(directory, path)); validate(decodeBedcaXml(bytes)); await store(path, bytes, { requested_at: null, recovered: true, request: requestPath }); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (!bytes) { bytes = await request(bedcaSource.endpoint, body); validate(decodeBedcaXml(bytes)); await store(path, bytes, { requested_at: now(), request: requestPath }); }
    }
    validate(decodeBedcaXml(bytes));
    return decodeBedcaXml(bytes);
  };
  await save();
  for (const [name, url] of [["UsoBD.pdf", bedcaSource.license.url], ["query.js", `${bedcaSource.homepage}query.js`], ["foodresponse1.xsl", `${bedcaSource.homepage}foodresponse1.xsl`]]) {
    const path = `documents/${name}`;
    if (!files.has(path)) {
      const bytes = await request(url);
      if (name.endsWith(".pdf")) assert.equal(bytes.subarray(0, 5).toString(), "%PDF-", "No se recibieron las condiciones BEDCA en PDF");
      else if (name.endsWith(".xsl")) assert.ok(bytes.includes(Buffer.from("xsl:stylesheet")), "No se recibió la plantilla BEDCA esperada");
      else assert.ok(bytes.includes(Buffer.from("procquery.php")), "No se recibió el JavaScript BEDCA esperado");
      await store(path, bytes, { url, requested_at: now() });
    }
  }
  const index = parseBedcaIndex(await query("index", bedcaQueries.index, parseBedcaIndex));
  for (const [name, definition] of Object.entries(bedcaQueries)) {
    if (name !== "index") await query(name, definition, (text) => { assert.ok(parseBedcaXml(text).children.length > 0, `Diccionario BEDCA vacío: ${name}`); });
  }
  let done = 0;
  for (const row of index) {
    await query(`foods/${row.f_id}`, bedcaFoodQuery(row.f_id), (text) => parseBedcaDetail(text, row.f_id));
    done += 1;
    if (done === 1 || done % 25 === 0 || done === index.length) progress({ downloaded: done, total: index.length });
  }
  if (!manifest.complete) {
    const finalIndex = await request(bedcaSource.endpoint, buildBedcaQuery(bedcaQueries.index));
    assert.equal(sha256(finalIndex), files.get("responses/index.xml").sha256, "El listado BEDCA cambió durante la captura; conserva los archivos y usa una captura nueva");
    manifest.complete = true;
    manifest.completed_at = now();
    manifest.foods = index.length;
    await save();
  }
  return manifest;
}

export async function downloadBedcaSource(directory, options = {}) {
  await assertLocalBedcaDirectory(directory);
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, ".download.lock");
  let lock;
  try { lock = await open(path, "wx"); }
  catch (error) { if (error.code === "EEXIST") throw new Error("Ya existe una descarga BEDCA reservada; comprueba .download.lock antes de reanudar"); throw error; }
  try { await lock.writeFile(json({ pid: process.pid, started_at: new Date().toISOString() })); return await downloadBedcaSourceUnlocked(directory, options); }
  finally { await lock.close(); await unlink(path); }
}
