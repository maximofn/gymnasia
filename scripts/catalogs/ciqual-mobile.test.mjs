import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import fc from "fast-check";
import { ciqualMobileRoles, createCiqualMobileArtifact, projectCiqualForMobile } from "./ciqual-mobile.mjs";

test("la proyección móvil conserva todos los IDs, traducciones y valores exactos o calificados", async () => {
  const original = JSON.parse(await readFile(new URL("../../alimentos/ciqual/all.json", import.meta.url), "utf8"));
  const expected = await createCiqualMobileArtifact(new URL("../../", import.meta.url).pathname);
  assert.equal(await readFile(new URL("../../apps/mobile/catalogs/generated/ciqualBaseline.generated.json", import.meta.url), "utf8"), expected);
  const projected = JSON.parse(expected).foods;
  assert.equal(projected.length, 3484);
  for (const [index, food] of projected.entries()) {
    const source = original[index];
    assert.equal(food.id, source.id);
    assert.equal(food.name, source.names.es);
    assert.equal(food.sourceId, "anses_ciqual_2025");
    assert.equal(food.serving_size_g, null);
    assert.equal(food.image, undefined);
    for (const [field, id] of Object.entries(ciqualMobileRoles)) {
      const nutrient = source.nutrition_profiles[0].nutrients[id];
      assert.equal(food[field], nutrient.qualifier === "reported" ? nutrient.value : null);
      assert.equal(food.ciqual.qualifiers[field].qualifier, nutrient.qualifier);
      if (nutrient.qualifier === "less_than") assert.equal(food.ciqual.qualifiers[field].limit, nutrient.limit);
    }
  }
});

test("los desconocidos, trazas y límites jamás se convierten en ceros: propiedades", () => {
  fc.assert(fc.property(fc.constantFrom("reported", "less_than", "trace", "missing"), fc.double({ min: 0, max: 1000, noNaN: true }), (qualifier, value) => {
    const nutrient = { qualifier, value: qualifier === "reported" ? value : null, limit: value };
    const food = { id: "ciqual-1", names: { es: "Alimento", fr: "Aliment", en: "Food" }, category_ids: [], nutrition_profiles: [{ basis: { amount: 100, unit: "g" }, nutrients: Object.fromEntries(Object.values(ciqualMobileRoles).map((id) => [id, nutrient])) }] };
    const [result] = projectCiqualForMobile([food], []);
    for (const field of Object.keys(ciqualMobileRoles)) assert.equal(result[field], qualifier === "reported" ? value : null);
  }), { numRuns: 300 });
});
