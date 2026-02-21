import { apiFetch } from "./api";

export type SyncOpType = "upsert" | "delete";

export type SyncQueueItem = {
  id: string;
  entityType: string;
  entityId?: string;
  opType: SyncOpType;
  payload?: Record<string, unknown>;
  clientUpdatedAt: string;
};

const QUEUE_KEY = "gimnasia_sync_queue";
const DEVICE_ID_KEY = "gimnasia_device_id";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDeviceId(): string {
  if (!canUseStorage()) return "server";
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = randomId();
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export function readSyncQueue(): SyncQueueItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SyncQueueItem[];
  } catch {
    return [];
  }
}

function writeSyncQueue(queue: SyncQueueItem[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueSyncOperation(item: Omit<SyncQueueItem, "id" | "clientUpdatedAt">): SyncQueueItem {
  const entry: SyncQueueItem = {
    ...item,
    id: randomId(),
    clientUpdatedAt: new Date().toISOString(),
  };
  const current = readSyncQueue();
  current.push(entry);
  writeSyncQueue(current);
  return entry;
}

export async function flushSyncQueue(): Promise<void> {
  const queue = readSyncQueue();
  if (queue.length === 0) return;

  try {
    await apiFetch("/sync/operations/bulk", {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        device_id: getDeviceId(),
        operations: queue.map((item) => ({
          entity_type: item.entityType,
          entity_id: item.entityId,
          op_type: item.opType,
          payload: item.payload,
          client_updated_at: item.clientUpdatedAt,
        })),
      }),
    });
    writeSyncQueue([]);
  } catch {
    // Keep queue for next retry.
  }
}
