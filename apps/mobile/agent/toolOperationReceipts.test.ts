import { describe, expect, it } from "vitest";

import {
  TOOL_OPERATION_RECEIPT_MAX_ENTRIES,
  TOOL_OPERATION_RECEIPT_TTL_MS,
  appendToolOperationReceipt,
  canProveToolOperationReceiptAbsent,
  hasToolOperationReceipt,
  normalizeToolOperationReceipts,
} from "./toolOperationReceipts";

const operationId = "a".repeat(64);

describe("recibos duraderos de operaciones", () => {
  it("añade, detecta y deduplica una operación sin guardar su contenido", () => {
    const first = appendToolOperationReceipt([], operationId, "write_measurement", 1_000);
    const second = appendToolOperationReceipt(first, operationId, "write_measurement", 2_000);

    expect(second).toEqual([{
      operationId,
      toolName: "write_measurement",
      committedAt: 2_000,
    }]);
    expect(hasToolOperationReceipt(second, operationId, "write_measurement", 2_000)).toBe(true);
    expect(JSON.stringify(second)).not.toMatch(/args|output|content/i);
  });

  it("descarta entradas inválidas o caducadas y aplica el máximo", () => {
    const now = TOOL_OPERATION_RECEIPT_TTL_MS + 10_000;
    const receipts = [
      { operationId: "invalid", toolName: "write_measurement", committedAt: now },
      {
        operationId: "c".repeat(64),
        toolName: "write_measurement",
        committedAt: now,
        content: "no debe caber en un recibo",
      },
      { operationId: "b".repeat(64), toolName: "write_measurement", committedAt: 1 },
      ...Array.from({ length: TOOL_OPERATION_RECEIPT_MAX_ENTRIES + 3 }, (_, index) => ({
        operationId: index.toString(16).padStart(64, "0"),
        toolName: "add_meal_food",
        committedAt: now + index,
      })),
    ];

    const normalized = normalizeToolOperationReceipts(receipts, now);
    expect(normalized).toHaveLength(TOOL_OPERATION_RECEIPT_MAX_ENTRIES);
    expect(normalized.some((receipt) => receipt.operationId === "b".repeat(64))).toBe(false);
  });

  it("solo demuestra ausencia mientras el recibo no pudo caducar ni ser expulsado", () => {
    const now = TOOL_OPERATION_RECEIPT_TTL_MS + 10_000;
    expect(canProveToolOperationReceiptAbsent([], now - 1, now)).toBe(true);
    expect(canProveToolOperationReceiptAbsent(
      [],
      now - TOOL_OPERATION_RECEIPT_TTL_MS,
      now,
    )).toBe(false);

    const fullRecent = Array.from(
      { length: TOOL_OPERATION_RECEIPT_MAX_ENTRIES },
      (_, index) => ({
        operationId: index.toString(16).padStart(64, "0"),
        toolName: "add_meal_food",
        committedAt: now - 1_000 + index,
      }),
    );
    expect(canProveToolOperationReceiptAbsent(fullRecent, now - 1_001, now)).toBe(false);
    expect(canProveToolOperationReceiptAbsent(fullRecent, now - 500, now)).toBe(true);
    expect(canProveToolOperationReceiptAbsent([], now + 1, now)).toBe(false);
  });
});
