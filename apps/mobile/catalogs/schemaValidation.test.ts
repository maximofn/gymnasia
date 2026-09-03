import { describe, expect, it } from "vitest";

import {
  canonicalCatalogJson,
  catalogContentHash,
  parseExerciseCatalog,
  parseFoodCatalog,
} from "./schemaValidation";

const food = {
  id: "arroz-blanco",
  name: "Arroz blanco",
  category: "cereal",
  calories_per_100g: 130,
  protein_per_100g: 2.7,
  carbs_per_100g: 28,
  fat_per_100g: 0.3,
  fiber_per_100g: 0.4,
  serving_size_g: 100,
  serving_description: "100 g",
};

const exercise = {
  id: "press-banca",
  name: "Press banca",
  image_male: "images/press-banca-male.webp",
  image_female: "images/press-banca-female.webp",
  muscle_group: "Pecho",
  secondary_muscles: ["Tríceps"],
  equipment: "Barra",
  difficulty: "Intermedio",
  instructions: "Empuja con control.",
};

describe("validación runtime de catálogos", () => {
  it("acepta entradas que cumplen los schemas canónicos", () => {
    expect(parseFoodCatalog([food])).toEqual([food]);
    expect(parseExerciseCatalog([exercise])).toEqual([exercise]);
  });

  it("rechaza el catálogo completo ante una entrada inválida o un campo futuro", () => {
    expect(parseFoodCatalog([food, { ...food, id: "invalido", calories_per_100g: -1 }])).toBeNull();
    expect(parseExerciseCatalog([{ ...exercise, future: true }])).toBeNull();
  });

  it("calcula el mismo SHA-256 para objetos con distinto orden de claves", () => {
    expect(canonicalCatalogJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
    expect(catalogContentHash({ b: 2, a: 1 })).toBe(catalogContentHash({ a: 1, b: 2 }));
  });
});
