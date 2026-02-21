"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ApiError,
  cloneWorkoutTemplate,
  deleteWorkoutTemplate,
  listWorkoutTemplates,
  mockTemplate,
  patchWorkoutTemplate,
  startWorkoutSession,
  type WorkoutExercise,
  type WorkoutSet,
  type WorkoutTemplate,
} from "../../../lib/workouts";
import { createExerciseMediaLink, createUploadIntent, generateExerciseImage, generateExerciseVideo } from "../../../lib/media";
import { enqueueSyncOperation } from "../../../lib/sync";

function normalizeSet(setItem: WorkoutSet, index: number): WorkoutSet {
  return {
    ...setItem,
    id: setItem.id || `set-${index + 1}`,
    position: index,
    reps_fixed: setItem.reps_fixed ?? null,
    reps_min: setItem.reps_min ?? null,
    reps_max: setItem.reps_max ?? null,
    rest_mmss: setItem.rest_mmss || "02:00",
    weight_kg: setItem.weight_kg ?? null,
  };
}

function normalizeExercise(exercise: WorkoutExercise, index: number): WorkoutExercise {
  return {
    ...exercise,
    id: exercise.id || `exercise-${index + 1}`,
    position: index,
    notes: exercise.notes ?? null,
    muscle_group_snapshot: exercise.muscle_group_snapshot ?? null,
    sets: exercise.sets.map((setItem, setIndex) => normalizeSet(setItem, setIndex)),
  };
}

function normalizeTemplate(template: WorkoutTemplate): WorkoutTemplate {
  return {
    ...template,
    exercises: template.exercises.map((exercise, index) => normalizeExercise(exercise, index)),
  };
}

