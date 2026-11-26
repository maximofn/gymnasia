import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// GYM-275 (ticket para que Coach pueda crear, mover y vaciar una comida entera):
// «repetir día» de la pantalla de Dieta y las herramientas de Coach que copian
// comidas deben colocar los alimentos con la misma función,
// `placeItemsInMeal` de diet/mealItemOperations.ts. Si la pantalla vuelve a
// montar la comida por su cuenta, las dos copias pueden divergir sin que lo note
// ninguna prueba de comportamiento.

const source = readFileSync(fileURLToPath(new URL("./dietController.ts", import.meta.url)), "utf8");

describe("contrato de «repetir día» en la pantalla de Dieta", () => {
  it("coloca los alimentos copiados con la función compartida, sumándolos a lo que hubiera", () => {
    const start = source.indexOf("confirmCopy:");
    const end = source.indexOf("closeCopyConfirmation:", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const confirmCopy = source.slice(start, end);
    expect(confirmCopy).toContain("placeItemsInMeal(");
    expect(confirmCopy).toContain('"append"');
    expect(confirmCopy).not.toMatch(/meals\.find\(|\.meals\.map\(/);
  });
});
