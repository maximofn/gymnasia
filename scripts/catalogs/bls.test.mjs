import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { zipSync, strToU8 } from "fflate";
import fc from "fast-check";
import { workbook, componentRows, foodRows } from "./__fixtures__/bls/synthetic.mjs";
import { readBlsWorkbook, unzipBls } from "./bls-xlsx.mjs";
import { blsRoot, blsSource, sha256, readBlsComponents, createBlsConverter, parseBlsValue, loadBlsOriginalSource, loadBlsSource, createBlsArtifacts, writeBlsArtifacts, checkBlsArtifacts, downloadBlsSource, assertBlsDirectories } from "./bls.mjs";

async function temporary(t) {
  const root = await mkdtemp(join(tmpdir(), "gymnasia-bls-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function fixture(rows = foodRows(), components = componentRows(), issues = { issues: [] }) {
  const nutrients = readBlsComponents(workbook(components));
  const converter = createBlsConverter(nutrients, issues);
  readBlsWorkbook(workbook(rows, "BLS_4_0_Daten_2025_DE"), "BLS_4_0_Daten_2025_DE", converter.acceptRow);
  return converter.finish();
}

test("BLS distingue ceros, límites simbólicos, trazas, ausencias y cálculos", () => {
  assert.deepEqual(parseBlsValue("0", "Analyse"), { value: 0, qualifier: "reported" });
  assert.deepEqual(parseBlsValue("0", "Logische Null"), { value: 0, qualifier: "logical_zero" });
  assert.deepEqual(parseBlsValue("4.2", "Logische Null"), { value: null, qualifier: "inconsistent_origin" });
  for (const value of [null, "", "-"]) assert.deepEqual(parseBlsValue(value, "-"), { value: null, qualifier: "missing" });
  for (const value of ["TR", "0"]) assert.deepEqual(parseBlsValue(value, "Spuren"), { value: null, qualifier: "trace" });
  assert.equal(parseBlsValue("TR", "Rezeptberechnung").qualifier, "trace");
  for (const [raw, qualifier] of [["<LOD", "below_detection"], ["<LOQ", "below_quantification"], ["<LOD or <LOQ", "below_detection_or_quantification"]]) {
    assert.deepEqual(parseBlsValue(raw, "Analyse"), { value: null, qualifier });
  }
  assert.deepEqual(parseBlsValue("< 0,01", "Analyse"), { value: null, qualifier: "less_than", limit: .01 });
  assert.equal(parseBlsValue("1E-6", "Formelberechnung").value, .000001);
  for (const value of ["NaN", "Infinity", "1 kcal", "1,2,3", "1e999"]) assert.throws(() => parseBlsValue(value, "Analyse"));
  assert.throws(() => parseBlsValue("unknown text", "Spuren"));
  assert.throws(() => parseBlsValue("1", "invented origin"));
});

test("BLS conserva léxico decimal y límites: propiedades", () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 1000000 }), fc.integer({ min: 0, max: 6 }), (integer, decimals) => {
    const raw = (integer / 10 ** decimals).toFixed(decimals).replace(".", ",");
    assert.equal(parseBlsValue(raw, "Literatur").value, Number(raw.replace(",", ".")));
    const limit = parseBlsValue(`< ${raw}`, "Analyse");
    assert.equal(limit.value, null);
    assert.equal(limit.limit, Number(raw.replace(",", ".")));
  }), { numRuns: 500 });
});

