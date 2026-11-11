import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, realpath, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import fc from "fast-check";
import { bedcaSource, bedcaQueries, bedcaFoodQuery, buildBedcaQuery, parseBedcaXml, parseBedcaIndex, parseBedcaDetail, decodeBedcaXml, leafFields, downloadBedcaSource, assertLocalBedcaDirectory, bedcaRepositoryRoot } from "./bedca-source.mjs";
import { parseBedcaValue, convertBedcaSnapshot, loadBedcaSnapshot, createBedcaArtifacts, writeBedcaArtifacts, checkBedcaArtifacts, assertBedcaPublicationPaths, checkBedcaPublication } from "./bedca.mjs";
import { syntheticResponses, syntheticValues, syntheticFetch } from "./__fixtures__/bedca/synthetic.mjs";

const options = (calls = [], hook) => ({ fetchImpl: syntheticFetch(calls, hook), intervalMs: 0, sleep: async () => {}, now: () => "2026-01-01T00:00:00.000Z" });
async function temporary(t) {
  const path = await mkdtemp(join(await realpath(tmpdir()), "bedca-test-"));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
async function capture(t) {
  const root = await temporary(t);
  const source = join(root, "source");
  await downloadBedcaSource(source, options());
  return { root, source, snapshot: await loadBedcaSnapshot(source) };
}

test("XML BEDCA: solo consultas de lectura y condiciones escapadas", () => {
  assert.match(buildBedcaQuery(bedcaFoodQuery("900000001")), /<relation type="EQUAL"/);
  assert.throws(() => bedcaFoodQuery("../secret"), /ID BEDCA/);
  assert.throws(() => buildBedcaQuery({ level: "6", fields: ["f_id"], order: "f_id" }), /lectura/);
  const xml = buildBedcaQuery({ ...bedcaQueries.index, conditions: [["f_ori_name", 'A&B<"test">']] });
  const root = parseBedcaXml(xml);
  assert.equal(root.children.find((node) => node.name === "condition").children.find((node) => node.name === "cond3").text, 'A&B<"test">');
});

test("XML BEDCA: rechaza DOCTYPE, campos duplicados, raíces falsas, respuestas truncadas y UTF-8 inválido", () => {
  for (const xml of ['<!DOCTYPE foodresponse [<!ENTITY x SYSTEM "file:///etc/passwd">]><foodresponse>&x;</foodresponse>', "<foodresponse><food>", "<html><body>Error</body></html>", "<foodresponse><food><f_id>1</f_id><f_id>2</f_id></food></foodresponse>", "<foodresponse><food><f_id>1</f_id></food><food><f_id>1</f_id></food></foodresponse>"]) {
    assert.throws(() => parseBedcaIndex(xml));
  }
  assert.throws(() => decodeBedcaXml(Buffer.from([0xff])), /encoded data|encoding/i);
  assert.throws(() => parseBedcaDetail(syntheticResponses["foods/900000001"], "999"), /ID solicitado/);
  assert.equal(parseBedcaDetail(syntheticResponses["foods/900000002"], "900000002").empty, true);
  assert.throws(() => leafFields(parseBedcaXml("<food><constructor>x</constructor></food>")), /reservado/);
});

test("valores: distingue trazas, límites, ceros lógicos/reguladores, indeterminados y unidades sin recalcular", () => {
  assert.deepEqual(parseBedcaValue(" 12,3400 ", "BE"), { source_value: " 12,3400 ", value: 12.34, qualifier: "reported" });
  assert.equal(parseBedcaValue("0", "TR").value, null);
  assert.equal(parseBedcaValue("", "TR").qualifier, "trace");
  assert.equal(parseBedcaValue("0", "LZ").qualifier, "logical_zero");
  assert.equal(parseBedcaValue("0", "RZ").qualifier, "regulatory_zero");
  assert.equal(parseBedcaValue("1.2", "UD").value, null);
  assert.equal(parseBedcaValue("1.2", "X").qualifier, "unknown_type");
  assert.equal(parseBedcaValue("", "AR").qualifier, "missing");
  assert.deepEqual(parseBedcaValue("0.02", "BL"), { source_value: "0.02", value: null, qualifier: "below_detection", limit: 0.02 });
  assert.equal(parseBedcaValue("0.2", "LT").limit, 0.2);
  assert.equal(parseBedcaValue("0.2", "MT").qualifier, "greater_than");
  assert.equal(parseBedcaValue("< 0,2", "AR").qualifier, "less_than");
  assert.equal(parseBedcaValue(">0.2", "LT").qualifier, "inconsistent_type");
  assert.equal(parseBedcaValue("4.20", "LZ").value, null);
  for (const raw of ["NaN", "Infinity", "1/2", "1.0 extra", "1e999", "1.2.3"]) assert.throws(() => parseBedcaValue(raw, "AR"));
});

test("propiedades: números finitos y texto original se conservan; trazas y límites nunca son cantidades exactas", () => {
  fc.assert(fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }), (value) => {
    const text = String(value);
    const parsed = parseBedcaValue(text, "AR");
    assert.equal(parsed.value, Number(text));
    assert.equal(parsed.source_value, text);
    for (const type of ["TR", "LT", "MT", "BL", "UD"]) assert.equal(parseBedcaValue(text, type).value, null);
  }), { numRuns: 300 });
  fc.assert(fc.property(fc.string(), (text) => {
    const xml = buildBedcaQuery({ ...bedcaQueries.index, conditions: [["f_ori_name", text.replaceAll(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")]] });
    assert.equal(parseBedcaXml(xml).name, "foodquery");
  }), { numRuns: 100 });
});

test("captura: descarga todas las respuestas, consultas y documentos, fija hashes y reanuda sin red", async (t) => {
  const directory = await temporary(t);
  const calls = [];
  const sleeps = [];
  const manifest = await downloadBedcaSource(directory, { ...options(calls), intervalMs: 2500, sleep: async (ms) => sleeps.push(ms) });
  assert.equal(manifest.complete, true);
  assert.equal(manifest.foods, 2);
  assert.equal(manifest.files.length, 21);
  assert.equal(calls.length, 13);
  assert.ok(sleeps.every((ms) => ms >= 2500));
  const before = await readFile(join(directory, "snapshot.json"), "utf8");
  await downloadBedcaSource(directory, { ...options(), fetchImpl: () => { throw new Error("No debe consultar la red"); } });
  assert.equal(await readFile(join(directory, "snapshot.json"), "utf8"), before);
  const snapshot = await loadBedcaSnapshot(directory);
  assert.match(snapshot.snapshotId, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.details.size, 2);
});

test("captura: reanuda una interrupción y no repite una ficha ya registrada", async (t) => {
  const directory = await temporary(t);
  await assert.rejects(downloadBedcaSource(directory, options([], (name) => {
    if (name === "foods/900000002") return new Response("Fallo transitorio sintético", { status: 503 });
  })), /HTTP 503/);
  await assert.rejects(loadBedcaSnapshot(directory), /incompleta/);
  const calls = [];
  await downloadBedcaSource(directory, options(calls));
  assert.deepEqual(calls, ["foods/900000002", "index"]);
  assert.equal((await loadBedcaSnapshot(directory)).index.length, 2);
});

test("captura: recupera una respuesta escrita antes de su recibo sin volver a descargarla", async (t) => {
  const directory = await temporary(t);
  await assert.rejects(downloadBedcaSource(directory, options([], (name) => name === "foods/900000002" ? new Response("error", { status: 403 }) : undefined)), /HTTP 403/);
  await writeFile(join(directory, "responses/foods/900000002.xml"), syntheticResponses["foods/900000002"]);
  const calls = [];
  const manifest = await downloadBedcaSource(directory, options(calls));
  assert.deepEqual(calls, ["index"]);
  assert.equal(manifest.files.find((entry) => entry.path === "responses/foods/900000002.xml").recovered, true);
});

test("captura: un cambio del índice durante la descarga nunca se declara completo", async (t) => {
  const directory = await temporary(t);
  let count = 0;
  await assert.rejects(downloadBedcaSource(directory, options([], (name) => name === "index" && ++count === 2 ? new Response(syntheticResponses.index + "\n") : undefined)), /cambió/);
  assert.equal(JSON.parse(await readFile(join(directory, "snapshot.json"), "utf8")).complete, false);
});

test("captura: alteraciones, HTML con HTTP 200 y rutas peligrosas fallan sin borrar la copia", async (t) => {
  const { source } = await capture(t);
  const path = join(source, "responses/foods/900000001.xml");
  await writeFile(path, "alterado");
  await assert.rejects(loadBedcaSnapshot(source), /alterado/);
  await assert.rejects(downloadBedcaSource(source, options()), /alterado/);
  assert.equal(await readFile(path, "utf8"), "alterado");
  const another = await temporary(t);
  await assert.rejects(downloadBedcaSource(another, options([], (name) => name === "index" ? new Response("<html>Error</html>") : undefined)), /listado/);
  const manifest = JSON.parse(await readFile(join(another, "snapshot.json"), "utf8"));
  assert.ok(!manifest.files.some((entry) => entry.path === "responses/index.xml"));
});

test("captura: el lock evita descargas simultáneas y los checks rechazan archivos extra", async (t) => {
  const { source } = await capture(t);
  await writeFile(join(source, ".download.lock"), "{}\n");
  await assert.rejects(downloadBedcaSource(source, options()), /reservada/);
  await rm(join(source, ".download.lock"));
  await writeFile(join(source, "extra.xml"), "<foodresponse/>");
  await assert.rejects(loadBedcaSnapshot(source), /sin registrar/);
});

test("conversión: conserva fichas vacías, mediciones repetidas, rangos, métodos, citas y unidades por registro", async (t) => {
  const { snapshot } = await capture(t);
  const catalog = convertBedcaSnapshot(snapshot);
  assert.equal(catalog.foods.length, 2);
  assert.equal(catalog.foods[1].availability, "empty");
  assert.deepEqual(catalog.foods[1].nutrition_profiles, []);
  const food = catalog.foods[0];
  assert.equal(food.edible_fraction.value, 0.8);
  const values = food.nutrition_profiles.flatMap((profile) => profile.measurements);
  assert.deepEqual(values.map((value) => value.source_fields), syntheticValues);
  assert.deepEqual(values.map((value) => value.unit), ["g", "mg", "g", "g"]);
  assert.equal(food.nutrition_profiles[0].basis.amount, 100);
  assert.equal(food.nutrition_profiles[1].basis, null);
  assert.equal(values[0].source_fields.min, "11.10");
  assert.equal(values[0].source_fields.method_id, "synthetic-method");
  assert.equal(catalog.references[0].variants.length, 2);
  assert.equal(catalog.diagnostics.length, 0);
});

test("conversión: discrepancias de identidad y componentes/tipos desconocidos no se silencian", async (t) => {
  const { snapshot } = await capture(t);
  for (const [mutate, pattern] of [
    [(s) => { s.details.get("900000001").fields.f_ori_name += " distinto"; }, /discrepan/],
    [(s) => { s.details.get("900000001").values[0].c_id = "123456"; }, /sin definición/],
    [(s) => { s.details.get("900000001").values[0].value_type = "UNLISTED"; }, /no documentado/],
  ]) {
    const changed = structuredClone(snapshot); mutate(changed);
    assert.throws(() => convertBedcaSnapshot(changed), pattern);
  }
});

test("regresión: una cantidad con tipo cero contradictorio se conserva sin corregirla ni usarla como cantidad exacta", async (t) => {
  const { snapshot } = await capture(t);
  const measurement = snapshot.details.get("900000001").values[0];
  measurement.value_type = "LZ";
  measurement.best_location = "4.20"; // Valor inventado; no copia una medición real.
  const catalog = convertBedcaSnapshot(snapshot);
  const result = catalog.foods[0].nutrition_profiles[0].measurements[0];
  assert.equal(result.qualifier, "inconsistent_type");
  assert.equal(result.value, null);
  assert.equal(result.source_value, "4.20");
  assert.equal(result.value_type, "LZ");
  assert.deepEqual(result.source_fields, measurement);
  assert.deepEqual(catalog.diagnostics, [{ code: "inconsistent_value_type", food_id: "bedca-900000001", position: 0 }]);
});

test("importación: salida reproducible, validación offline y protección de archivos ajenos", async (t) => {
  const { root, snapshot } = await capture(t);
  const output = join(root, "catalog");
  const artifacts = createBedcaArtifacts(snapshot);
  assert.deepEqual(artifacts, createBedcaArtifacts(snapshot));
  await writeBedcaArtifacts(output, artifacts);
  const counts = await checkBedcaArtifacts(output, createBedcaArtifacts(snapshot));
  assert.equal(counts.foods, 2);
  assert.equal(counts.empty, 1);
  assert.equal(counts.measurements, 4);
  await writeBedcaArtifacts(output, artifacts);
  await writeFile(join(output, "notas-del-mantenedor.txt"), "Conservar");
  await assert.rejects(writeBedcaArtifacts(output, artifacts), /sin registrar/);
  assert.equal(await readFile(join(output, "notas-del-mantenedor.txt"), "utf8"), "Conservar");
});

test("publicación: bloquea datos versionados, salidas publicables y symlinks", async (t) => {
  assert.doesNotThrow(() => assertBedcaPublicationPaths(["alimentos/bedca/README.md", "alimentos/bedca/.gitignore"]));
  for (const path of ["alimentos/bedca/all.json", "alimentos/bedca/.local/source/responses/index.xml"]) assert.throws(() => assertBedcaPublicationPaths([path]), /publicar datos/);
  assert.equal(checkBedcaPublication(), true);
  await assert.rejects(assertLocalBedcaDirectory(resolve(bedcaRepositoryRoot, "apps/mobile/public/bedca")), /cuarentena/);
  const directory = await temporary(t);
  await symlink(directory, join(directory, "alias"));
  await assert.rejects(assertLocalBedcaDirectory(join(directory, "alias/data")), /symlink/);
});

test("CLI: reconstrucción y comparación exactas sin red con snapshot fijado", async (t) => {
  const { root, snapshot } = await capture(t);
  const cli = resolve(bedcaRepositoryRoot, "scripts/catalogs/import-bedca.mjs");
  const args = ["--workspace-dir", root, "--snapshot-sha256", snapshot.snapshotId];
  const first = execFileSync(process.execPath, [cli, "--write", ...args], { encoding: "utf8" });
  const second = execFileSync(process.execPath, [cli, "--check", ...args], { encoding: "utf8" });
  assert.equal(first, second);
  const failed = spawnSync(process.execPath, [cli, "--check", "--download", ...args], { encoding: "utf8" });
  assert.notEqual(failed.status, 0); assert.match(failed.stderr, /no descarga/);
  const wrong = spawnSync(process.execPath, [cli, "--check", "--workspace-dir", root, "--snapshot-sha256", "0".repeat(64)], { encoding: "utf8" });
  assert.notEqual(wrong.status, 0); assert.match(wrong.stderr, /huella fijada/);
  const nested = spawnSync(process.execPath, [cli, "--write", "--workspace-dir", root, "--output-dir", join(root, "source/derived")], { encoding: "utf8" });
  assert.notEqual(nested.status, 0); assert.match(nested.stderr, /sin anidarse/);
});
