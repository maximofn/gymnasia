import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import fc from "fast-check";

import {
  checkCiqualArtifacts, ciqualRoot, ciqualSource, convertCiqualTables,
  createCiqualArtifacts, downloadCiqualSource, loadCiqualSource,
  parseCiqualValue, parseXmlTable, sha256, validateCiqualCatalog, writeCiqualArtifacts,
} from "./ciqual.mjs";

function fixture() {
  return {
    CONST: [
      { const_code: "327", const_nom_fr: "Énergie (kJ/100 g)", const_nom_eng: "Energy (kJ/100g)", code_INFOODS: "ENERC" },
      { const_code: "328", const_nom_fr: "Énergie (kcal/100 g)", const_nom_eng: "Energy (kcal/100g)", code_INFOODS: "ENERC" },
    ],
    ALIM_GRP: [{
      alim_grp_code: "02", alim_grp_nom_fr: "fruits", alim_grp_nom_eng: "fruits",
      alim_ssgrp_code: "0202", alim_ssgrp_nom_fr: "frais", alim_ssgrp_nom_eng: "fresh",
      alim_ssssgrp_code: "000000", alim_ssssgrp_nom_fr: "-", alim_ssssgrp_nom_eng: "-",
    }],
    SOURCES: [{ source_code: "1", ref_citation: "Étude & enquête" }],
    ALIM: [{
      alim_code: "123", alim_nom_fr: "Pomme, pulpe", alim_nom_eng: "Apple, flesh",
      alim_nom_sci: "Malus domestica", alim_grp_code: "02", alim_ssgrp_code: "0202",
      alim_ssssgrp_code: "000000", facteur_Jones: "6.25",
    }],
    COMPO: [
      { alim_code: "123", const_code: "327", teneur: "250", min: "1E-6", max: "270", code_confiance: "B", source_code: "1" },
      { alim_code: "123", const_code: "328", teneur: "< 60,5", min: "", max: "", code_confiance: "C", source_code: "1" },
    ],
  };
}

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), "gymnasia-ciqual-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("CIQUAL conserva ceros, trazas, desconocidos, límites, comas y exponentes", () => {
  assert.deepEqual(parseCiqualValue("0"), { value: 0, qualifier: "reported", source_value: "0" });
  assert.deepEqual(parseCiqualValue("-"), { value: null, qualifier: "missing", source_value: "-" });
  assert.deepEqual(parseCiqualValue("traces"), { value: null, qualifier: "trace", source_value: "traces" });
  assert.deepEqual(parseCiqualValue("< 0,001"), { value: null, qualifier: "less_than", limit: 0.001, source_value: "< 0,001" });
  assert.equal(parseCiqualValue("1E-6").value, 0.000001);
  for (const raw of ["NaN", "Infinity", "-2", "12 kcal", "1,2,3", "1.2junk", "1e999", null, undefined]) {
    assert.throws(() => parseCiqualValue(raw));
  }
});

test("CIQUAL parsea XML real, BOM, entidades, CDATA y campos ausentes", () => {
  const rows = parseXmlTable('\uFEFF<?xml version="1.0"?><TABLE><ALIM><code> 02 </code><name>Pain &amp; beurre &apos;A&apos;</name><notes><![CDATA[a < b]]></notes><absent missing=" " /></ALIM></TABLE>', "ALIM");
  assert.deepEqual(rows, [{ code: "02", name: "Pain & beurre 'A'", notes: "a < b", absent: "" }]);
  for (const xml of ["<TABLE>", "<HTML/>", "<TABLE/>", "<TABLE><OTHER/></TABLE>", "<!DOCTYPE TABLE><TABLE><ALIM/></TABLE>", "<TABLE><ALIM><a>1</a><a>2</a></ALIM></TABLE>"]) {
    assert.throws(() => parseXmlTable(xml, "ALIM"));
  }
});

test("CIQUAL conserva IDs, jerarquía, variantes INFOODS y procedencia por componente", () => {
  const catalog = convertCiqualTables(fixture());
  const food = catalog.foods[0];
  assert.equal(food.id, "ciqual-123");
  assert.deepEqual(food.category_ids, ["ciqual-02", "ciqual-0202"]);
  assert.equal(catalog.groups[1].parent_id, "ciqual-02");
  assert.equal(food.nitrogen_to_protein_factor, 6.25);
  assert.equal(catalog.nutrients.length, 2);
  assert.equal(catalog.nutrients[0].infoods_code, catalog.nutrients[1].infoods_code);
  assert.equal(catalog.nutrients[0].unit, "kJ");
  assert.equal(catalog.nutrients[1].unit, "kcal");
  const values = food.nutrition_profiles[0].nutrients;
  assert.equal(values["ciqual-327"].minimum, 0.000001);
  assert.equal(values["ciqual-327"].source_minimum, "1E-6");
  assert.equal(values["ciqual-328"].value, null);
  assert.equal(values["ciqual-328"].limit, 60.5);
  assert.equal(values["ciqual-328"].source_ref, "1");
  assert.equal(values["ciqual-328"].confidence_code, "C");
});