test("el lector XLSX conserva OOXML numérico, textos, notas, huecos y entidades", () => {
  const c = fixture();
  const f = c.foods.find((food) => food.source.food_code === "A1B0000");
  assert.equal(f.names.de, "Synthetisches Essen & Variante");
  assert.equal(f.source_note, "Synthetic note");
  assert.equal(f.source.worksheet_row, 2);
  assert.deepEqual(f.nutrition_profiles[0].basis, { amount: 100, unit: "g", portion: "edible" });
  const value = f.nutrition_profiles[0].nutrients["bls-ENERCC"];
  assert.equal(value.source_value, "12.3400");
  assert.equal(value.source_type, "n");
  assert.equal(value.value, 12.34);
  assert.equal(value.source_origin, "Formelberechnung");
  assert.equal(c.references.find((r) => r.id === value.source_ref).source_text, "Citation # one & two");
  assert.equal(c.nutrients[1].names.de, "Calcium ");
  assert.equal(c.nutrients[1].source_columns[0], "CA Calcium [mg/100g]");
  assert.equal(c.foods[0].nutrition_profiles[0].nutrients["bls-CA"].source_value, null);
  assert.equal(c.references.find((r) => r.source_text === "-").citation, null);
});

test("el lector XLSX rechaza fórmulas, tipos no admitidos, DTD, filas y celdas duplicadas", () => {
  for (const mutate of [
    (xml) => xml.replace("<v>1</v>", "<f>1+2</f><v>3</v>"),
    (xml) => xml.replace('t="n"', 't="e"'),
    (xml) => `<!DOCTYPE worksheet>${xml}`,
    (xml) => xml.replace('r="2"', 'r="1"'),
    (xml) => xml.replace('r="B1"', 'r="A1"'),
    (xml) => xml.slice(0, -4),
  ]) assert.throws(() => readBlsWorkbook(workbook([[1, "x"], [2]], "BLS_4_0", mutate), "BLS_4_0", () => {}));
  assert.throws(() => readBlsWorkbook(workbook([[1]], "Other"), "BLS_4_0", () => {}));
});

test("ZIP BLS acota descompresión y rechaza rutas no seguras", () => {
  assert.throws(() => unzipBls(zipSync({ "../outside": strToU8("x") })), /segura/);
  assert.throws(() => unzipBls(zipSync({ "a": strToU8("12345") }), 4), /límite/);
  assert.throws(() => unzipBls(strToU8("<html>error</html>")));
});

test("BLS rechaza cambios de cabeceras, unidades, definiciones y duplicados", () => {
  for (const mutate of [
    (rows) => { rows[0][3] = "ENERCC energy [kJ/100g]"; },
    (rows) => { rows.push([...rows[1]]); },
    (rows) => { rows[1][0] = "../bad"; },
    (rows) => { rows[1][1] = ""; },
    (rows) => { rows[1].push("unexpected"); },
    (rows) => { rows[1][4] = "unknown"; },
  ]) { const rows = foodRows(); mutate(rows); assert.throws(() => fixture(rows)); }
  for (const mutate of [
    (rows) => { rows[1][4] = "kg"; },
    (rows) => { rows[2][1] = rows[1][1]; },
    (rows) => { rows[1][0] = 5; },
    (rows) => { rows[0][0] = "Changed"; },
    (rows) => { rows[1][9] = "lost"; },
  ]) { const rows = componentRows(); mutate(rows); assert.throws(() => fixture(foodRows(), rows)); }
});

test("las erratas se enlazan sin corregir valores y rechazan códigos inexistentes", () => {
  const issues = { corrections_applied: false, issues: [{ id: "bls-errata-fixture", component_codes: ["ENERCC"], food_codes: ["A1B0000"] }] };
  const c = fixture(foodRows(), componentRows(), issues);
  assert.equal(c.foods[1].nutrition_profiles[0].nutrients["bls-ENERCC"].value, 12.34);
  assert.deepEqual(c.foods[1].source_warning_ids, ["bls-errata-fixture"]);
  issues.issues[0].food_codes.push("A999999");
  assert.throws(() => fixture(foodRows(), componentRows(), issues), /inexistente/);
});

