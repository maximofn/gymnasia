import { apiFetch, ApiError } from "./api";

export type WorkoutSet = {
  id: string;
  position: number;
  reps_fixed: number | null;
  reps_min: number | null;
  reps_max: number | null;
  rest_mmss: string;
  weight_kg: number | null;
  inherited_from_last_session?: boolean | null;
};

export type WorkoutExercise = {
  id: string;
  position: number;
  exercise_name_snapshot: string;
  muscle_group_snapshot: string | null;
  notes: string | null;
  sets: WorkoutSet[];
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  notes: string | null;
  position: number;
  is_archived: boolean;
  exercises: WorkoutExercise[];
};

export type WorkoutSession = {
  id: string;
  template_id: string | null;
  status: "in_progress" | "finished";
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  applied_changes_to_template: boolean;
  exercises: WorkoutExercise[];
};

export type WorkoutSetPayload = {
  reps_fixed?: number;
  reps_min?: number;
  reps_max?: number;
  rest_mmss: string;
  weight_kg?: number;
};

export type WorkoutExercisePayload = {
  exercise_name_snapshot: string;
  muscle_group_snapshot?: string;
  notes?: string;
  sets: WorkoutSetPayload[];
};

export type WorkoutTemplateCreatePayload = {
  name: string;
  notes?: string;
  exercises?: WorkoutExercisePayload[];
};

export function formatReps(setItem: WorkoutSet): string {
  if (setItem.reps_fixed !== null && setItem.reps_fixed !== undefined) {
    return `${setItem.reps_fixed}`;
  }
  if (setItem.reps_min !== null && setItem.reps_max !== null && setItem.reps_min !== undefined && setItem.reps_max !== undefined) {
    return `${setItem.reps_min}-${setItem.reps_max}`;
  }
  return "-";
}

export function toSetPayload(setItem: WorkoutSet): WorkoutSetPayload {
  const payload: WorkoutSetPayload = {
    rest_mmss: setItem.rest_mmss || "02:00",
  };

  if (setItem.reps_fixed !== null && setItem.reps_fixed !== undefined) {
    payload.reps_fixed = setItem.reps_fixed;
  } else if (
    setItem.reps_min !== null &&
    setItem.reps_min !== undefined &&
    setItem.reps_max !== null &&
    setItem.reps_max !== undefined
  ) {
    payload.reps_min = setItem.reps_min;
    payload.reps_max = setItem.reps_max;
  } else {
    payload.reps_fixed = 10;
  }

  if (setItem.weight_kg !== null && setItem.weight_kg !== undefined) {
    payload.weight_kg = setItem.weight_kg;
  }

  return payload;
}

export function toExercisePayload(exercise: WorkoutExercise): WorkoutExercisePayload {
  return {
    exercise_name_snapshot: exercise.exercise_name_snapshot,
    muscle_group_snapshot: exercise.muscle_group_snapshot ?? undefined,
    notes: exercise.notes ?? undefined,
    sets: exercise.sets.map(toSetPayload),
  };
}

export async function listWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  return apiFetch<WorkoutTemplate[]>("/workouts/templates", { auth: true });
}

export async function createWorkoutTemplate(payload: WorkoutTemplateCreatePayload): Promise<WorkoutTemplate> {
  return apiFetch<WorkoutTemplate>("/workouts/templates", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function patchWorkoutTemplate(templateId: string, exercises: WorkoutExercise[]): Promise<WorkoutTemplate> {
  return apiFetch<WorkoutTemplate>(`/workouts/templates/${templateId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ exercises: exercises.map(toExercisePayload) }),
  });
}

export async function cloneWorkoutTemplate(templateId: string): Promise<WorkoutTemplate> {
  return apiFetch<WorkoutTemplate>(`/workouts/templates/${templateId}/clone`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({}),
  });
}

export async function reorderWorkoutTemplates(templateIds: string[]): Promise<void> {
  await apiFetch<void>("/workouts/templates/reorder", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ template_ids: templateIds }),
  });
}

export async function deleteWorkoutTemplate(templateId: string): Promise<void> {
  await apiFetch<void>(`/workouts/templates/${templateId}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function startWorkoutSession(templateId: string): Promise<WorkoutSession> {
  return apiFetch<WorkoutSession>(`/workouts/templates/${templateId}/start-session`, {
    method: "POST",
    auth: true,
  });
}

export async function listWorkoutSessions(limit = 100): Promise<WorkoutSession[]> {
  return apiFetch<WorkoutSession[]>(`/workouts/sessions?limit=${limit}`, { auth: true });
}

export async function patchWorkoutSession(sessionId: string, exercises: WorkoutExercise[], notes: string | null): Promise<WorkoutSession> {
  return apiFetch<WorkoutSession>(`/workouts/sessions/${sessionId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({
      notes: notes ?? undefined,
      exercises: exercises.map(toExercisePayload),
    }),
  });
}

export async function finishWorkoutSession(sessionId: string, notes: string | null): Promise<WorkoutSession> {
  return apiFetch<WorkoutSession>(`/workouts/sessions/${sessionId}/finish`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ notes: notes ?? undefined }),
  });
}

export async function applyWorkoutTemplateUpdates(sessionId: string): Promise<WorkoutTemplate> {
  return apiFetch<WorkoutTemplate>(`/workouts/sessions/${sessionId}/apply-template-updates`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ confirm: true }),
  });
}

export function mockTemplate(templateId: string): WorkoutTemplate {
  return {
    id: templateId,
    name: "Tren Superior — Fuerza",
    notes: "Plantilla mock local",
    position: 0,
    is_archived: false,
    exercises: [
      {
        id: "ex-1",
        position: 0,
        exercise_name_snapshot: "Press de banca",
        muscle_group_snapshot: "Pecho",
        notes: null,
        sets: [
          { id: "s-1", position: 0, reps_fixed: 12, reps_min: null, reps_max: null, rest_mmss: "02:00", weight_kg: 70 },
          { id: "s-2", position: 1, reps_fixed: 10, reps_min: null, reps_max: null, rest_mmss: "02:00", weight_kg: 72.5 },
          { id: "s-3", position: 2, reps_fixed: null, reps_min: 8, reps_max: 10, rest_mmss: "02:00", weight_kg: 75 },
        ],
      },
      {
        id: "ex-2",
        position: 1,
        exercise_name_snapshot: "Press militar",
        muscle_group_snapshot: "Hombro",
        notes: null,
        sets: [
          { id: "s-4", position: 0, reps_fixed: 10, reps_min: null, reps_max: null, rest_mmss: "01:45", weight_kg: 40 },
          { id: "s-5", position: 1, reps_fixed: 8, reps_min: null, reps_max: null, rest_mmss: "01:45", weight_kg: 42.5 },
        ],
      },
    ],
  };
}

export function mockSession(sessionId: string): WorkoutSession {
  const template = mockTemplate("r1");
  return {
    id: sessionId,
    template_id: "r1",
    status: "in_progress",
    started_at: new Date().toISOString(),
    ended_at: null,
    notes: null,
    applied_changes_to_template: false,
    exercises: template.exercises,
  };
}

export { ApiError };
