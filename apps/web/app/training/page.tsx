"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { SectionChat } from "@/components/section-chat";
import { api, Exercise, TrainingPlan, TrainingSession } from "@/lib/api";

const muscleGroups = ["pecho", "espalda", "hombro", "biceps", "triceps", "pierna", "core", "cardio"];

export default function TrainingPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<TrainingSession | null>(null);

  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanDescription, setNewPlanDescription] = useState("");

  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseMuscle, setNewExerciseMuscle] = useState("pecho");
  const [newExerciseEquipment, setNewExerciseEquipment] = useState("maquina");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseFilterMuscle, setExerciseFilterMuscle] = useState("");

  const activePlanName = useMemo(() => {
    if (!activeSession?.plan_id) {
      return null;
    }
    return plans.find((plan) => plan.id === activeSession.plan_id)?.name ?? "Entrenamiento";
  }, [activeSession, plans]);

  async function loadData() {
    try {
      setLoading(true);
      const [plansResponse, exercisesResponse] = await Promise.all([api.listPlans(), api.listExercises()]);
      setPlans(plansResponse);
      setExercises(exercisesResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Entrenamiento");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreatePlan(event: FormEvent) {
    event.preventDefault();
    if (!newPlanName.trim()) return;

    try {
      await api.createPlan(newPlanName.trim(), newPlanDescription.trim() || undefined);
      setNewPlanName("");
      setNewPlanDescription("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear entrenamiento");
    }
  }

  async function handleClonePlan(planId: string) {
    try {
      await api.clonePlan(planId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo clonar entrenamiento");
    }
  }

  async function handleDeletePlan(planId: string) {
    try {
      await api.deletePlan(planId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar entrenamiento");
    }
  }

  async function handleStartSession(planId: string) {
    try {
      const session = await api.startSession(planId);
      setActiveSession(session);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion");
    }
  }

  async function handleFinishSession(updateTemplate: boolean) {
    if (!activeSession) return;

    try {
      const session = await api.finishSession(activeSession.id, updateTemplate);
      setActiveSession(session);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar sesion");
    }
  }

  async function handleCreateExercise(event: FormEvent) {
    event.preventDefault();
    if (!newExerciseName.trim()) return;

    try {
      await api.createExercise({
        name: newExerciseName.trim(),
        muscle_group: newExerciseMuscle,
        equipment: newExerciseEquipment,
        tags: []
      });
      setNewExerciseName("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear ejercicio");
    }
  }

  async function handleFilterExercises() {
    try {
      const data = await api.listExercises(exerciseQuery || undefined, exerciseFilterMuscle || undefined);
      setExercises(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo filtrar ejercicios");
    }
  }

  if (loading) {
    return <div className="panel">Cargando modulo de entrenamiento...</div>;
  }

  return (
    <section className="grid" style={{ gap: "1rem" }}>
      <div className="panel" style={{ display: "grid", gap: ".6rem" }}>
        <h2>Entrenamiento</h2>
        <p>Plantillas + sesiones realizadas. Al cerrar sesion decides si actualizas la plantilla o solo guardas el dia.</p>
        {error && <p style={{ color: "#a53e2b" }}>{error}</p>}
      </div>

      {activeSession && !activeSession.finished_at && (
        <div className="panel" style={{ display: "grid", gap: ".7rem", borderColor: "#0f5f3f" }}>
          <div className="row">
            <div>
              <h3>Sesion activa</h3>
              <p>
                {activePlanName ?? "Entrenamiento"} | Inicio {new Date(activeSession.started_at).toLocaleTimeString("es-ES")}
              </p>
            </div>
            <div className="pill" style={{ width: "fit-content" }}>
              Temporizador de descanso disponible en flujo de series
            </div>
          </div>
          <div className="row">
            <button onClick={() => void handleFinishSession(false)} className="secondary">
              Guardar solo hoy
            </button>
            <button onClick={() => void handleFinishSession(true)}>Actualizar plantilla</button>
          </div>
        </div>
      )}

      <div className="grid two">
        <form className="panel" onSubmit={handleCreatePlan} style={{ display: "grid", gap: ".6rem" }}>
          <h3>Nuevo entrenamiento</h3>
          <input
            placeholder="Nombre del entrenamiento"
            value={newPlanName}
            onChange={(event) => setNewPlanName(event.target.value)}
            required
          />
          <textarea
            placeholder="Descripcion opcional"
            value={newPlanDescription}
            onChange={(event) => setNewPlanDescription(event.target.value)}
          />
          <button type="submit">Crear entrenamiento</button>
        </form>

        <div className="panel" style={{ display: "grid", gap: ".6rem" }}>
          <h3>Entrenamientos guardados</h3>
          <div className="list">
            {plans.length === 0 && <p>No hay entrenamientos todavia.</p>}
            {plans.map((plan) => (
              <article className="item" key={plan.id}>
                <div className="row" style={{ alignItems: "center" }}>
                  <div>
                    <strong>{plan.name}</strong>
                    <p style={{ margin: "0.2rem 0 0" }}>Version {plan.version}</p>
                  </div>
                  <div className="pill" style={{ width: "fit-content" }}>
                    Posicion {plan.position}
                  </div>
                </div>
                <div className="row" style={{ marginTop: ".5rem" }}>
                  <button onClick={() => void handleStartSession(plan.id)}>Realizar</button>
                  <button className="secondary" onClick={() => void handleClonePlan(plan.id)}>
                    Clonar
                  </button>
                  <button className="danger" onClick={() => void handleDeletePlan(plan.id)}>
                    Borrar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="grid two">
        <form className="panel" onSubmit={handleCreateExercise} style={{ display: "grid", gap: ".6rem" }}>
          <h3>Biblioteca de ejercicios</h3>
          <input
            placeholder="Nombre del ejercicio"
            value={newExerciseName}
            onChange={(event) => setNewExerciseName(event.target.value)}
            required
          />
          <div className="row">
            <select value={newExerciseMuscle} onChange={(event) => setNewExerciseMuscle(event.target.value)}>
              {muscleGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <input
              placeholder="Equipo (maquina, barra...)"
              value={newExerciseEquipment}
              onChange={(event) => setNewExerciseEquipment(event.target.value)}
            />
          </div>
          <button type="submit">Crear ejercicio</button>
        </form>

        <div className="panel" style={{ display: "grid", gap: ".6rem" }}>
          <h3>Buscar ejercicio</h3>
          <div className="row">
            <input
              placeholder="Filtrar por nombre"
              value={exerciseQuery}
              onChange={(event) => setExerciseQuery(event.target.value)}
            />
            <select value={exerciseFilterMuscle} onChange={(event) => setExerciseFilterMuscle(event.target.value)}>
              <option value="">Todos los grupos</option>
              {muscleGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
            <button onClick={() => void handleFilterExercises()}>Filtrar</button>
          </div>
          <div className="list">
            {exercises.map((exercise) => (
              <article className="item" key={exercise.id}>
                <strong>{exercise.name}</strong>
                <p style={{ margin: "0.3rem 0" }}>
                  {exercise.muscle_group} | {exercise.equipment}
                </p>
                <div className="row">
                  <button className="secondary">Foto maquina</button>
                  <button className="secondary">Generar imagen (nano banana)</button>
                  <button className="secondary">Generar video (veo3)</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <SectionChat section="training" />
    </section>
  );
}
