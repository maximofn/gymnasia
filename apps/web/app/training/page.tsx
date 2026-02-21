"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  ApiError,
  cloneWorkoutTemplate,
  createWorkoutTemplate,
  deleteWorkoutTemplate,
  listWorkoutTemplates,
  reorderWorkoutTemplates,
  type WorkoutTemplate,
} from "../../lib/workouts";
import { enqueueSyncOperation } from "../../lib/sync";

type TrainingState = "ready" | "loading" | "empty" | "error";

const localFallbackTemplates: WorkoutTemplate[] = [
  {
    id: "local-r1",
    name: "Tren superior — fuerza",
    notes: null,
    position: 0,
    is_archived: false,
    exercises: [],
  },
  {
    id: "local-r2",
    name: "Pierna — hipertrofia",
    notes: null,
    position: 1,
    is_archived: false,
    exercises: [],
  },
  {
    id: "local-r3",
    name: "Empuje + core",
    notes: null,
    position: 2,
    is_archived: false,
    exercises: [],
  },
];

function resolveState(value: string | null): TrainingState | null {
  if (value === "ready" || value === "loading" || value === "empty" || value === "error") {
    return value;
  }
  return null;
}

function sortedByPosition(templates: WorkoutTemplate[]): WorkoutTemplate[] {
  return [...templates].sort((a, b) => a.position - b.position);
}

function templateMeta(template: WorkoutTemplate): string {
  const exerciseCount = template.exercises.length;
  const setCount = template.exercises.reduce((acc, exercise) => acc + exercise.sets.length, 0);
  return `${exerciseCount} ejercicios • ${setCount} series`;
}

function StateLinks({ active }: { active: TrainingState }) {
  return (
    <div className="routines-toolbar" aria-label="Vista de estados">
      <Link href="/training?state=ready" className={active === "ready" ? "tag active" : "tag"}>
        Normal
      </Link>
      <Link href="/training?state=loading" className={active === "loading" ? "tag active" : "tag"}>
        Cargando
      </Link>
      <Link href="/training?state=empty" className={active === "empty" ? "tag active" : "tag"}>
        Vacio
      </Link>
      <Link href="/training?state=error" className={active === "error" ? "tag active" : "tag"}>
        Error
      </Link>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="state-card">
      <h3 className="state-title">Cargando rutinas...</h3>
      <p className="state-text">Obteniendo entrenamientos guardados.</p>
      <div className="state-loading-list">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </section>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="state-card">
      <h3 className="state-title">No tienes rutinas creadas</h3>
      <p className="state-text">Crea tu primera rutina para empezar a registrar sesiones.</p>
      <div style={{ marginTop: "16px" }}>
        <button className="cta" onClick={onCreate}>
          Nueva rutina
        </button>
      </div>
    </section>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="state-card state-error">
      <h3 className="state-title">No pudimos cargar tus rutinas</h3>
      <p className="state-text">Revisa tu conexion y vuelve a intentarlo.</p>
      <div style={{ marginTop: "16px" }}>
        <button className="cta" onClick={onRetry}>
          Reintentar
        </button>
      </div>
    </section>
  );
}