test("CIQUAL admite la clasificación ausente sin inventarla y conserva la errata de vitamina A", () => {
  const tables = fixture();
  Object.assign(tables.ALIM[0], { alim_grp_code: "00", alim_ssgrp_code: "0000" });
  Object.assign(tables.CONST[0], {
    const_nom_fr: "Activité vitaminique A, équivalents rétinol (µg/100 g)",
    const_nom_eng: "Vitamin A activity, retinol equivalent (µg/100mg)",
  });
  const catalog = convertCiqualTables(tables);
  assert.deepEqual(catalog.foods[0].category_ids, []);
  assert.equal(catalog.nutrients[0].unit, "ug");
  assert.match(catalog.nutrients[0].names.en, /100mg/);
});

test("CIQUAL rechaza referencias rotas, duplicados, pérdida de componentes y confianza desconocida", () => {
  const mutations = [
    (tables) => { tables.COMPO[0].alim_code = "999"; },
    (tables) => { tables.COMPO[0].const_code = "999"; },
    (tables) => { tables.COMPO[0].source_code = "999"; },
    (tables) => { tables.ALIM[0].alim_grp_code = "99"; },
    (tables) => { tables.COMPO.push(tables.COMPO[0]); },
    (tables) => { tables.CONST.push(tables.CONST[0]); },
    (tables) => { tables.ALIM.push(tables.ALIM[0]); },
    (tables) => { tables.SOURCES.push(tables.SOURCES[0]); },
    (tables) => { tables.COMPO.pop(); },
    (tables) => { tables.COMPO[0].code_confiance = "excellent"; },
  ];
  for (const mutate of mutations) {
    const tables = fixture();
    mutate(tables);
    assert.throws(() => convertCiqualTables(tables));
  }
});

test("CIQUAL impide confundir un límite con un valor exacto o alterar sus extremos", () => {
  for (const mutate of [
    (value) => { value.value = 60.5; },
    (value) => { value.limit = 61; },
    (value) => { value.qualifier = "reported"; },
    (value) => { value.minimum = 0; value.source_minimum = "1"; },
  ]) {
    const catalog = convertCiqualTables(fixture());
    mutate(catalog.foods[0].nutrition_profiles[0].nutrients["ciqual-328"]);
    assert.throws(() => validateCiqualCatalog(catalog));
  }
});

test("CIQUAL genera agregados, índices y SHA-256 deterministas", async (t) => {
  const catalog = convertCiqualTables(fixture());
  const artifacts = createCiqualArtifacts(catalog);
  assert.deepEqual(createCiqualArtifacts(catalog), artifacts);
  assert.deepEqual(JSON.parse(artifacts.get("all.json")), catalog.foods);
  const manifest = JSON.parse(artifacts.get("manifest.json"));
  assert.equal(manifest.counts.measurements, 2);
  assert.equal(manifest.files["foods/ciqual-123.json"].sha256, sha256(artifacts.get("foods/ciqual-123.json")));
  const directory = await temporary(t);
  await writeCiqualArtifacts(catalog, directory);
  assert.equal(await readFile(join(directory, "foods/ciqual-123.json"), "utf8"), artifacts.get("foods/ciqual-123.json"));
  await writeFile(join(directory, "foods/personal.json"), "{}\n");
  await assert.rejects(() => writeCiqualArtifacts(catalog, directory), /ajenas/);
  assert.equal(await readFile(join(directory, "foods/personal.json"), "utf8"), "{}\n");
});

test("CIQUAL rechaza bytes distintos antes de parsear o publicar la fuente", async (t) => {
  const directory = await temporary(t);
  await writeFile(join(directory, ciqualSource.files[0].name), "<TABLE/>");
  await assert.rejects(() => loadCiqualSource(directory), /SHA-256/);
  await assert.rejects(() => downloadCiqualSource(directory, async () => ({
    ok: true, arrayBuffer: async () => Buffer.from("<TABLE/>"),
  })), /SHA-256/);
  assert.equal(await readFile(join(directory, ciqualSource.files[0].name), "utf8"), "<TABLE/>");
  const empty = await temporary(t);
  await assert.rejects(() => downloadCiqualSource(empty, async () => ({ ok: false, status: 503 })), /HTTP 503/);
});

test("CIQUAL conserva decimales y nunca convierte límites en cantidades: propiedades", () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 1000000 }), fc.integer({ min: 0, max: 6 }), (integer, decimals) => {
    const text = (integer / 10 ** decimals).toFixed(decimals).replace(".", ",");
    assert.equal(parseCiqualValue(text).value, Number(text.replace(",", ".")));
    const bound = parseCiqualValue(`< ${text}`);
    assert.equal(bound.value, null);
    assert.equal(bound.limit, Number(text.replace(",", ".")));
  }), { numRuns: 500 });
});

test("la entrega CIQUAL completa pasa el contrato y conserva las cifras de la publicación", async () => {
  const counts = await checkCiqualArtifacts();
  assert.deepEqual(counts, {
    foods: 3484, nutrients: 74, groups: 161, references: 1978, measurements: 257816,
    qualifiers: { reported: 151981, less_than: 20075, trace: 2514, missing: 83246 },
  });
  const root = ciqualRoot;
  const food = JSON.parse(await readFile(join(root, "foods/ciqual-24999.json"), "utf8"));
  assert.deepEqual(food.category_ids, []);
  assert.equal(food.names.en, "Dessert (average)");
});
