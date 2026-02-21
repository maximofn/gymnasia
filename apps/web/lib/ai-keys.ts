import { apiFetch } from "./api";

export type AIProvider = "anthropic" | "openai" | "google";

export type AIKeyRecord = {
  provider: AIProvider;
  key_fingerprint: string;
  is_active: boolean;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AIKeyTestResponse = {
  provider: AIProvider;
  success: boolean;
  tested_at: string;
  message: string;
};

export async function listAIKeys(): Promise<AIKeyRecord[]> {
  return apiFetch<AIKeyRecord[]>("/ai-keys", { auth: true });
}

export async function upsertAIKey(provider: AIProvider, apiKey: string): Promise<AIKeyRecord> {
  return apiFetch<AIKeyRecord>("/ai-keys", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ provider, api_key: apiKey }),
  });
}

export async function rotateAIKey(provider: AIProvider, apiKey: string): Promise<AIKeyRecord> {
  return apiFetch<AIKeyRecord>(`/ai-keys/${provider}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ api_key: apiKey }),
  });
}

export async function deleteAIKey(provider: AIProvider): Promise<void> {
  await apiFetch<void>(`/ai-keys/${provider}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function testAIKey(provider: AIProvider): Promise<AIKeyTestResponse> {
  return apiFetch<AIKeyTestResponse>("/ai-keys/test", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ provider }),
  });
}

export function hasAnyActiveAIKey(keys: AIKeyRecord[]): boolean {
  return keys.some((key) => key.is_active);
}
