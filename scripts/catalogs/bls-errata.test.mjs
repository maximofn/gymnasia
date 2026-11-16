import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import fc from "fast-check";
import { applyBlsErrata, subtractBlsEnergyTerm, validateBlsErrata } from "./bls-errata.mjs";
import { parseBlsValue } from "./bls-values.mjs";

const officialPlan = JSON.parse(await readFile(new URL("./bls-errata-plan.json", import.meta.url)));
const officialIssues = JSON.parse(await readFile(new URL("./bls-known-issues.json", import.meta.url)));
const values = (food) => food.nutrition_profiles[0].nutrients;
function fixture(suffix, count = 2) {
  const rule = structuredClone(officialPlan.rules.find((item) => item.issue_id.endsWith(suffix)));
  const issue = structuredClone(officialIssues.issues.find((item) => item.id === rule.issue_id));
  issue.food_codes = issue.food_codes.slice(0, count);
  rule.expected_food_count = issue.food_codes.length;
  if (rule.replacements) rule.replacements = rule.replacements.filter((item) => issue.food_codes.includes(item.food_code));
  const componentCodes = [...new Set([...issue.component_codes, ...(rule.kind === "energy_term_removal" ? ["OLSAC"] : [])])];
  const nutrients = componentCodes.map((code) => ({ id: `bls-${code}`, source_code: code, unit: rule.replacements?.find((item) => item.component_code === code)?.unit ?? rule.components?.[code]?.unit ?? "g", source_fields: { "Formeln / Formula": code.startsWith("ENER") ? "original formula including OLSAC" : null } }));
  const foods = issue.food_codes.map((code) => ({ schema_version: 1, id: `bls-${code}`, source: { food_code: code }, source_warning_ids: [issue.id], nutrition_profiles: [{ nutrients: Object.fromEntries(nutrients.map((component) => {
    const replacement = rule.replacements?.find((item) => item.food_code === code && item.component_code === component.source_code);
    const number = replacement ? replacement.expected_original : rule.kind === "phenylalanine_invalidation" ? 0 : rule.kind === "missing_marker" ? null : component.source_code === "OLSAC" ? .1 : component.source_code === "ENERCC" ? 25 : 100;
    const raw = number === null ? null : String(number);
    return [component.id, { ...parseBlsValue(raw, "Analyse"), source_value: raw, source_type: raw === null ? null : "n", source_origin: "Analyse", source_ref: null }];
  })) }] }));
  const plan = { ...structuredClone(officialPlan), rules: [rule] };
  const catalog = { foods, nutrients, references: [], knownIssues: { ...officialIssues, issues: [issue] } };
  return { catalog, plan, rule, issue };
}

test("tablas oficiales: sustituir cantidades preserva el original completo y la evidencia", () => {
  const { catalog, plan } = fixture("milk_retinol", 1);
  const before = structuredClone(catalog);
  const corrected = applyBlsErrata(catalog, plan);
  assert.deepEqual(catalog, before);
  assert.equal(values(corrected.foods[0])["bls-RETOL"].value, 2.4);
  assert.equal(values(corrected.foods[0])["bls-VITA"].value, 3.1);
  assert.equal(values(corrected.foods[0])["bls-VITAA"].value, 2.7);
  const entry = corrected.corrections.find((item) => item.component_id === "bls-RETOL");
  assert.deepEqual(entry.original, values(before.foods[0])["bls-RETOL"]);
  assert.equal(entry.original.value, 414);
  assert.equal(entry.result.effective_origin, "Literatur");
  assert.deepEqual(entry.evidence.bibliography_numbers, ["2"]);
  assert.equal(entry.evidence.table, "1");
  assert.equal(entry.evidence.document_sha256, officialPlan.document.sha256);
  assert.ok(entry.evidence.pdf_pages.includes(5));
  assert.equal(corrected.references.find((item) => item.id === entry.result.effective_ref).citation, plan.document.citation);
});

