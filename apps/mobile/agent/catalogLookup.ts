import type { FoodCatalogEntry } from "../catalogs/types";

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

/** Resuelve consultas explícitas de calorías con datos del catálogo del dispositivo. */
export function answerCatalogCaloriesLookup(
  userInput: string,
  foods: readonly FoodCatalogEntry[],
): string | null {
  const text = normalize(userInput);
  const request = text.match(
    /^(?:busca|buscar|encuentra|consulta)\s+(.+?)\s+en\s+(?:el|mi)\s+catalogo\s+y\s+(?:dime|indica|muestra)\s+(?:sus|las)\s+calorias\s+por\s+(?:cada\s+)?100\s*g[.!?]*$/,
  );
  if (!request) return null;

  const query = request[1].replace(/^(?:el|la|un|una)\s+/, "").trim();
  if (!query) return null;
  const exact = foods.filter((food) => {
    const fullName = normalize(food.name);
    const baseName = normalize(food.name.replace(/\s*\([^)]*\)\s*$/, ""));
    return fullName === query || baseName === query;
  });
  const matches = exact.length > 0
    ? exact
    : foods.filter((food) => normalize(food.name).includes(query));
  if (matches.length === 1) {
    const food = matches[0];
    return `En el catálogo, ${food.name} tiene ${food.calories_per_100g} kcal por 100 g.`;
  }
  if (matches.length > 1) {
    return `Encontré varias opciones en el catálogo: ${matches.slice(0, 5).map((food) => food.name).join(", ")}. ¿Cuál te interesa?`;
  }
  return null;
}
