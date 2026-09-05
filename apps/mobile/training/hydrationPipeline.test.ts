import { createHash } from "node:crypto";

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import {
  LocalStoreRecoveryRepository,
  type LocalStoreRecoveryKeys,
  type StringStorage,
} from "../persistence/localStoreRecovery";
import {
  buildSeriesFromLegacyExercise,
  createIssueSink,
  resolveTrainingIssues,
} from "./seriesContract";

/**
 * La app arranca así: el repositorio inspecciona lo guardado y, si lo da por
 * válido, `normalizeStore` lo normaliza. Si esa normalización lanza, el almacén
 * del usuario va a cuarentena y la app se queda en la pantalla de recuperación.
 *
 * Este fichero comprueba justamente eso: por muy roto que esté el subárbol de
 * entrenamiento, la ruta de arranque no llega nunca a la cuarentena.
 */

const KEYS: LocalStoreRecoveryKeys = {
  primary: "primary",
  snapshot: "snapshot",
  quarantine: "quarantine",
};

const NOW = new Date("2026-09-05T10:00:00.000Z");
const sha256 = async (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

class MemoryStorage implements StringStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function storeWithTemplates(templates: unknown): Record<string, unknown> {
  return {
    templates,
    workoutHistory: [],
    dietByDate: {},
    dietSettings: {},
    measurements: [],
    threads: [],
    messagesByThread: {},
    keys: [],
  };
}

/** Normaliza el subárbol de entrenamiento igual que hace `normalizeStore` al arrancar. */
function normalizeTrainingLikeHydration(store: Record<string, unknown>) {
  const sink = createIssueSink("repair");
  let counter = 0;
  const createId = (prefix: string) => `${prefix}_${++counter}`;
  const templates = Array.isArray(store.templates) ? store.templates : [];
  const normalized = templates.map((template, templateIndex) => {
    const exercises =
      template && typeof template === "object" && Array.isArray((template as { exercises?: unknown }).exercises)
        ? (template as { exercises: unknown[] }).exercises
        : [];
    return exercises.map((exercise, exerciseIndex) =>
      buildSeriesFromLegacyExercise(
        exercise,
        `templates[${templateIndex}].exercises[${exerciseIndex}]`,
        createId,
        sink,
      ),
    );
  });
  return resolveTrainingIssues(normalized, sink);
}

/** Almacenes rotos de formas distintas, todos con la estructura raíz correcta. */
const CORRUPT_TRAINING_TREES: unknown[] = [
  [{ id: "t1", name: "R", exercises: [{ name: "E", series: "no soy una lista" }] }],
  [{ id: "t1", name: "R", exercises: [{ name: "E", series: [null, 42, "x"] }] }],
  [{ id: "t1", name: "R", exercises: [{ name: "E", series: [{ id: "a", reps: { n: 1 } }] }] }],
  [{ id: "t1", name: "R", exercises: [{ name: "E", series: [{ id: "a", type: "inventado" }] }] }],
  [{ id: "t1", name: "R", exercises: [{ name: "E", series: [{ id: "a", sub_series: "nop" }] }] }],
  [{ id: "t1", name: "R", exercises: [{ name: "E", series: [{ id: "a", sub_series: [null] }] }] }],
  [{ id: "t1", name: "R", exercises: [{ name: "E", series: [{ id: "a" }, { id: "a" }] }] }],
  [{ id: "t1", name: "R", exercises: [{ name: "E", sets: "no es una lista" }] }],
  [{ id: "t1", name: "R", exercises: [{ name: "E", sets: [1, "dos", null] }] }],
  [{ id: "t1", name: "R", exercises: [{ name: "E", series: [{ tempo_pause: "despacio" }] }] }],
  [{ id: "t1", name: "R", exercises: [{ name: "E", series: [{ catalog_link: "roto" }] }] }],
  [{ id: "t1", name: "R", exercises: ["no soy un ejercicio"] }],
  [{ id: "t1", name: "R", exercises: [], series_schema_version: 99 }],
  [{ id: "t1", name: "R" }],
  [],
];

describe("arranque con datos de entrenamiento rotos", () => {
  it("ningún almacén corrupto llega a la cuarentena por la normalización de series", async () => {
    let reachedNormalization = 0;

    for (const templates of CORRUPT_TRAINING_TREES) {
      const storage = new MemoryStorage();
      const repository = new LocalStoreRecoveryRepository({
        storage,
        keys: KEYS,
        sha256,
        now: () => NOW,
      });
      const quarantine = vi.spyOn(repository, "quarantineUnexpectedNormalization");

      const raw = JSON.stringify(storeWithTemplates(templates));
      await storage.setItem(KEYS.primary, raw);

      const inspection = await repository.inspect();
      if (inspection.status === "valid") {
        // Llega a la normalización: es el caso que este contrato protege.
        reachedNormalization += 1;
        const result = normalizeTrainingLikeHydration(JSON.parse(raw));
        expect(result.ok, `bloquearía el arranque: ${raw}`).toBe(true);
      }
      // Y si el portero lo paró antes, la normalización nunca se ejecutó, así que
      // tampoco pudo mandar nada a cuarentena por su culpa.
      expect(quarantine).not.toHaveBeenCalled();
    }

    // Si el portero acabara filtrándolo todo, este test dejaría de probar nada.
    expect(reachedNormalization).toBeGreaterThan(0);
  });

  it("una rutina con la versión sellada sigue pasando el portero de persistencia", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStoreRecoveryRepository({
      storage,
      keys: KEYS,
      sha256,
      now: () => NOW,
    });
    const raw = JSON.stringify(
      storeWithTemplates([{ id: "t1", name: "R", series_schema_version: 1, exercises: [] }]),
    );
    await storage.setItem(KEYS.primary, raw);

    await expect(repository.inspect()).resolves.toMatchObject({ status: "valid" });
  });

  it("una versión sellada con un tipo equivocado sí la denuncia el portero", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStoreRecoveryRepository({
      storage,
      keys: KEYS,
      sha256,
      now: () => NOW,
    });
    const raw = JSON.stringify(
      storeWithTemplates([{ id: "t1", name: "R", series_schema_version: "1", exercises: [] }]),
    );
    await storage.setItem(KEYS.primary, raw);

    const inspection = await repository.inspect();
    expect(inspection.status).not.toBe("valid");
  });

  it("ningún árbol de entrenamiento arbitrario consigue bloquear el arranque", () => {
    fc.assert(
      fc.property(fc.anything(), (templates) => {
        const result = normalizeTrainingLikeHydration(storeWithTemplates(templates));
        expect(result.ok).toBe(true);
      }),
      { numRuns: 300, seed: 173 },
    );
  });
});
