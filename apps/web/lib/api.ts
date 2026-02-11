const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": DEV_USER_ID,
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type TrainingPlan = {
  id: string;
  name: string;
  description?: string | null;
  position: number;
  version: number;
};

export type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  instructions?: string | null;
  tags: string[];
};

export type TrainingSession = {
  id: string;
  plan_id?: string | null;
  started_at: string;
  finished_at?: string | null;
  should_update_template: boolean;
  notes?: string | null;
};

export type DailyDiet = {
  id: string;
  diet_date: string;
  name: string;
  phase?: string | null;
  notes?: string | null;
};

export type FoodItem = {
  id: string;
  name: string;
  unit: string;
  protein_per_100g: number;
  carbs_per_100g: number;
  fats_per_100g: number;
  calories_per_100g: number;
};

export type BodyMeasurement = {
  id: string;
  measured_at: string;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  chest_cm?: number | null;
  arm_cm?: number | null;
  thigh_cm?: number | null;
  notes?: string | null;
};

export type ChatThread = {
  id: string;
  section: "training" | "diet" | "measures" | "general";
  title: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: string | null;
  model?: string | null;
  created_at: string;
};

export const api = {
  listPlans: () => request<TrainingPlan[]>("/training/plans"),
  createPlan: (name: string, description?: string) =>
    request<TrainingPlan>("/training/plans", {
      method: "POST",
      body: JSON.stringify({ name, description })
    }),
  clonePlan: (planId: string) => request<TrainingPlan>(`/training/plans/${planId}/clone`, { method: "POST" }),
  deletePlan: (planId: string) => request<void>(`/training/plans/${planId}`, { method: "DELETE" }),
  startSession: (planId: string) =>
    request<TrainingSession>("/training/sessions/start", {
      method: "POST",
      body: JSON.stringify({ plan_id: planId })
    }),
  finishSession: (sessionId: string, shouldUpdateTemplate: boolean) =>
    request<TrainingSession>(`/training/sessions/${sessionId}/finish`, {
      method: "POST",
      body: JSON.stringify({ should_update_template: shouldUpdateTemplate })
    }),
  listExercises: (q?: string, muscleGroup?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (muscleGroup) params.set("muscle_group", muscleGroup);
    const query = params.toString();
    return request<Exercise[]>(`/training/exercises${query ? `?${query}` : ""}`);
  },
  createExercise: (payload: {
    name: string;
    muscle_group: string;
    equipment: string;
    instructions?: string;
    tags?: string[];
  }) =>
    request<Exercise>("/training/exercises", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  listDailyDiets: () => request<DailyDiet[]>("/diet/daily-diets"),
  createDailyDiet: (payload: { diet_date: string; name: string; phase?: string; notes?: string }) =>
    request<DailyDiet>("/diet/daily-diets", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  listFoods: () => request<FoodItem[]>("/diet/foods"),
  createFood: (payload: {
    name: string;
    unit: string;
    protein_per_100g: number;
    carbs_per_100g: number;
    fats_per_100g: number;
    calories_per_100g: number;
  }) =>
    request<FoodItem>("/diet/foods", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  listBodyMeasurements: () => request<BodyMeasurement[]>("/measures/body"),
  createBodyMeasurement: (payload: {
    measured_at: string;
    weight_kg?: number;
    body_fat_pct?: number;
    waist_cm?: number;
    hip_cm?: number;
    chest_cm?: number;
    arm_cm?: number;
    thigh_cm?: number;
    notes?: string;
  }) =>
    request<BodyMeasurement>("/measures/body", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  listThreads: (section: "training" | "diet" | "measures" | "general") => request<ChatThread[]>(`/chat/threads?section=${section}`),
  createThread: (section: "training" | "diet" | "measures" | "general", title: string) =>
    request<ChatThread>("/chat/threads", {
      method: "POST",
      body: JSON.stringify({ section, title })
    }),
  listMessages: (threadId: string) => request<ChatMessage[]>(`/chat/threads/${threadId}/messages`),
  sendMessage: (threadId: string, content: string) =>
    request<ChatMessage[]>(`/chat/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    }),

  async sendAudio(threadId: string, audio: File): Promise<{ transcript: string }> {
    const formData = new FormData();
    formData.append("audio", audio);

    const response = await fetch(`${API_URL}/chat/threads/${threadId}/audio`, {
      method: "POST",
      headers: {
        "x-user-id": DEV_USER_ID
      },
      body: formData,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }
};
