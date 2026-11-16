import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseBlsValue } from "./bls-values.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const interpreted = (measurement) => Object.fromEntries(["value", "qualifier", "limit"].filter((key) => Object.hasOwn(measurement, key)).map((key) => [key, measurement[key]]));
const exact = (value) => ["reported", "logical_zero"].includes(value.qualifier) && typeof value.value === "number" && Number.isFinite(value.value);

// Decimal arithmetic on the shortest round-trip representation of published XLSX
// numbers. Does not treat Excel binary serialization tails as scientific precision.
function decimalParts(value) {
  assert.ok(typeof value === "number" && Number.isFinite(value), "Entrada decimal BLS no finita");
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(value));
  assert.ok(match, "Entrada decimal BLS inválida");
  let scale = (match[3]?.length ?? 0) - Number(match[4] ?? 0);
  assert.ok(Math.abs(scale) <= 400, "Escala decimal BLS excesiva");
  let integer = BigInt(`${match[1]}${match[2]}${match[3] ?? ""}`);
  if (scale < 0) { integer *= 10n ** BigInt(-scale); scale = 0; }
  return { integer, scale };
}

export function subtractBlsEnergyTerm(energy, oligosaccharides, coefficient) {
  assert.ok(Number.isSafeInteger(coefficient) && coefficient > 0, "Coeficiente BLS inválido");
  const a = decimalParts(energy);
  const b = decimalParts(oligosaccharides);
  const scale = Math.max(a.scale, b.scale);
  const integer = a.integer * 10n ** BigInt(scale - a.scale) - BigInt(coefficient) * b.integer * 10n ** BigInt(scale - b.scale);
  assert.ok(integer >= 0n, "La corrección BLS produciría energía negativa");
  let text = integer.toString().padStart(scale + 1, "0");
  if (scale) text = `${text.slice(0, -scale)}.${text.slice(-scale)}`.replace(/0+$/, "").replace(/\.$/, "");
  const value = Number(text);
  assert.ok(Number.isFinite(value), "Resultado energético BLS no finito");
  return { value, text };
}

function evidence(plan, rule, extra = {}) {
  return { document_url: plan.document.url, document_sha256: plan.document.sha256, edition: plan.document.edition, section: rule.section, pdf_pages: rule.pdf_pages, printed_pages: rule.printed_pages, ...(rule.table ? { table: rule.table } : {}), ...extra };
}

function restoreOriginal(catalog) {
  assert.ok(catalog.errataApplication && Array.isArray(catalog.corrections), "Falta el diario de correcciones BLS");
  const entries = new Map(catalog.corrections.map((entry) => [entry.id, entry]));
  assert.equal(entries.size, catalog.corrections.length, "Correcciones BLS duplicadas");
  const foods = catalog.foods.map((food) => {
    const { errata_profile_id, errata_status, correction_ids, ...originalFood } = food;
    assert.equal(errata_profile_id, catalog.errataApplication.profile_id, "Perfil BLS incoherente");
    const nutrients = {};
    for (const [id, value] of Object.entries(food.nutrition_profiles[0].nutrients)) {
      if (!value.correction_id) { nutrients[id] = value; continue; }
      const entry = entries.get(value.correction_id);
      assert.ok(entry?.kind === "measurement" && entry.food_id === food.id && entry.component_id === id, "Enlace de corrección BLS roto");
      for (const key of ["source_value", "source_type", "source_origin", "source_ref"]) assert.equal(value[key], entry.original[key], `Original BLS alterado: ${food.id}/${id}/${key}`);
      assert.deepEqual(interpreted(entry.original), parseBlsValue(entry.original.source_value, entry.original.source_origin), "Interpretación original BLS alterada");
      nutrients[id] = entry.original;
    }
    return { ...originalFood, schema_version: 1, nutrition_profiles: [{ ...food.nutrition_profiles[0], nutrients }] };
  });
  const nutrients = catalog.nutrients.map((component) => {
    const { effective_formula, formula_correction_id, ...original } = component;
    if (formula_correction_id) {
      const entry = entries.get(formula_correction_id);
      assert.ok(entry?.kind === "component_formula" && entry.component_id === component.id, "Enlace de fórmula BLS roto");
      assert.equal(entry.original, original.source_fields["Formeln / Formula"], "Fórmula original BLS alterada");
    }
    return original;
  });
  const added = new Set(catalog.errataApplication.added_reference_ids);
  return { foods, nutrients, references: catalog.references.filter((reference) => !added.has(reference.id)), knownIssues: catalog.knownIssues };
}