test("BLS genera fichas, páginas, diccionarios y manifiesto byte a byte deterministas", async (t) => {
  const catalog = fixture();
  const first = createBlsArtifacts(catalog);
  assert.deepEqual(createBlsArtifacts(catalog), first);
  assert.deepEqual(JSON.parse(first.get("pages/0001.json")), catalog.foods);
  const manifest = JSON.parse(first.get("manifest.json"));
  assert.equal(manifest.counts.measurements, 4);
  for (const [path, entry] of Object.entries(manifest.files)) assert.equal(entry.sha256, sha256(first.get(path)));
  const root = await temporary(t);
  await writeBlsArtifacts(catalog, root);
  assert.equal((await checkBlsArtifacts(catalog, root)).foods, 2);
  const before = await readFile(join(root, "manifest.json"));
  await mkdir(join(root, "image-batches/0001"), { recursive: true });
  await writeFile(join(root, "image-batches/0001/editorial-fixture"), "Image assets have their own validator");
  await writeBlsArtifacts(catalog, root);
  assert.equal((await checkBlsArtifacts(catalog, root)).foods, 2);
  assert.equal(await readFile(join(root, "image-batches/0001/editorial-fixture"), "utf8"), "Image assets have their own validator");
  assert.deepEqual(await readFile(join(root, "manifest.json")), before);
});

test("el agregado BLS cruza el límite de 100 fichas sin perder orden ni duplicar datos", () => {
  const base = foodRows();
  const rows = [base[0]];
  for (let i = 0; i < 101; i++) rows.push([`A${String(i).padStart(6, "0")}`, ...base[1].slice(1)]);
  const catalog = fixture(rows);
  const artifacts = createBlsArtifacts(catalog);
  const pages = JSON.parse(artifacts.get("pages.json"));
  assert.deepEqual(pages.map((page) => page.count), [100, 1]);
  assert.deepEqual(pages.flatMap((page) => JSON.parse(artifacts.get(page.path))), catalog.foods);
});

test("textos escapados y Unicode de nombres BLS sobreviven a OOXML y JSON", () => {
  fc.assert(fc.property(fc.array(fc.constantFrom("a", "ñ", "é", "&", "<", ">", '"', "'", " "), { minLength: 1, maxLength: 30 }), (chars) => {
    const name = chars.join("");
    const rows = foodRows(); rows[1][1] = name;
    const catalog = fixture(rows);
    assert.equal(catalog.foods[1].names.de, name);
    assert.equal(JSON.parse(createBlsArtifacts(catalog).get("foods/bls-A1B0000.json")).names.de, name);
  }), { numRuns: 80 });
});

test("BLS detecta corrupción y no borra archivos ajenos ni sigue symlinks de salida", async (t) => {
  const root = await temporary(t);
  const c = fixture();
  await writeBlsArtifacts(c, root);
  await writeFile(join(root, "pages/0001.json"), "[]\n");
  await assert.rejects(() => checkBlsArtifacts(c, root), /desactualizado/);
  await writeFile(join(root, "foods/personal.json"), "private");
  await assert.rejects(() => writeBlsArtifacts(c, root), /ajeno/);
  assert.equal(await readFile(join(root, "foods/personal.json"), "utf8"), "private");
  const other = await temporary(t);
  await symlink(root, join(other, "linked"));
  await assert.rejects(() => writeBlsArtifacts(c, join(other, "linked")), /enlazado/);
});

test("BLS valida significado, referencias y componentes antes de escribir", () => {
  for (const mutate of [
    (c) => { c.foods[0].id = "bls-A999999"; },
    (c) => { c.foods.push(c.foods[0]); },
    (c) => { delete c.foods[0].nutrition_profiles[0].nutrients["bls-CA"]; },
    (c) => { c.foods[1].nutrition_profiles[0].nutrients["bls-ENERCC"].value = 99; },
    (c) => { c.foods[1].nutrition_profiles[0].nutrients["bls-ENERCC"].source_ref = `bls-ref-${"0".repeat(64)}`; },
  ]) { const c = fixture(); mutate(c); assert.throws(() => createBlsArtifacts(c)); }
});

