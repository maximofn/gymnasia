export type AIProvider = "anthropic" | "openai" | "google";

export type WorkoutSet = {
  repsFixed?: number;
  repsMin?: number;
  repsMax?: number;
  restMMSS: string;
  weightKg?: number;
};

export type GoalDomain = "training" | "diet" | "body" | "wellness";

export * from "./design-tokens";