function projectOriginal(catalog, plan) {
  assert.equal(plan.schema_version, 1);
  assert.equal(plan.dataset_id, catalog.knownIssues.dataset_id, "Plan BLS de otra fuente");
  assert.equal(plan.document.sha256, catalog.knownIssues.source_sha256, "Documento de erratas BLS distinto");
  assert.equal(plan.document.edition, catalog.knownIssues.edition, "Edición de erratas BLS distinta");
  assert.ok(!catalog.corrections && !catalog.errataApplication, "No aplicar correcciones BLS sobre una proyección sin restaurar");
  const foods = new Map(catalog.foods.map((food) => [food.source.food_code, {
    ...food, schema_version: 2, errata_profile_id: plan.profile_id, errata_status: "unaffected", correction_ids: [],
    nutrition_profiles: [{ ...food.nutrition_profiles[0], nutrients: { ...food.nutrition_profiles[0].nutrients } }],
  }]));
  const components = new Map(catalog.nutrients.map((component) => [component.source_code, { ...component }]));
  const issues = new Map(catalog.knownIssues.issues.map((issue) => [issue.id, issue]));
  const corrections = new Map();
  const reference = { id: `bls-ref-${hash(plan.document.citation)}`, source_text: plan.document.citation, citation: plan.document.citation };
  assert.ok(!catalog.references.some((item) => item.id === reference.id), "La referencia del erratum ya existe en la fuente original");

  function change(foodCode, componentCode, rule, result, detail) {
    const food = foods.get(foodCode);
    const component = components.get(componentCode);
    assert.ok(food && component, "Destino de corrección BLS inexistente");
    const original = food.nutrition_profiles[0].nutrients[component.id];
    assert.ok(original && !original.correction_id, "Corrección BLS duplicada o encadenada sin política explícita");
    assert.deepEqual(interpreted(original), parseBlsValue(original.source_value, original.source_origin), "Original BLS no corresponde a su texto");
    const id = `bls-correction-${foodCode}-${componentCode}`;
    const effective = { ...result, effective_ref: reference.id };
    const entry = { id, kind: "measurement", food_id: food.id, component_id: component.id, unit: component.unit, issue_id: rule.issue_id, evidence: evidence(plan, rule, detail.bibliography_numbers ? { bibliography_numbers: detail.bibliography_numbers } : {}), original: { ...original }, result: effective, ...detail };
    corrections.set(id, entry);
    const { value, qualifier, limit, ...sourceFields } = original;
    food.nutrition_profiles[0].nutrients[component.id] = { ...sourceFields, ...effective, correction_id: id };
    food.correction_ids.push(id);
  }

  for (const rule of plan.rules) {
    assert.ok(["replacement_with_pending", "missing_marker", "energy_term_removal", "phenylalanine_invalidation", "pending_invalidation"].includes(rule.kind), "Tipo de corrección BLS desconocido");
    const issue = issues.get(rule.issue_id);
    assert.ok(issue, "Regla de corrección BLS sin afectación documentada");
    assert.equal(issue.food_codes.length, rule.expected_food_count, "Lista BLS de afectados modificada");
    const replacementKeys = new Set();
    for (const replacement of rule.replacements ?? []) {
      assert.ok(issue.food_codes.includes(replacement.food_code) && issue.component_codes.includes(replacement.component_code), "Sustitución BLS fuera del alcance del erratum");
      const component = components.get(replacement.component_code);
      assert.equal(component?.unit, replacement.unit, "Unidad de sustitución BLS distinta");
      const original = foods.get(replacement.food_code).nutrition_profiles[0].nutrients[component.id];
      if (replacement.expected_original === null) assert.equal(original.source_value, null, "La celda BLS ya no está vacía");
      else assert.ok(exact(original) && original.value === replacement.expected_original, `Valor BLS previo distinto: ${replacement.food_code}/${replacement.component_code}: ${original.value} (${original.qualifier}), esperado ${replacement.expected_original}`);
      const parsed = parseBlsValue(replacement.text, replacement.origin);
      change(replacement.food_code, replacement.component_code, rule, { ...parsed, effective_source_value: replacement.text, effective_origin: replacement.origin }, { status: "applied", method: "official_table_replacement", bibliography_numbers: replacement.bibliography_numbers ?? [], replacement_citation: replacement.citation ?? null, ...(replacement.original_displayed_in_erratum ? { original_displayed_in_erratum: replacement.original_displayed_in_erratum } : {}) });
      replacementKeys.add(`${replacement.food_code}/${replacement.component_code}`);
    }
    for (const foodCode of issue.food_codes) for (const componentCode of issue.component_codes) {
      if (replacementKeys.has(`${foodCode}/${componentCode}`)) continue;
      if (rule.kind === "missing_marker") {
        const original = foods.get(foodCode).nutrition_profiles[0].nutrients[`bls-${componentCode}`];
        assert.equal(original.source_value, null, "La celda BLS que se normaliza ya no está vacía");
        change(foodCode, componentCode, rule, { value: null, qualifier: "missing", effective_source_value: "-", effective_origin: "-" }, { status: "applied", method: "official_missing_marker" });
      } else if (rule.kind === "energy_term_removal") {
        const original = foods.get(foodCode).nutrition_profiles[0].nutrients[`bls-${componentCode}`];
        const olsac = foods.get(foodCode).nutrition_profiles[0].nutrients["bls-OLSAC"];
        const definition = rule.components[componentCode];
        assert.ok(definition && components.get(componentCode).unit === definition.unit && components.get("OLSAC").unit === "g", "Unidad energética BLS incompatible");
        if (exact(original) && exact(olsac) && olsac.value > 0) {
          const calculated = subtractBlsEnergyTerm(original.value, olsac.value, definition.coefficient);
          change(foodCode, componentCode, rule, { value: calculated.value, qualifier: "recomputed", effective_source_value: calculated.text, effective_origin: "Formelberechnung" }, {
            status: "derived", method: "remove_duplicate_oligosaccharide_term",
            calculation: { expression: `published_energy - ${definition.coefficient} * published_OLSAC`, coefficient: definition.coefficient, energy_unit: definition.unit, olsac_unit: "g", inputs: { published_energy: { canonical_decimal: String(original.value), ...original }, published_OLSAC: { canonical_decimal: String(olsac.value), ...olsac } }, decimal_result: calculated.text, precision: plan.energy_precision_policy },
          });
        } else change(foodCode, componentCode, rule, { value: null, qualifier: "invalidated_by_erratum", effective_source_value: null, effective_origin: null }, { status: "pending", method: "invalidate_until_energy_inputs_known", pending_reason: "La energía publicada o los oligosacáridos no tienen cantidad exacta; no se sustituyen límites o trazas por cero." });
      } else {
        assert.ok(rule.pending_reason, "Falta una política BLS para el valor afectado");
        const original = foods.get(foodCode).nutrition_profiles[0].nutrients[`bls-${componentCode}`];
        if (rule.kind === "phenylalanine_invalidation") assert.equal(original.value, 0, "El cero aparente BLS ya no coincide con el erratum");
        change(foodCode, componentCode, rule, { value: null, qualifier: "invalidated_by_erratum", effective_source_value: null, effective_origin: null }, { status: "pending", method: "invalidate_pending_official_recalculation", pending_reason: rule.pending_reason, ...(rule.component_scope ? { component_scope: rule.component_scope } : {}), ...(rule.guidance ? { guidance: rule.guidance } : {}) });
      }
    }
    if (rule.kind === "energy_term_removal") for (const [code, definition] of Object.entries(rule.components)) {
      const component = components.get(code);
      const id = `bls-correction-formula-${code}`;
      corrections.set(id, { id, kind: "component_formula", component_id: component.id, issue_id: rule.issue_id, status: "applied", method: "official_formula_replacement", evidence: evidence(plan, rule), original: component.source_fields["Formeln / Formula"], result: definition.formula });
      component.effective_formula = definition.formula;
      component.formula_correction_id = id;
    }
  }
  assert.deepEqual([...new Set(plan.rules.map((rule) => rule.issue_id))].sort(), [...issues.keys()].sort(), "El plan BLS no cubre todas las erratas");
  for (const food of foods.values()) {
    food.correction_ids.sort(compare);
    const statuses = food.correction_ids.map((id) => corrections.get(id).status);
    food.errata_status = !statuses.length ? "unaffected" : statuses.every((status) => status === "pending") ? "pending" : statuses.includes("pending") ? "partial" : "corrected";
  }
  const journal = [...corrections.values()].sort((a, b) => compare(a.id, b.id));
  const counts = { applied: 0, derived: 0, pending: 0, measurement_changes: 0, formula_changes: 0 };
  for (const entry of journal) { counts[entry.status]++; counts[entry.kind === "measurement" ? "measurement_changes" : "formula_changes"]++; }
  return {
    foods: [...foods.values()].sort((a, b) => compare(a.id, b.id)), nutrients: [...components.values()], references: [...catalog.references, reference].sort((a, b) => compare(a.id, b.id)), knownIssues: catalog.knownIssues, corrections: journal,
    errataApplication: { profile_id: plan.profile_id, plan_sha256: hash(`${JSON.stringify(plan, null, 2)}\n`), document_sha256: plan.document.sha256, status: "applied_with_explicit_pending_values", counts, added_reference_ids: [reference.id], original_reference_count: catalog.references.length, remaining_scope: plan.remaining_scope, not_an_official_bls_4_1_release: true },
  };
}

export function applyBlsErrata(catalog, plan) {
  if (!catalog.errataApplication) return projectOriginal(catalog, plan);
  const expected = projectOriginal(restoreOriginal(catalog), plan);
  assert.deepEqual(catalog.errataApplication, expected.errataApplication, "Metadatos de correcciones BLS alterados");
  assert.deepEqual(catalog.corrections, expected.corrections, "Diario de correcciones BLS alterado");
  assert.deepEqual(catalog.nutrients, expected.nutrients, "Fórmulas corregidas BLS alteradas");
  assert.deepEqual(catalog.references, expected.references, "Referencias corregidas BLS alteradas");
  assert.equal(catalog.foods.length, expected.foods.length, "Fichas corregidas BLS ausentes");
  for (let i = 0; i < expected.foods.length; i++) assert.deepEqual(catalog.foods[i], expected.foods[i], `Proyección corregida BLS alterada: ${expected.foods[i].id}`);
  return { ...expected, ...(catalog.errataPlan ? { errataPlan: plan } : {}) };
}

export function validateBlsErrata(catalog, plan) {
  assert.ok(catalog.errataApplication, "Falta el perfil de erratas BLS");
  applyBlsErrata(catalog, plan);
}