test("descarga BLS valida todo antes de escribir, reusa la fuente y falla ante cambios remotos", async (t) => {
  const bytes = zipSync({ "fixture/a.xlsx": strToU8("invented workbook") });
  const definition = { download_page: "https://www.blsdb.de/download", archive: { path: "/assets/uploads/data.zip", folder: "fixture", sha256: sha256(bytes), entries: [{ path: "fixture/a.xlsx", sha256: sha256("invented workbook") }] }, files: [{ name: "a.xlsx", sha256: sha256("invented workbook") }] };
  const requests = [];
  const fetchImpl = async (url) => { requests.push(url); return new Response(url.endsWith("/download") ? '<a href="&#47;assets&#47;uploads&#47;data&#46;zip?token=ephemeral&amp;other=1">Download</a>' : bytes); };
  const root = await temporary(t);
  await downloadBlsSource(root, fetchImpl, definition);
  assert.equal(await readFile(join(root, "a.xlsx"), "utf8"), "invented workbook");
  assert.equal(requests.length, 2);
  await downloadBlsSource(root, () => { throw new Error("Must not use network"); }, definition);
  const empty = await temporary(t);
  await assert.rejects(() => downloadBlsSource(empty, async (url) => new Response(url.endsWith("/download") ? '<a href="/assets/uploads/data.zip">x</a>' : "<html>error</html>"), definition), /SHA-256/);
  await assert.rejects(() => downloadBlsSource(empty, async () => new Response("", { status: 503 }), definition), /HTTP 503/);
  await assert.rejects(() => downloadBlsSource(empty, async () => new Response('<a href="https://other.example/assets/uploads/data.zip">x</a>'), definition), /enlace ZIP/);
  await writeFile(join(root, "a.xlsx"), "changed");
  await assert.rejects(() => downloadBlsSource(root, fetchImpl, definition), /alterada/);
});

test("el CLI BLS rechaza parámetros ambiguos, checks con red y directorios solapados", () => {
  for (const args of [["--check", "--download"], ["--write", "--check"], ["--write", "--source-dir"], ["--write", "--unknown"]]) {
    const r = spawnSync(process.execPath, [join(blsRoot, "../../scripts/catalogs/import-bls.mjs"), ...args], { encoding: "utf8" });
    assert.equal(r.status, 1);
  }
  assert.throws(() => assertBlsDirectories("/tmp/source", "/tmp/source/output"));
  assert.throws(() => assertBlsDirectories("/tmp/source", "/tmp/source"));
});

test("el PDF de erratas se descarga con hash fijado, se reutiliza offline y rechaza alteraciones", async (t) => {
  const root = await temporary(t);
  const bytes = Buffer.from("synthetic official erratum");
  const definition = { files: [], errata: { name: "erratum.pdf", url: "https://www.blsdb.de/erratum.pdf", sha256: sha256(bytes) } };
  let calls = 0;
  await downloadBlsSource(root, async (url) => { calls++; assert.equal(url, definition.errata.url); return new Response(bytes); }, definition);
  assert.equal(calls, 1);
  await downloadBlsSource(root, () => { throw new Error("No network"); }, definition);
  await writeFile(join(root, "erratum.pdf"), "tampered");
  await assert.rejects(() => downloadBlsSource(root, () => { throw new Error("No network"); }, definition), /alterado/);
  const empty = await temporary(t);
  await assert.rejects(() => downloadBlsSource(empty, async () => new Response("wrong document"), definition), /SHA-256 del erratum/);
});

