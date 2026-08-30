import fc from "fast-check";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  LOCAL_DATA_MANIFEST,
  LOCAL_DATA_SECURITY_PRESERVED_KEYS,
  LOCAL_SECURE_DATA_MANIFEST,
  runLocalDataDeletion,
  type LocalDataDeletionTask,
} from "./localDataDeletion";

function successfulTask(id: string): LocalDataDeletionTask {
  return {
    id,
    label: `Destino ${id}`,
    delete: vi.fn(async () => {}),
    verify: vi.fn(async () => true),
  };
}

describe("runLocalDataDeletion", () => {
  it("solo declara éxito después de borrar y verificar todos los destinos", async () => {
    const tasks = [successfulTask("store"), successfulTask("secure-store")];
    const report = await runLocalDataDeletion("all-personal", tasks);

    expect(report.status).toBe("complete");
    expect(report.completedTargetIds).toEqual(["store", "secure-store"]);
    expect(report.failures).toEqual([]);
    for (const task of tasks) {
      expect(task.delete).toHaveBeenCalledOnce();
      expect(task.verify).toHaveBeenCalledOnce();
    }
  });

  it("continúa con el resto y distingue borrado de verificación", async () => {
    const tasks: LocalDataDeletionTask[] = [
      {
        id: "delete-failure",
        label: "Fallo al borrar",
        delete: async () => { throw new Error("sin acceso"); },
        verify: vi.fn(async () => true),
      },
      {
        id: "verify-failure",
        label: "Fallo al verificar",
        delete: async () => {},
        verify: async () => false,
      },
      successfulTask("ok"),
    ];

    const report = await runLocalDataDeletion("all-personal", tasks);

    expect(report.status).toBe("incomplete");
    expect(report.completedTargetIds).toEqual(["ok"]);
    expect(report.failures).toEqual([
      expect.objectContaining({ id: "delete-failure", stage: "delete" }),
      expect.objectContaining({ id: "verify-failure", stage: "verify" }),
    ]);
    expect(tasks[0].verify).not.toHaveBeenCalled();
  });

  it("convierte una operación colgada en un fallo reintentable", async () => {
    const report = await runLocalDataDeletion("activity", [{
      id: "hung",
      label: "Sesión activa",
      delete: () => new Promise<void>(() => {}),
      verify: async () => true,
    }], { timeoutMs: 5 });

    expect(report.failures).toEqual([
      expect.objectContaining({ id: "hung", stage: "timeout" }),
    ]);
  });

  it("el reintento converge cuando el adaptador vuelve a funcionar", async () => {
    let fail = true;
    const task: LocalDataDeletionTask = {
      id: "prefs",
      label: "Preferencias",
      delete: async () => {
        if (fail) throw new Error("fallo temporal");
      },
      verify: async () => !fail,
    };

    expect((await runLocalDataDeletion("all-personal", [task])).status).toBe("incomplete");
    fail = false;
    expect((await runLocalDataDeletion("all-personal", [task])).status).toBe("complete");
  });

  it("mantiene el resultado exacto con órdenes y fallos arbitrarios", async () => {
    await fc.assert(fc.asyncProperty(
      fc.uniqueArray(fc.string({ minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 12 }),
      fc.array(fc.boolean(), { minLength: 1, maxLength: 12 }),
      async (ids, failures) => {
        const failing = new Set(ids.filter((_, index) => failures[index % failures.length]));
        const tasks = ids.map((id): LocalDataDeletionTask => ({
          id,
          label: id,
          delete: async () => {
            if (failing.has(id)) throw new Error("fallo generado");
          },
          verify: async () => true,
        }));
        const report = await runLocalDataDeletion("all-personal", tasks);
        expect(new Set(report.failures.map((failure) => failure.id))).toEqual(failing);
        expect(new Set(report.completedTargetIds)).toEqual(
          new Set(ids.filter((id) => !failing.has(id))),
        );
      },
    ));
  });
});

describe("LOCAL_DATA_MANIFEST", () => {
  it("solo conserva por seguridad la caché firmada anti-retroceso", () => {
    expect(LOCAL_DATA_SECURITY_PRESERVED_KEYS).toEqual([
      "gymnasia.mobile.signed_policy.cache.v1",
    ]);
    expect(LOCAL_DATA_MANIFEST.filter((entry) => entry.full === "delete").length)
      .toBeGreaterThan(0);
  });

  it("el borrado de actividad elimina fotos y renueva recuperación, cuarentena y sesión", () => {
    expect(LOCAL_DATA_MANIFEST.filter((entry) => entry.activity !== "preserve"))
      .toEqual([
        expect.objectContaining({ key: "gymnasia.mobile.local.v3", activity: "rewrite" }),
        expect.objectContaining({ key: "gymnasia_measurement_media_v1", activity: "delete" }),
        expect.objectContaining({
          key: "gymnasia.mobile.local.last_good.v1",
          activity: "rewrite",
        }),
        expect.objectContaining({
          key: "gymnasia.mobile.local.quarantine.v1",
          activity: "delete",
        }),
        expect.objectContaining({ key: "gymnasia.mobile.training.session.v1", activity: "delete" }),
        expect.objectContaining({
          key: "gymnasia.mobile.training.session_template_snapshot.v1",
          activity: "delete",
        }),
      ]);
  });

  it("coincide con el alcance declarado en el inventario de privacidad", () => {
    const inventory = JSON.parse(readFileSync(
      new URL("../../../scripts/data-inventory/inventory.json", import.meta.url),
      "utf8",
    )) as {
      storageKeys: Array<{
        key: string;
        activityDeletion: string;
        fullDeletion: string;
      }>;
      secureStoreKeys: Array<{
        key: string;
        form: string;
        activityDeletion: string;
        fullDeletion: string;
      }>;
    };

    expect(inventory.storageKeys.map((entry) => ({
      key: entry.key,
      activity: entry.activityDeletion,
      full: entry.fullDeletion,
    }))).toEqual(LOCAL_DATA_MANIFEST);
    expect(inventory.secureStoreKeys.map((entry) => ({
      key: entry.key,
      form: entry.form,
      activity: entry.activityDeletion,
      full: entry.fullDeletion,
    }))).toEqual(LOCAL_SECURE_DATA_MANIFEST);
  });
});