test("yodo y calcio: ocho cantidades oficiales, incluido el original Excel sin redondear", () => {
  for (const suffix of ["milk_iodine", "almond_calcium"]) {
    const { catalog, plan, rule } = fixture(suffix, 3);
    const corrected = applyBlsErrata(catalog, plan);
    for (const replacement of rule.replacements) {
      const entry = corrected.corrections.find((item) => item.food_id === `bls-${replacement.food_code}` && item.component_id === `bls-${replacement.component_code}`);
      assert.equal(entry.result.value, Number(replacement.text.replace(",", ".")));
      assert.equal(entry.unit, replacement.unit);
      assert.equal(entry.original.value, replacement.expected_original);
      if (suffix === "almond_calcium") { assert.equal(entry.original.value, 84.864); assert.equal(entry.original_displayed_in_erratum, "84.9"); }
    }
  }
});

test("zinc: marcadores ausentes y límites simbólicos nunca se convierten en cero", () => {
  for (const suffix of ["zinc_missing", "zinc_limits"]) {
    const { catalog, plan } = fixture(suffix, 60);
    const corrected = applyBlsErrata(catalog, plan);
    assert.equal(corrected.corrections.length, suffix === "zinc_missing" ? 53 : 6);
    for (const entry of corrected.corrections) {
      assert.equal(entry.original.source_value, null);
      assert.equal(entry.result.value, null);
      assert.equal(entry.status, "applied");
      assert.equal(Object.hasOwn(entry.result, "limit"), false);
    }
    if (suffix === "zinc_limits") {
      assert.equal(corrected.corrections.filter((item) => item.result.qualifier === "below_detection").length, 1);
      assert.equal(corrected.corrections.filter((item) => item.result.qualifier === "below_quantification").length, 5);
    } else assert.ok(corrected.corrections.every((item) => item.result.effective_source_value === "-"));
  }
});

test("energía: retira el término duplicado, registra insumos y conserva las fórmulas originales", () => {
  const { catalog, plan } = fixture("oligosaccharide_energy");
  const corrected = applyBlsErrata(catalog, plan);
  assert.equal(values(corrected.foods[0])["bls-ENERCJ"].value, 99.2);
  assert.equal(values(corrected.foods[0])["bls-ENERCC"].value, 24.8);
  assert.equal(values(corrected.foods[0])["bls-OLSAC"].value, .1);
  assert.deepEqual(corrected.errataApplication.counts, { applied: 2, derived: 4, pending: 0, measurement_changes: 4, formula_changes: 2 });
  for (const entry of corrected.corrections.filter((item) => item.kind === "measurement")) {
    assert.equal(entry.result.qualifier, "recomputed");
    assert.equal(entry.calculation.inputs.published_OLSAC.value, .1);
    assert.equal(entry.calculation.precision, plan.energy_precision_policy);
  }
  for (const component of corrected.nutrients.filter((item) => item.source_code.startsWith("ENER"))) {
    assert.match(component.source_fields["Formeln / Formula"], /OLSAC/);
    assert.doesNotMatch(component.effective_formula, /OLSAC/);
  }
  assert.deepEqual(applyBlsErrata(corrected, plan), corrected); // Never subtract twice.
});

test("energía: cantidades desconocidas bloquean la derivación sin imputar cero", () => {
  for (const raw of ["TR", "<LOQ", "-", "<0.2"]) {
    const { catalog, plan } = fixture("oligosaccharide_energy", 1);
    values(catalog.foods[0])["bls-OLSAC"] = { ...values(catalog.foods[0])["bls-OLSAC"], ...parseBlsValue(raw, "Analyse"), source_value: raw };
    const result = applyBlsErrata(catalog, plan);
    for (const entry of result.corrections.filter((item) => item.kind === "measurement")) { assert.equal(entry.result.value, null); assert.equal(entry.status, "pending"); }
  }
  const { catalog, plan } = fixture("oligosaccharide_energy", 1);
  const original = values(catalog.foods[0])["bls-ENERCJ"];
  values(catalog.foods[0])["bls-ENERCJ"] = { ...original, ...parseBlsValue("-", "Analyse"), source_value: "-" };
  const corrected = applyBlsErrata(catalog, plan);
  assert.equal(values(corrected.foods[0])["bls-ENERCJ"].qualifier, "invalidated_by_erratum");
  assert.equal(values(corrected.foods[0])["bls-ENERCC"].value, 24.8);
});