test("la entrega BLS completa se reconstruye sin red desde los XLSX oficiales fijados", { timeout: 240000 }, async (t) => {
  const source = await loadBlsSource();
  const counts = await checkBlsArtifacts(source);
  assert.equal(counts.foods, 7140);
  assert.equal(counts.nutrients, 138);
  assert.equal(counts.measurements, 985320);
  assert.equal(counts.qualifiers.missing, 110100);
  assert.equal(counts.foods_with_warnings, 747);
  assert.equal(counts.qualifiers.trace, 1806);
  assert.equal(counts.qualifiers.below_detection_or_quantification, 392);
  const rows = new Map(source.foods.map((food) => [food.source.food_code, food]));
  assert.equal(rows.get("M111100").nutrition_profiles[0].nutrients["bls-RETOL"].value, 2.4);
  assert.ok(rows.get("M111100").source_warning_ids.includes("bls-errata-202608-milk_retinol"));
  assert.equal(rows.get("G322132").nutrition_profiles[0].nutrients["bls-ZN"].qualifier, "below_quantification");
  assert.ok(rows.get("G322132").source_warning_ids.includes("bls-errata-202608-zinc_limits"));
  assert.ok(rows.get("T104100").source_warning_ids.includes("bls-errata-202608-anchovy_fat_energy"));
  assert.equal(rows.get("T104100").nutrition_profiles[0].nutrients["bls-FAT"].value, null);
  assert.deepEqual(source.errataApplication.counts, { applied: 69, derived: 822, pending: 950, measurement_changes: 1839, formula_changes: 2 });
  assert.equal(counts.qualifiers.recomputed, 822);
  assert.equal(counts.qualifiers.invalidated_by_erratum, 950);
  const raw = await loadBlsOriginalSource();
  const journal = new Map(source.corrections.map((entry) => [entry.id, entry]));
  let compared = 0;
  for (const food of raw.foods) {
    const effective = rows.get(food.source.food_code);
    assert.deepEqual(effective.source, food.source);
    assert.deepEqual(effective.names, food.names);
    assert.equal(effective.source_note, food.source_note);
    for (const [code, original] of Object.entries(food.nutrition_profiles[0].nutrients)) {
      const corrected = effective.nutrition_profiles[0].nutrients[code];
      if (corrected.correction_id) {
        assert.deepEqual(journal.get(corrected.correction_id).original, original);
        for (const key of ["source_value", "source_type", "source_origin", "source_ref"]) assert.equal(corrected[key], original[key]);
      } else assert.deepEqual(corrected, original);
      compared++;
    }
  }
  assert.equal(compared, 985320);
  for (let i = 0; i < raw.nutrients.length; i++) assert.deepEqual(source.nutrients[i].source_fields, raw.nutrients[i].source_fields);
  for (const ref of raw.references) assert.deepEqual(source.references.find((item) => item.id === ref.id), ref);
  const manifest = JSON.parse(await readFile(join(blsRoot, "manifest.json")));
  assert.equal(manifest.original_counts.qualifiers.missing, 110142);
  assert.equal(manifest.original_counts.references, 2164);
  const fattyAcids = raw.nutrients.filter((component) => component.source_fields["Component group"] === "Fatty acids").map((component) => component.source_code);
  assert.equal(fattyAcids.length, 36);
  assert.deepEqual(source.knownIssues.issues.find((issue) => issue.id.endsWith("anchovy_fat_energy")).component_codes, ["FAT", "ENERCJ", "ENERCC", ...fattyAcids]);
  const byIssue = Object.groupBy(source.corrections.filter((entry) => entry.kind === "measurement"), (entry) => entry.issue_id);
  assert.deepEqual(Object.values(byIssue).map((entries) => entries.length).sort((a, b) => a - b), [6, 21, 22, 53, 118, 134, 663, 822]);
  assert.equal(blsSource.license.id, "CC-BY-4.0");
  await downloadBlsSource(join(blsRoot, "source"), () => { throw new Error("No network in CI"); });
  const bad = await mkdtemp(join(tmpdir(), "gymnasia-bls-bad-"));
  try { await writeFile(join(bad, blsSource.files[0].name), "changed"); await assert.rejects(() => loadBlsSource(bad), /SHA-256/); }
  finally { await rm(bad, { recursive: true, force: true }); }
  const temp = await temporary(t);
  const preload = join(temp, "no-network.mjs");
  await writeFile(preload, 'globalThis.fetch = () => { throw new Error("Unexpected network in BLS check"); };\n');
  const result = JSON.parse(execFileSync(process.execPath, ["--import", preload, join(blsRoot, "../../scripts/catalogs/import-bls.mjs"), "--check"], { encoding: "utf8", timeout: 120000 }));
  assert.deepEqual(result.counts, counts);
});
