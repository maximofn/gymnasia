export const TOOL_OPERATION_RECEIPT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const TOOL_OPERATION_RECEIPT_MAX_ENTRIES = 256;

export type ToolOperationReceipt = {
  operationId: string;
  toolName: string;
  committedAt: number;
};

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function isToolOperationReceipt(value: unknown): value is ToolOperationReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const receipt = value as Partial<ToolOperationReceipt>;
  return (
    Object.keys(receipt).length === 3
    && Object.keys(receipt).every(
      (key) => ["operationId", "toolName", "committedAt"].includes(key),
    )
    && isSha256(receipt.operationId)
    && typeof receipt.toolName === "string"
    && receipt.toolName.length > 0
    && typeof receipt.committedAt === "number"
    && Number.isFinite(receipt.committedAt)
  );
}

export function normalizeToolOperationReceipts(
  value: unknown,
  now = Date.now(),
): ToolOperationReceipt[] {
  if (!Array.isArray(value)) return [];
  const byOperation = new Map<string, ToolOperationReceipt>();
  for (const candidate of value) {
    if (!isToolOperationReceipt(candidate)) continue;
    if (candidate.committedAt + TOOL_OPERATION_RECEIPT_TTL_MS <= now) continue;
    const current = byOperation.get(candidate.operationId);
    if (!current || candidate.committedAt >= current.committedAt) {
      byOperation.set(candidate.operationId, { ...candidate });
    }
  }
  return [...byOperation.values()]
    .sort((left, right) => left.committedAt - right.committedAt)
    .slice(-TOOL_OPERATION_RECEIPT_MAX_ENTRIES);
}

export function appendToolOperationReceipt(
  value: unknown,
  operationId: string | undefined,
  toolName: string,
  now = Date.now(),
): ToolOperationReceipt[] {
  const receipts = normalizeToolOperationReceipts(value, now);
  if (!isSha256(operationId)) return receipts;
  const withoutCurrent = receipts.filter((receipt) => receipt.operationId !== operationId);
  return [
    ...withoutCurrent,
    { operationId, toolName, committedAt: now },
  ].slice(-TOOL_OPERATION_RECEIPT_MAX_ENTRIES);
}

export function hasToolOperationReceipt(
  value: unknown,
  operationId: string,
  toolName: string,
  now = Date.now(),
): boolean {
  return normalizeToolOperationReceipts(value, now).some(
    (receipt) => receipt.operationId === operationId && receipt.toolName === toolName,
  );
}

export function canProveToolOperationReceiptAbsent(
  value: unknown,
  preparedAt: number,
  now = Date.now(),
): boolean {
  if (!Number.isFinite(preparedAt) || preparedAt > now) return false;
  if (preparedAt + TOOL_OPERATION_RECEIPT_TTL_MS <= now) return false;
  const receipts = normalizeToolOperationReceipts(value, now);
  if (receipts.length < TOOL_OPERATION_RECEIPT_MAX_ENTRIES) return true;
  return receipts[0]?.committedAt < preparedAt;
}
