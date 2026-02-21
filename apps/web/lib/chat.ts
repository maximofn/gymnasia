import { apiFetch } from "./api";

export type ChatRole = "system" | "user" | "assistant";
export type AIProvider = "anthropic" | "openai" | "google";
export type MemoryDomain = "global" | "training" | "diet" | "measurements";

export type ChatThread = {
  id: string;
  title: string | null;
  message_count: number;
  last_message_preview: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  role: ChatRole;
  content: string;
  provider: AIProvider | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  safety_flags: Record<string, unknown> | null;
  created_at: string;
};

export type MemoryEntry = {
  id: string;
  domain: MemoryDomain;
  memory_key: string;
  memory_value: Record<string, unknown>;
  source_chat_message_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export async function listChatThreads(): Promise<ChatThread[]> {
  return apiFetch<ChatThread[]>("/chat/threads", { auth: true });
}

export async function createChatThread(title?: string): Promise<ChatThread> {
  return apiFetch<ChatThread>("/chat/threads", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ title: title ?? null }),
  });
}

export async function listChatMessages(threadId: string, limit = 200): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/chat/threads/${threadId}/messages?limit=${limit}`, { auth: true });
}

export async function sendChatMessage(threadId: string, content: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/chat/threads/${threadId}/messages`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ content }),
  });
}

export async function listMemory(domain?: MemoryDomain): Promise<MemoryEntry[]> {
  return apiFetch<MemoryEntry[]>(domain ? `/chat/memory?domain=${domain}` : "/chat/memory", { auth: true });
}

export async function upsertMemory(domain: MemoryDomain, key: string, value: Record<string, unknown>): Promise<MemoryEntry> {
  return apiFetch<MemoryEntry>(`/chat/memory/${domain}/${encodeURIComponent(key)}`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify({ value }),
  });
}

export async function deleteMemory(domain: MemoryDomain, key: string): Promise<void> {
  await apiFetch<void>(`/chat/memory/${domain}/${encodeURIComponent(key)}`, {
    method: "DELETE",
    auth: true,
  });
}
