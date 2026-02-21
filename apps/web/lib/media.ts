import { apiFetch } from "./api";

export type MediaKind =
  | "diet_photo"
  | "diet_label"
  | "diet_menu"
  | "exercise_machine_photo"
  | "exercise_generated_image"
  | "exercise_generated_video"
  | "measurement_photo";

export type MediaStatus = "uploaded" | "processing" | "ready" | "failed" | "deleted";

export type MediaAsset = {
  id: string;
  kind: MediaKind;
  status: MediaStatus;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  retention_delete_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UploadIntentResponse = {
  asset: MediaAsset;
  upload_url: string;
  signed_read_url: string;
};

export type DietPhotoEstimateResponse = {
  provider: "anthropic" | "openai" | "google";
  confidence_percent: number;
  meal_type: "breakfast" | "lunch" | "snack" | "dinner" | "other";
  day_date: string;
  item: {
    id: string;
    name: string;
    grams: number | null;
    serving_count: number | null;
    calories_kcal: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    calories_protein_kcal: number | null;
    calories_carbs_kcal: number | null;
    calories_fat_kcal: number | null;
    created_by_ai: boolean;
  };
};

export type ExerciseMediaLink = {
  id: string;
  exercise_name: string;
  machine_photo_asset_id: string | null;
  generated_image_asset_id: string | null;
  generated_video_asset_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BackgroundJob = {
  id: string;
  type:
    | "diet_photo_estimation"
    | "exercise_image_generation"
    | "exercise_video_generation"
    | "data_export";
  status: "queued" | "running" | "done" | "failed" | "canceled";
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
  run_after: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function createUploadIntent(kind: MediaKind, fileName?: string): Promise<UploadIntentResponse> {
  return apiFetch<UploadIntentResponse>("/media/uploads/intents", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ kind, file_name: fileName ?? null }),
  });
}

export async function estimateDietFromPhoto(payload: {
  asset_id: string;
  day_date: string;
  meal_type: "breakfast" | "lunch" | "snack" | "dinner" | "other";
  item_name_override?: string;
}): Promise<DietPhotoEstimateResponse> {
  return apiFetch<DietPhotoEstimateResponse>("/media/diet/estimate", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function listExerciseMediaLinks(): Promise<ExerciseMediaLink[]> {
  return apiFetch<ExerciseMediaLink[]>("/media/exercise-links", { auth: true });
}

export async function createExerciseMediaLink(payload: {
  exercise_name: string;
  machine_photo_asset_id?: string;
}): Promise<ExerciseMediaLink> {
  return apiFetch<ExerciseMediaLink>("/media/exercise-links", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function generateExerciseImage(linkId: string, prompt?: string): Promise<BackgroundJob> {
  return apiFetch<BackgroundJob>(`/media/exercise-links/${linkId}/generate-image`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ prompt: prompt ?? null }),
  });
}

export async function generateExerciseVideo(linkId: string, prompt?: string): Promise<BackgroundJob> {
  return apiFetch<BackgroundJob>(`/media/exercise-links/${linkId}/generate-video`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ prompt: prompt ?? null }),
  });
}

export async function listMediaJobs(): Promise<BackgroundJob[]> {
  return apiFetch<BackgroundJob[]>("/media/jobs", { auth: true });
}
