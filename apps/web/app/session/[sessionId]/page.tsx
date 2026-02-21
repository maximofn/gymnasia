"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ApiError,
  applyWorkoutTemplateUpdates,
  finishWorkoutSession,
  listWorkoutSessions,
  mockSession,
  patchWorkoutSession,
  type WorkoutExercise,
  type WorkoutSession,
} from "../../../lib/workouts";
import { enqueueSyncOperation } from "../../../lib/sync";

function normalizeSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise, exIndex) => ({
      ...exercise,
      position: exIndex,
      sets: exercise.sets.map((setItem, setIndex) => ({
        ...setItem,
        position: setIndex,
        reps_fixed: setItem.reps_fixed ?? null,
        reps_min: setItem.reps_min ?? null,
        reps_max: setItem.reps_max ?? null,
        weight_kg: setItem.weight_kg ?? null,
      })),
    })),
  };
}

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFinishModal, setShowFinishModal] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      setLoading(true);
      setError(null);

      try {
        const sessions = await listWorkoutSessions(100);
        const found = sessions.find((item) => item.id === sessionId);
        if (found) {
          if (mounted) setSession(normalizeSession(found));
        } else if (mounted) {
          setSession(normalizeSession(mockSession(sessionId)));
          setMessage("Sesion no encontrada en API. Mostrando modo local.");
        }
      } catch (err) {
        if (mounted) {
          setSession(normalizeSession(mockSession(sessionId)));
          if (err instanceof ApiError) {
            setMessage(`Modo local: ${err.message}`);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  const totalSets = useMemo(
    () => session?.exercises.reduce((acc, exercise) => acc + exercise.sets.length, 0) ?? 0,
    [session]
  );

  const updateExercises = (updater: (exercises: WorkoutExercise[]) => WorkoutExercise[]) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: updater(prev.exercises).map((exercise, idx) => ({ ...exercise, position: idx })),
      };
    });
  };

  const updateSetField = (
    exerciseIndex: number,
    setIndex: number,
    field: "reps_fixed" | "weight_kg" | "rest_mmss",
    value: string
  ) => {
    updateExercises((exercises) =>
      exercises.map((exercise, idx) => {
        if (idx !== exerciseIndex) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((setItem, sIdx) => {
            if (sIdx !== setIndex) return setItem;
            if (field === "rest_mmss") {
              return { ...setItem, rest_mmss: value || "02:00" };
            }
            return {
              ...setItem,
              [field]: value ? Number(value) : null,
            };
          }),
        };
      })
    );
  };

  const saveSession = async () => {
    if (!session) return;
    setSaving(true);
    setError(null);

    try {
      const saved = await patchWorkoutSession(session.id, session.exercises, session.notes);
      setSession(normalizeSession(saved));
      enqueueSyncOperation({
        entityType: "workout_session",
        entityId: session.id,
        opType: "upsert",
        payload: { status: "in_progress" },
      });
      setMessage("Sesion actualizada.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMessage("Sin token/API: cambios guardados solo en local.");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar sesion.");
      }
    } finally {
      setSaving(false);
    }
  };

  const finishSession = async () => {
    if (!session) return;
    setFinishing(true);
    setError(null);

    try {
      const finished = await finishWorkoutSession(session.id, session.notes);
      setSession(normalizeSession(finished));
      setShowFinishModal(true);
      enqueueSyncOperation({
        entityType: "workout_session",
        entityId: session.id,
        opType: "upsert",
        payload: { status: "finished" },
      });
      setMessage("Sesion finalizada.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setShowFinishModal(true);
        setMessage("Sesion finalizada en modo local.");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo finalizar sesion.");
      }
    } finally {
      setFinishing(false);
    }
  };

  const applyTemplateChanges = async () => {
    if (!session) return;

    try {
      await applyWorkoutTemplateUpdates(session.id);
      enqueueSyncOperation({
        entityType: "workout_template_apply",
        entityId: session.id,
        opType: "upsert",
        payload: { applied: true },
      });
      setShowFinishModal(false);
      setMessage("Cambios aplicados a futuras sesiones.");
      if (session.template_id) {
        router.push(`/training/${session.template_id}`);
      } else {
        router.push("/training");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setShowFinishModal(false);
        setMessage("Sin token/API: no se pudo aplicar a plantilla.");
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo aplicar cambios a plantilla.");
    }
  };

  if (loading) {
    return (
      <>
        <p className="page-subtitle">Entrenamiento</p>
        <h1 className="page-title">Sesion Activa</h1>
        <section className="state-card">
          <h3 className="state-title">Cargando sesion...</h3>
          <div className="state-loading-list">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        </section>
      </>
    );
  }

  if (!session) {
    return (
      <section className="state-card state-error">
        <h3 className="state-title">Sesion no disponible</h3>
      </section>
    );
  }

  return (
    <>
      <div className="row builder-top-row">
        <div>
          <p className="page-subtitle">Entrenamiento en curso</p>
          <h1 className="page-title">Sesion Activa</h1>
          <p className="builder-meta">{session.exercises.length} ejercicios • {totalSets} series</p>
        </div>
        <div className="row builder-actions-row">
          <button className="tag" onClick={saveSession}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button className="cta" onClick={finishSession}>
            {finishing ? "Finalizando..." : "Finalizar sesion"}
          </button>
        </div>
      </div>

      {message ? <p className="status-message ok">{message}</p> : null}
      {error ? <p className="status-message error">{error}</p> : null}

      <section className="builder-list">
        {session.exercises.map((exercise, exerciseIndex) => (
          <article key={exercise.id} className="builder-exercise-card">
            <div className="row">
              <div>
                <h3 className="routine-title">{exercise.exercise_name_snapshot}</h3>
                <p className="routine-meta">{exercise.muscle_group_snapshot}</p>
              </div>
            </div>

            <div className="set-table">
              <div className="set-row head">
                <span>#</span>
                <span>Reps</span>
                <span>Peso (kg)</span>
                <span>Descanso</span>
              </div>
              {exercise.sets.map((setItem, setIndex) => (
                <div key={setItem.id} className="set-row compact">
                  <span>{setIndex + 1}</span>
                  <input
                    className="set-input"
                    type="number"
                    value={setItem.reps_fixed ?? ""}
                    onChange={(event) => updateSetField(exerciseIndex, setIndex, "reps_fixed", event.target.value)}
                    placeholder="10"
                  />
                  <input
                    className="set-input"
                    type="number"
                    step="0.25"
                    value={setItem.weight_kg ?? ""}
                    onChange={(event) => updateSetField(exerciseIndex, setIndex, "weight_kg", event.target.value)}
                    placeholder="70"
                  />
                  <input
                    className="set-input"
                    value={setItem.rest_mmss}
                    onChange={(event) => updateSetField(exerciseIndex, setIndex, "rest_mmss", event.target.value)}
                    placeholder="02:00"
                  />
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      {showFinishModal ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Aplicar cambios">
          <div className="finish-modal">
            <h3 className="state-title">Aplicar cambios a la rutina base</h3>
            <p className="state-text">¿Quieres actualizar la plantilla para futuras sesiones?</p>
            <div className="row" style={{ marginTop: "16px" }}>
              <button className="tag" onClick={() => setShowFinishModal(false)}>
                Solo hoy
              </button>
              <button className="cta" onClick={applyTemplateChanges}>
                Si, actualizar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
