import { apiFetch } from "./api";

export type GoalDomain = "training" | "diet" | "body" | "wellness";

export type Goal = {
  id: string;
  title: string;
  domain: GoalDomain;
  target_value: number | null;
  target_unit: string | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type GoalUpsertPayload = {
  title: string;
  domain: GoalDomain;
  target_value?: number;
  target_unit?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
};

export async function getActiveGoal(): Promise<Goal | null> {
  return apiFetch<Goal | null>("/goals/active", { auth: true });
}

export async function upsertActiveGoal(payload: GoalUpsertPayload): Promise<Goal> {
  return apiFetch<Goal>("/goals/active", {
    method: "PUT",
    auth: true,
    body: JSON.stringify(payload),
  });
}