export default function TrainingBuilderPage() {
  const params = useParams<{ templateId: string }>();
  const router = useRouter();
  const templateId = params.templateId;

  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTemplate() {
      setLoading(true);
      setError(null);

      try {
        const templates = await listWorkoutTemplates();
        const found = templates.find((item) => item.id === templateId);
        if (found) {
          if (mounted) setTemplate(normalizeTemplate(found));
        } else {
          if (mounted) setTemplate(normalizeTemplate(mockTemplate(templateId)));
        }
      } catch (err) {
        if (mounted) {
          if (err instanceof ApiError) {
            setMessage(`Modo local: ${err.message}`);
          }
          setTemplate(normalizeTemplate(mockTemplate(templateId)));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTemplate();

    return () => {
      mounted = false;
    };
  }, [templateId]);

  const updateExercise = (exerciseIndex: number, updater: (exercise: WorkoutExercise) => WorkoutExercise) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      const exercises = prev.exercises.map((exercise, idx) => {
        if (idx !== exerciseIndex) return exercise;
        return updater(exercise);
      });
      return {
        ...prev,
        exercises: exercises.map((item, idx) => ({ ...item, position: idx })),
      };
    });
  };

  const addExercise = () => {
    setTemplate((prev) => {
      if (!prev) return prev;
      const nextExercise: WorkoutExercise = {
        id: `tmp-ex-${Date.now()}`,
        position: prev.exercises.length,
        exercise_name_snapshot: "Nuevo ejercicio",
        muscle_group_snapshot: "Grupo muscular",
        notes: null,
        sets: [
          {
            id: `tmp-set-${Date.now()}`,
            position: 0,
            reps_fixed: 10,
            reps_min: null,
            reps_max: null,
            rest_mmss: "02:00",
            weight_kg: null,
          },
        ],
      };
      return { ...prev, exercises: [...prev.exercises, nextExercise] };
    });
  };

  const removeExercise = (exerciseIndex: number) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.filter((_, idx) => idx !== exerciseIndex).map((item, idx) => ({ ...item, position: idx })),
      };
    });
  };

  const cloneExercise = (exerciseIndex: number) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      const source = prev.exercises[exerciseIndex];
      if (!source) return prev;
      const clone: WorkoutExercise = {
        ...source,
        id: `tmp-ex-${Date.now()}`,
        sets: source.sets.map((setItem, idx) => ({ ...setItem, id: `tmp-set-${Date.now()}-${idx}` })),
      };
      const next = [...prev.exercises];
      next.splice(exerciseIndex + 1, 0, clone);
      return { ...prev, exercises: next.map((item, idx) => ({ ...item, position: idx })) };
    });
  };

  const moveExercise = (exerciseIndex: number, direction: -1 | 1) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      const target = exerciseIndex + direction;
      if (target < 0 || target >= prev.exercises.length) return prev;
      const next = [...prev.exercises];
      const current = next[exerciseIndex];
      next[exerciseIndex] = next[target];
      next[target] = current;
      return { ...prev, exercises: next.map((item, idx) => ({ ...item, position: idx })) };
    });
  };

  const addSet = (exerciseIndex: number) => {
    updateExercise(exerciseIndex, (exercise) => ({
      ...exercise,
      sets: [
        ...exercise.sets,
        {
          id: `tmp-set-${Date.now()}`,
          position: exercise.sets.length,
          reps_fixed: 10,
          reps_min: null,
          reps_max: null,
          rest_mmss: "02:00",
          weight_kg: null,
        },
      ],
    }));
  };

  const updateSet = (exerciseIndex: number, setIndex: number, updater: (setItem: WorkoutSet) => WorkoutSet) => {
    updateExercise(exerciseIndex, (exercise) => ({
      ...exercise,
      sets: exercise.sets
        .map((setItem, idx) => {
          if (idx !== setIndex) return setItem;
          return updater(setItem);
        })
        .map((item, idx) => ({ ...item, position: idx })),
    }));
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    updateExercise(exerciseIndex, (exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((_, idx) => idx !== setIndex).map((item, idx) => ({ ...item, position: idx })),
    }));
  };

  const saveTemplate = async () => {
    if (!template) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const saved = await patchWorkoutTemplate(template.id, template.exercises);
      enqueueSyncOperation({
        entityType: "workout_template",
        entityId: template.id,
        opType: "upsert",
        payload: { exercises: template.exercises.length },
      });
      setTemplate(normalizeTemplate(saved));
      setMessage("Rutina guardada.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMessage("Sin token/API: cambios mantenidos en local.");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    } finally {
      setSaving(false);
    }
  };

  const startSession = async () => {
    if (!template) return;
    setError(null);

    try {
      const session = await startWorkoutSession(template.id);
      router.push(`/session/${session.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(`/session/mock-${template.id}`);
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion.");
    }
  };

  const cloneTemplate = async () => {
    if (!template) return;
    setError(null);

    try {
      const cloned = await cloneWorkoutTemplate(template.id);
      router.push(`/training/${cloned.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMessage("Sin token/API: clonado no disponible en modo local.");
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo clonar rutina.");
    }
  };

  const removeTemplate = async () => {
    if (!template) return;
    if (!window.confirm("¿Eliminar esta rutina?")) return;

    try {
      await deleteWorkoutTemplate(template.id);
      enqueueSyncOperation({
        entityType: "workout_template",
        entityId: template.id,
        opType: "delete",
      });
      router.push("/training");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMessage("Sin token/API: borrado no disponible en modo local.");
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo eliminar rutina.");
    }
  };

  const generateExerciseMedia = async (exercise: WorkoutExercise, format: "image" | "video") => {
    setError(null);
    setMessage(null);

    try {
      const uploadIntent = await createUploadIntent("exercise_machine_photo", `${exercise.exercise_name_snapshot}.jpg`);
      const link = await createExerciseMediaLink({
        exercise_name: exercise.exercise_name_snapshot,
        machine_photo_asset_id: uploadIntent.asset.id,
      });
      const job =
        format === "image"
          ? await generateExerciseImage(link.id, `Mostrar tecnica segura para ${exercise.exercise_name_snapshot}`)
          : await generateExerciseVideo(link.id, `Demostracion guiada para ${exercise.exercise_name_snapshot}`);

      setMessage(
        format === "image"
          ? `Imagen IA solicitada (job ${job.id.slice(0, 8)}).`
          : `Video IA solicitado (job ${job.id.slice(0, 8)}).`
      );
      enqueueSyncOperation({
        entityType: "exercise_media_job",
        entityId: job.id,
        opType: "upsert",
        payload: { exercise_name: exercise.exercise_name_snapshot, format },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar multimedia.");
    }
  };

  if (loading) {
    return (
      <>
        <p className="page-subtitle">Entrenamiento</p>
        <h1 className="page-title">Builder de Rutina</h1>
        <section className="state-card">
          <h3 className="state-title">Cargando rutina...</h3>
          <div className="state-loading-list">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        </section>
      </>
    );
  }

  if (!template) {
    return (
      <section className="state-card state-error">
        <h3 className="state-title">No se encontro la rutina</h3>
      </section>
    );
  }

  return (
    <>
      <div className="row builder-top-row">
        <div>
          <p className="page-subtitle">Entrenamiento</p>
          <h1 className="page-title">{template.name}</h1>
          <p className="builder-meta">{template.exercises.length} ejercicios</p>
        </div>
        <div className="row builder-actions-row">
          <button className="tag" onClick={cloneTemplate}>
            Clonar rutina
          </button>
          <button className="tag" onClick={removeTemplate}>
            Eliminar
          </button>
          <button className="cta" onClick={saveTemplate} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      {message ? <p className="status-message ok">{message}</p> : null}
      {error ? <p className="status-message error">{error}</p> : null}

      <section className="builder-list">
        {template.exercises.map((exercise, exerciseIndex) => (
          <article key={exercise.id} className="builder-exercise-card">
            <div className="row">
              <div className="builder-title-wrap">
                <input
                  className="builder-input title"
                  value={exercise.exercise_name_snapshot}
                  onChange={(event) =>
                    updateExercise(exerciseIndex, (current) => ({
                      ...current,
                      exercise_name_snapshot: event.target.value,
                    }))
                  }
                />
                <input
                  className="builder-input subtitle"
                  value={exercise.muscle_group_snapshot ?? ""}
                  onChange={(event) =>
                    updateExercise(exerciseIndex, (current) => ({
                      ...current,
                      muscle_group_snapshot: event.target.value,
                    }))
                  }
                  placeholder="Grupo muscular"
                />
              </div>
              <div className="routine-actions">
                <button className="action-pill" onClick={() => moveExercise(exerciseIndex, -1)}>
                  ↑
                </button>
                <button className="action-pill" onClick={() => moveExercise(exerciseIndex, 1)}>
                  ↓
                </button>
                <button className="action-pill" onClick={() => cloneExercise(exerciseIndex)}>
                  Clonar
                </button>
                <button className="action-pill" onClick={() => removeExercise(exerciseIndex)}>
                  Borrar
                </button>
                <button className="action-pill" onClick={() => generateExerciseMedia(exercise, "image")}>
                  Imagen IA
                </button>
                <button className="action-pill" onClick={() => generateExerciseMedia(exercise, "video")}>
                  Video IA
                </button>
              </div>
            </div>

            <div className="set-table">
              <div className="set-row head">
                <span>#</span>
                <span>Reps</span>
                <span>Min</span>
                <span>Max</span>
                <span>Peso (kg)</span>
                <span>Descanso</span>
                <span />
              </div>
              {exercise.sets.map((setItem, setIndex) => (
                <div key={setItem.id} className="set-row">
                  <span>{setIndex + 1}</span>
                  <input
                    className="set-input"
                    type="number"
                    value={setItem.reps_fixed ?? ""}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, (current) => ({
                        ...current,
                        reps_fixed: event.target.value ? Number(event.target.value) : null,
                        reps_min: event.target.value ? null : current.reps_min,
                        reps_max: event.target.value ? null : current.reps_max,
                      }))
                    }
                    placeholder="10"
                  />
                  <input
                    className="set-input"
                    type="number"
                    value={setItem.reps_min ?? ""}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, (current) => ({
                        ...current,
                        reps_fixed: null,
                        reps_min: event.target.value ? Number(event.target.value) : null,
                      }))
                    }
                    placeholder="8"
                  />
                  <input
                    className="set-input"
                    type="number"
                    value={setItem.reps_max ?? ""}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, (current) => ({
                        ...current,
                        reps_fixed: null,
                        reps_max: event.target.value ? Number(event.target.value) : null,
                      }))
                    }
                    placeholder="12"
                  />
                  <input
                    className="set-input"
                    type="number"
                    step="0.25"
                    value={setItem.weight_kg ?? ""}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, (current) => ({
                        ...current,
                        weight_kg: event.target.value ? Number(event.target.value) : null,
                      }))
                    }
                    placeholder="70"
                  />
                  <input
                    className="set-input"
                    value={setItem.rest_mmss}
                    onChange={(event) =>
                      updateSet(exerciseIndex, setIndex, (current) => ({
                        ...current,
                        rest_mmss: event.target.value,
                      }))
                    }
                    placeholder="02:00"
                  />
                  <button className="action-pill" onClick={() => removeSet(exerciseIndex, setIndex)}>
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "12px" }}>
              <button className="tag" onClick={() => addSet(exerciseIndex)}>
                + Añadir serie
              </button>
            </div>
          </article>
        ))}
      </section>

      <div className="row" style={{ marginTop: "20px" }}>
        <button className="tag" onClick={addExercise}>
          + Añadir ejercicio
        </button>
        <button className="cta" onClick={startSession}>
          Iniciar sesion
        </button>
      </div>
    </>
  );
}
