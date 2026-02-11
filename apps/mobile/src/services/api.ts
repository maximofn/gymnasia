const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": DEV_USER_ID,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type TrainingPlan = {
  id: string;
  name: string;
  version: number;
  position: number;
};

export type DailyDiet = {
  id: string;
  diet_date: string;
  name: string;
};

export type BodyMeasurement = {
  id: string;
  measured_at: string;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
};

export type ChatThread = {
  id: string;
  section: "training" | "diet" | "measures" | "general";
  title: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export const api = {
  listPlans: () => request<TrainingPlan[]>("/training/plans"),
  createPlan: (name: string) =>
    request<TrainingPlan>("/training/plans", {
      method: "POST",
      body: JSON.stringify({ name })
    }),

  listDailyDiets: () => request<DailyDiet[]>("/diet/daily-diets"),
  createDailyDiet: (dietDate: string, name: string) =>
    request<DailyDiet>("/diet/daily-diets", {
      method: "POST",
      body: JSON.stringify({ diet_date: dietDate, name })
    }),

  listMeasurements: () => request<BodyMeasurement[]>("/measures/body"),
  createMeasurement: (payload: { measured_at: string; weight_kg?: number; body_fat_pct?: number }) =>
    request<BodyMeasurement>("/measures/body", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  listThreads: (section: "training" | "diet" | "measures") => request<ChatThread[]>(`/chat/threads?section=${section}`),
  createThread: (section: "training" | "diet" | "measures", title: string) =>
    request<ChatThread>("/chat/threads", {
      method: "POST",
      body: JSON.stringify({ section, title })
    }),
  listMessages: (threadId: string) => request<ChatMessage[]>(`/chat/threads/${threadId}/messages`),
  sendMessage: (threadId: string, content: string) =>
    request<ChatMessage[]>(`/chat/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    })
};
