import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ciqualMobileRoles = {
  calories_per_100g: "ciqual-328",
  protein_per_100g: "ciqual-25000",
  carbs_per_100g: "ciqual-31000",
  fat_per_100g: "ciqual-40000",
  fiber_per_100g: "ciqual-34100",
};

export function projectCiqualForMobile(foods, groups) {
  const categories = new Map(groups.map((group) => [group.id, group.names.es]));
  return foods.map((food) => {
    assert.ok(food.names.es?.trim(), `Falta traducción de ${food.id}`);
    const profile = food.nutrition_profiles[0];
    assert.equal(profile.basis.amount, 100);
    assert.equal(profile.basis.unit, "g");
    const values = {};
    const qualifiers = {};
    for (const [field, id] of Object.entries(ciqualMobileRoles)) {
      const nutrient = profile.nutrients[id];
      assert.ok(nutrient, `Falta ${id} en ${food.id}`);
      assert.ok(["reported", "less_than", "trace", "missing"].includes(nutrient.qualifier));
      values[field] = nutrient.qualifier === "reported" ? nutrient.value : null;
      if (nutrient.qualifier === "reported") assert.ok(Number.isFinite(nutrient.value) && nutrient.value >= 0);
      qualifiers[field] = {
        qualifier: nutrient.qualifier,
        ...(nutrient.qualifier === "less_than" ? { limit: nutrient.limit } : {}),
      };
    }
    return {
      id: food.id,
      name: food.names.es,
      // Una categoría general evita convertir 161 subgrupos en chips de filtros.
      category: categories.get(food.category_ids[0]) ?? "Sin categoría",
      ...values,
      serving_size_g: null,
      serving_description: "Referencia: 100 g de parte comestible; no es una ración típica",
      sourceId: "anses_ciqual_2025",
      source: "alimento",
      ciqual: { version: "2025", names: { fr: food.names.fr, en: food.names.en }, qualifiers },
    };
  });
}

export async function createCiqualMobileArtifact(root) {
  const input = await readFile(resolve(root, "alimentos/ciqual/all.json"), "utf8");
  const groups = JSON.parse(await readFile(resolve(root, "alimentos/ciqual/groups.json"), "utf8"));
  const foods = projectCiqualForMobile(JSON.parse(input), groups);
  const artifact = {
    source: "ANSES-CIQUAL 2025",
    source_sha256: createHash("sha256").update(input).digest("hex"),
    attribution: "ANSES, Table Ciqual 2025 — Licence Ouverte 2.0. Traducciones de Gymnasia; no oficiales de ANSES.",
    foods,
  };
  return `${JSON.stringify(artifact)}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const output = resolve(root, "apps/mobile/catalogs/generated/ciqualBaseline.generated.json");
  const expected = await createCiqualMobileArtifact(root);
  if (process.argv[2] === "--write") await writeFile(output, expected);
  else assert.equal(await readFile(output, "utf8"), expected, "Baseline móvil CIQUAL desactualizado; ejecuta npm run sync:ciqual:mobile");
  console.log(`CIQUAL móvil verificado: ${JSON.parse(expected).foods.length} alimentos.`);
}
