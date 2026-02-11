export type Section = "training" | "diet" | "measures" | "general";

export type TrainingPlan = {
  id: string;
  name: string;
  description?: string | null;
  position: number;
  version: number;
};

export type DailyDiet = {
  id: string;
  diet_date: string;
  name: string;
  phase?: string | null;
};

export type BodyMeasurement = {
  id: string;
  measured_at: string;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
};

export type ChatThread = {
  id: string;
  section: Section;
  title: string;
  created_at: string;
};
