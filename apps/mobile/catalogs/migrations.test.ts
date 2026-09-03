import { describe, expect, it } from "vitest";

import {
  linkLegacyExercisesFromFreshCatalog,
  normalizeCatalogLink,
  synchronizeLinkedExercises,
} from "./migrations";
import { catalogRef, linkedCatalog, unresolvedCatalog, type CatalogLink, type ExerciseCatalogEntry } from "./types";

const catalog: ExerciseCatalogEntry[] = [{
  id: "press-banca",
  sourceId: "gymnasia_exercises",
  name: "Press de banca renovado",
  image_male: "images/press-banca-male.webp",
  image_female: "images/press-banca-female.webp",
  muscle_group: "Pecho",
  secondary_muscles: ["Tríceps"],
  equipment: "Barra",
  difficulty: "Intermedio",
  instructions: "Empuja con control.",
}];

describe("migraciones de referencias de catálogo", () => {
  it("normaliza referencias versionadas y conserva unresolved", () => {
    expect(normalizeCatalogLink(linkedCatalog(catalogRef("gymnasia_exercises", "press-banca"), "selection"))).toEqual(
      linkedCatalog(catalogRef("gymnasia_exercises", "press-banca"), "selection"),
    );
    expect(normalizeCatalogLink({ schemaVersion: 99, status: "linked" }, "legacy_unknown")).toEqual(
      unresolvedCatalog("legacy_unknown"),
    );
  });

  it("vincula un ejercicio heredado solo ante una coincidencia única y es idempotente", () => {
    const templates: Array<{ exercises: Array<{ name: string; image_uri: null; catalog_link?: CatalogLink }> }> = [
      { exercises: [{ name: "Press banca renovado", image_uri: null }] },
    ];
    const first = linkLegacyExercisesFromFreshCatalog(templates, catalog);
    const second = linkLegacyExercisesFromFreshCatalog(first.templates, catalog);
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(first.templates[0].exercises[0].catalog_link).toEqual(expect.objectContaining({
      status: "linked",
      linkedBy: "legacy_alias",
    }));

    const ambiguous = linkLegacyExercisesFromFreshCatalog(templates, [catalog[0], { ...catalog[0], id: "press-banca-2" }]);
    expect(ambiguous.changed).toBe(false);
  });

  it("resuelve un cambio de nombre e imagen por ID sin perder el vínculo", () => {
    const link = linkedCatalog(catalogRef("gymnasia_exercises", "press-banca"), "selection");
    const result = synchronizeLinkedExercises(
      [{ exercises: [{
        name: "Nombre anterior",
        muscle: "",
        image_uri: "old",
        catalog_link: link,
        series: [{ sub_series: [{ exercise_name: "Otro nombre", catalog_link: link }] }],
      }] }],
      catalog,
      (entry) => `https://example.test/${entry.image_male}`,
    );
    expect(result.templates[0].exercises[0]).toEqual(expect.objectContaining({
      name: "Press de banca renovado",
      image_uri: "https://example.test/images/press-banca-male.webp",
      catalog_link: link,
    }));
    expect(result.templates[0].exercises[0].series[0].sub_series[0]).toEqual({
      exercise_name: "Press de banca renovado",
      catalog_link: link,
    });
  });

  it("vincula referencias heredadas de superserie solo con una coincidencia única", () => {
    const templates: Array<{ exercises: Array<{
      name: string;
      catalog_link?: CatalogLink;
      series: Array<{ sub_series: Array<{ exercise_name: string; catalog_link?: CatalogLink }> }>;
    }> }> = [{ exercises: [{
      name: "Personalizado",
      series: [{ sub_series: [{ exercise_name: "Press banca renovado" }] }],
    }] }];
    const result = linkLegacyExercisesFromFreshCatalog(templates, catalog);
    expect(result.templates[0].exercises[0].catalog_link).toBeUndefined();
    expect(result.templates[0].exercises[0].series[0].sub_series[0].catalog_link).toEqual(
      expect.objectContaining({ status: "linked", linkedBy: "legacy_alias" }),
    );

    const ambiguous = linkLegacyExercisesFromFreshCatalog(
      templates,
      [catalog[0], { ...catalog[0], id: "press-banca-2" }],
    );
    expect(ambiguous.changed).toBe(false);
  });
});