test("aritmética decimal: evita residuos binarios, soporta exponentes y rechaza entradas inválidas", () => {
  assert.deepEqual(subtractBlsEnergyTerm(.5, .1, 2), { value: .3, text: "0.3" });
  assert.deepEqual(subtractBlsEnergyTerm(3e-8, 1e-8, 2), { value: 1e-8, text: "0.00000001" });
  assert.equal(subtractBlsEnergyTerm(1e22, 1, 8).text, "9999999999999999999992");
  for (const args of [[1, 1, 8], [NaN, 1, 2], [1, Infinity, 2], [1, 0, 2.4]]) assert.throws(() => subtractBlsEnergyTerm(...args));
  fc.assert(fc.property(fc.integer({ min: 0, max: 100000 }), fc.integer({ min: 0, max: 100000 }), fc.constantFrom(2, 8), (base, olsac, coefficient) => {
    const expected = base / 100;
    assert.equal(subtractBlsEnergyTerm((base + olsac * coefficient) / 100, olsac / 100, coefficient).value, expected);
  }), { numRuns: 500 });
});

test("recetas, fenilalanina y grasa: invalida sin inventar sustitutos ni propagar un intervalo", () => {
  for (const suffix of ["milk_retinol", "milk_iodine", "almond_calcium", "phenylalanine_zero", "anchovy_fat_energy"]) {
    const { catalog, plan } = fixture(suffix, 4);
    const corrected = applyBlsErrata(catalog, plan);
    const pending = corrected.corrections.filter((item) => item.status === "pending");
    assert.ok(pending.length > 0);
    for (const entry of pending) {
      assert.equal(entry.result.value, null);
      assert.equal(entry.result.qualifier, "invalidated_by_erratum");
      assert.ok(entry.pending_reason);
      assert.equal(Object.hasOwn(entry.result, "limit"), false);
      if (suffix === "phenylalanine_zero") assert.equal(entry.original.value, 0);
      if (suffix === "anchovy_fat_energy") { assert.equal(entry.guidance.is_numeric_replacement, false); assert.equal(entry.guidance.applies_only_to_food, "T104100"); assert.match(entry.component_scope, /editorial/); }
    }
    if (suffix === "anchovy_fat_energy") assert.equal(pending.length, 4 * 39);
  }
});

test("rechaza desviaciones de alcance, unidad, original y reglas sin cobertura", () => {
  for (const mutate of [
    ({ plan }) => { plan.document.sha256 = "wrong"; },
    ({ plan }) => { plan.rules[0].kind = "unknown"; },
    ({ rule }) => { rule.expected_food_count++; },
    ({ rule }) => { rule.replacements[0].unit = "mg"; },
    ({ rule }) => { rule.replacements[0].expected_original = 413; },
    ({ rule }) => { rule.replacements.push(rule.replacements[0]); },
    ({ plan }) => { plan.rules = []; },
  ]) { const f = fixture("milk_retinol", 1); mutate(f); assert.throws(() => applyBlsErrata(f.catalog, f.plan)); }
});

test("la validación detecta manipulación de cantidades, evidencia, originales, enlaces y fórmulas", () => {
  for (const mutate of [
    (c) => { values(c.foods[0])["bls-ENERCC"].value++; },
    (c) => { values(c.foods[0])["bls-ENERCC"].source_value = "999"; },
    (c) => { c.corrections[0].evidence.pdf_pages = [999]; },
    (c) => { c.corrections[0].original.source_origin = "Literatur"; },
    (c) => { values(c.foods[0])["bls-ENERCC"].correction_id = "broken"; },
    (c) => { c.nutrients[0].effective_formula = "wrong"; },
    (c) => { c.corrections.pop(); },
    (c) => { c.foods[0].correction_ids = []; },
  ]) {
    const { catalog, plan } = fixture("oligosaccharide_energy");
    const corrected = applyBlsErrata(catalog, plan);
    mutate(corrected);
    assert.throws(() => validateBlsErrata(corrected, plan));
  }
});
