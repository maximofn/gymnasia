"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ApiError } from "../lib/api";
import { getDietDay, getTodayISODate, sumDayCalories } from "../lib/diet";
import { getActiveGoal } from "../lib/goals";
import { listMeasurements } from "../lib/measurements";
import { listWorkoutSessions, listWorkoutTemplates, type WorkoutSession } from "../lib/workouts";

type HomeExerciseItem = {
  id: string;
  name: string;
  meta: string;
};

type DashboardData = {
  caloriesConsumed: number;
  caloriesTarget: number;
  weightKg: number | null;
  weightDeltaKg: number | null;
  streakDays: number;
  templateCount: number;
  exercisesToday: HomeExerciseItem[];
  activeGoalTitle: string | null;
};

function toDayKey(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDay(dayKey: string, delta: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  const nextYear = date.getFullYear();
  const nextMonth = `${date.getMonth() + 1}`.padStart(2, "0");
  const nextDay = `${date.getDate()}`.padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function computeWorkoutStreak(sessions: WorkoutSession[]): number {
  const finishedDays = Array.from(
    new Set(
      sessions
        .filter((session) => session.status === "finished")
        .map((session) => toDayKey(session.ended_at ?? session.started_at))
    )
  ).sort((a, b) => (a < b ? 1 : -1));

  if (finishedDays.length === 0) return 0;

  let streak = 1;
  let cursor = finishedDays[0];

  for (let index = 1; index < finishedDays.length; index += 1) {
    const expected = shiftDay(cursor, -1);
    if (finishedDays[index] !== expected) break;
    streak += 1;
    cursor = finishedDays[index];
  }

  return streak;
}

function extractExercisesToday(sessions: WorkoutSession[]): HomeExerciseItem[] {
  const todayKey = getTodayISODate();
  const candidate = sessions.find((session) => {
    const dayKey = toDayKey(session.ended_at ?? session.started_at);
    return dayKey === todayKey;
  });

  if (!candidate) return [];

  return candidate.exercises.slice(0, 3).map((exercise) => {
    const setsCount = exercise.sets.length;
    const maxWeight = exercise.sets.reduce<number | null>((acc, setItem) => {
      if (setItem.weight_kg === null || setItem.weight_kg === undefined) return acc;
      if (acc === null) return setItem.weight_kg;
      return Math.max(acc, setItem.weight_kg);
    }, null);

    return {
      id: exercise.id,
      name: exercise.exercise_name_snapshot,
      meta: `${setsCount} series${maxWeight !== null ? ` • ${maxWeight} kg` : ""}`,
    };
  });
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>({
    caloriesConsumed: 0,
    caloriesTarget: 2400,
    weightKg: null,
    weightDeltaKg: null,
    streakDays: 0,
    templateCount: 0,
    exercisesToday: [],
    activeGoalTitle: null,
  });

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const today = getTodayISODate();
        const [dietDay, measurements, sessions, templates, goal] = await Promise.all([
          getDietDay(today),
          listMeasurements(30),
          listWorkoutSessions(120),
          listWorkoutTemplates(),
          getActiveGoal(),
        ]);

        if (!mounted) return;

        const latestWeight = measurements[0]?.weight_kg ?? null;
        const previousWeight = measurements[1]?.weight_kg ?? null;

        setData({
          caloriesConsumed: dietDay ? sumDayCalories(dietDay) : 0,
          caloriesTarget: 2400,
          weightKg: latestWeight,
          weightDeltaKg:
            latestWeight !== null && latestWeight !== undefined && previousWeight !== null && previousWeight !== undefined
              ? latestWeight - previousWeight
              : null,
          streakDays: computeWorkoutStreak(sessions),
          templateCount: templates.length,
          exercisesToday: extractExercisesToday(sessions),
          activeGoalTitle: goal?.title ?? null,
        });
      } catch (err) {
        if (!mounted) return;

        if (err instanceof ApiError && err.status === 401) {
          setError("Necesitas iniciar sesion para cargar tu resumen.");
        } else {
          setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const weightDeltaClass = useMemo(() => {
    if (data.weightDeltaKg === null) return "stat-value small";
    return data.weightDeltaKg <= 0 ? "stat-value small value-success" : "stat-value small";
  }, [data.weightDeltaKg]);

  return (
    <>
      <p className="page-subtitle">Buenos dias</p>
      <h1 className="page-title">Tu Resumen de Hoy</h1>

      {error ? <p className="status-message error">{error}</p> : null}

      <section className="hero-image" aria-label="Hero" />

      <section className="grid-3" aria-label="Kpis diarios">
        <article className="stat-card">
          <p className="stat-label">Calorias del dia</p>
          <p className="stat-value small">
            {data.caloriesConsumed.toFixed(0)} / {data.caloriesTarget.toFixed(0)}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Peso actual</p>
          <p className="stat-value small">{data.weightKg !== null ? `${data.weightKg.toFixed(2)} kg` : "-"}</p>
          <p className={weightDeltaClass}>
            {data.weightDeltaKg !== null ? `${data.weightDeltaKg > 0 ? "+" : ""}${data.weightDeltaKg.toFixed(2)} kg` : "Sin delta"}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Racha actual</p>
          <p className="stat-value small">{data.streakDays} dias seguidos</p>
        </article>
      </section>

      <section className="section-card">
        <div className="row section-heading-wrap">
          <h2>Acceso rapido</h2>
          <Link href="/training" className="cta cta-link">
            Iniciar entrenamiento
          </Link>
        </div>

        {data.activeGoalTitle ? (
          <p className="routine-meta" style={{ marginTop: "12px" }}>
            Objetivo activo: {data.activeGoalTitle}
          </p>
        ) : null}

        <div className="home-quick-grid">
          <Link href="/training" className="action-pill">
            Entrenamiento ({data.templateCount})
          </Link>
          <Link href="/diet" className="action-pill">
            Dieta
          </Link>
          <Link href="/measurements" className="action-pill">
            Medidas
          </Link>
          <Link href="/chat" className="action-pill">
            Chat IA
          </Link>
        </div>
      </section>

      <section className="section-card">
        <div className="row section-heading-wrap">
          <h2>Ejercicios de Hoy</h2>
          <Link href="/training" className="action-pill">
            Ver rutinas
          </Link>
        </div>

        {loading ? (
          <div className="state-loading-list" style={{ marginTop: "12px" }}>
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        ) : data.exercisesToday.length === 0 ? (
          <p className="state-text" style={{ marginTop: "12px" }}>
            No hay ejercicios registrados hoy.
          </p>
        ) : (
          <div className="home-exercise-list">
            {data.exercisesToday.map((exercise) => (
              <article key={exercise.id} className="home-exercise-item">
                <p className="info-title">{exercise.name}</p>
                <p className="routine-meta">{exercise.meta}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