export default function TrainingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const forcedState = resolveState(searchParams.get("state"));

  async function loadTemplates() {
    setLoading(true);
    setError(null);

    try {
      const data = await listWorkoutTemplates();
      setTemplates(sortedByPosition(data));
      setMessage(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setTemplates(localFallbackTemplates);
        setMessage("Modo local: inicia sesion para sincronizar rutinas con servidor.");
      } else {
        setError(err instanceof Error ? err.message : "No se pudieron cargar rutinas.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  const computedState = useMemo<TrainingState>(() => {
    if (forcedState) return forcedState;
    if (loading) return "loading";
    if (error) return "error";
    if (templates.length === 0) return "empty";
    return "ready";
  }, [forcedState, loading, error, templates.length]);

  const createRoutine = async () => {
    const name = window.prompt("Nombre de la rutina", "Nueva rutina");
    if (!name || !name.trim()) return;

    setError(null);

    try {
      const created = await createWorkoutTemplate({
        name: name.trim(),
        notes: undefined,
        exercises: [],
      });
      enqueueSyncOperation({
        entityType: "workout_template",
        entityId: created.id,
        opType: "upsert",
        payload: { name: created.name },
      });
      router.push(`/training/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const fallbackId = `local-${Date.now()}`;
        router.push(`/training/${fallbackId}`);
      } else {
        setError(err instanceof Error ? err.message : "No se pudo crear la rutina.");
      }
    }
  };

  const cloneRoutine = async (template: WorkoutTemplate) => {
    setError(null);

    try {
      const cloned = await cloneWorkoutTemplate(template.id);
      router.push(`/training/${cloned.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMessage("Modo local: clonado disponible al conectar API.");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo clonar rutina.");
      }
    }
  };

  const removeRoutine = async (template: WorkoutTemplate) => {
    if (!window.confirm(`¿Eliminar la rutina \"${template.name}\"?`)) return;

    setError(null);

    try {
      await deleteWorkoutTemplate(template.id);
      enqueueSyncOperation({
        entityType: "workout_template",
        entityId: template.id,
        opType: "delete",
      });
      setTemplates((prev) => prev.filter((item) => item.id !== template.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMessage("Modo local: borrado disponible al conectar API.");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo borrar rutina.");
      }
    }
  };

  const moveRoutine = async (templateIndex: number, direction: -1 | 1) => {
    const target = templateIndex + direction;
    if (target < 0 || target >= templates.length) return;

    const next = [...templates];
    const current = next[templateIndex];
    next[templateIndex] = next[target];
    next[target] = current;

    const normalized = next.map((item, index) => ({ ...item, position: index }));
    setTemplates(normalized);

    try {
      await reorderWorkoutTemplates(normalized.map((item) => item.id));
      enqueueSyncOperation({
        entityType: "workout_template_order",
        opType: "upsert",
        payload: { template_ids: normalized.map((item) => item.id) },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMessage("Modo local: reordenado visual, sin sincronizacion.");
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo reordenar.");
      loadTemplates();
    }
  };

  return (
    <>
      <div className="row">
        <div>
          <p className="page-subtitle">Entrenamiento</p>
          <h1 className="page-title">Rutinas</h1>
        </div>
        <button className="cta" onClick={createRoutine}>
          Nueva rutina
        </button>
      </div>

      {message ? <p className="status-message ok">{message}</p> : null}
      {error && !forcedState ? <p className="status-message error">{error}</p> : null}

      <StateLinks active={computedState} />

      {computedState === "loading" ? <LoadingState /> : null}
      {computedState === "error" ? <ErrorState onRetry={loadTemplates} /> : null}
      {computedState === "empty" ? <EmptyState onCreate={createRoutine} /> : null}

      {computedState === "ready" ? (
        <div className="routine-list">
          {templates.map((template, index) => (
            <article key={template.id} className="routine-item">
              <div className="row routine-row-wrap">
                <div>
                  <h3 className="routine-title">
                    <Link href={`/training/${template.id}`}>{template.name}</Link>
                  </h3>
                  <p className="routine-meta">{templateMeta(template)}</p>
                </div>
                <div className="routine-actions">
                  <Link href={`/training/${template.id}`} className="action-pill">
                    Abrir
                  </Link>
                  <button className="action-pill" onClick={() => router.push(`/training/${template.id}`)}>
                    Editar
                  </button>
                  <button className="action-pill" onClick={() => cloneRoutine(template)}>
                    Clonar
                  </button>
                  <button className="action-pill" onClick={() => moveRoutine(index, -1)}>
                    ↑
                  </button>
                  <button className="action-pill" onClick={() => moveRoutine(index, 1)}>
                    ↓
                  </button>
                  <button className="action-pill danger" onClick={() => removeRoutine(template)}>
                    Borrar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
