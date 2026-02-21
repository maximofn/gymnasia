import { apiFetch } from "./api";

export type BodyMeasurement = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  circumferences_cm: Record<string, number>;
  notes: string | null;
  photo_asset_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type BodyMeasurementInput = {
  measured_at?: string;
  weight_kg?: number;
  circumferences_cm?: Record<string, number>;
  notes?: string;
  photo_asset_id?: string;
};

export async function listMeasurements(limit = 100): Promise<BodyMeasurement[]> {
  return apiFetch<BodyMeasurement[]>(`/measurements?limit=${limit}`, { auth: true });
}

export async function createMeasurement(input: BodyMeasurementInput): Promise<BodyMeasurement> {
  return apiFetch<BodyMeasurement>("/measurements", {
    method: "POST",
    auth: true,
    body: JSON.stringify(input),
  });
}

export async function patchMeasurement(measurementId: string, input: BodyMeasurementInput): Promise<BodyMeasurement> {
  return apiFetch<BodyMeasurement>(`/measurements/${measurementId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input),
  });
}

export async function deleteMeasurement(measurementId: string): Promise<void> {
  await apiFetch<void>(`/measurements/${measurementId}`, {
    method: "DELETE",
    auth: true,
  });
}
