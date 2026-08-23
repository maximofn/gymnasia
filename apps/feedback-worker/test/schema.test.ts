import { describe, expect, it } from "vitest";
import { REPORT_SUMMARY_MAX_LENGTH, SUMMARY_MAX_LENGTH, TITLE_MAX_LENGTH } from "../src/contract";
import { validateFeedbackRequest } from "../src/schema";

const validKey = `v1:feature:${"a".repeat(16)}`;

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    kind: "feature",
    title: "Poder exportar la dieta a PDF",
    summary: "El usuario quiere exportar su dieta semanal a un PDF imprimible.",
    idempotency_key: validKey,
    ...overrides,
  };
}

describe("validateFeedbackRequest", () => {
  it("acepta una petición correcta", () => {
    const result = validateFeedbackRequest(baseRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("feature");
      expect(result.value.title).toBe("Poder exportar la dieta a PDF");
    }
  });

  it("rechaza cualquier clave fuera del esquema cerrado", () => {
    for (const extra of ["repo", "labels", "owner", "issue_number", "path", "method"]) {
      const result = validateFeedbackRequest(baseRequest({ [extra]: "cualquier-cosa" }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("unknown_fields");
    }
  });

  it("rechaza una versión de esquema distinta", () => {
    const result = validateFeedbackRequest(baseRequest({ schema_version: 2 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_schema");
  });

  it("rechaza un tipo desconocido", () => {
    const result = validateFeedbackRequest(
      baseRequest({ kind: "malicious", idempotency_key: `v1:malicious:${"a".repeat(16)}` }),
    );
    expect(result.ok).toBe(false);
  });

  it("rechaza una clave de idempotencia con formato inválido", () => {
    for (const key of ["", "abc", "v1:feature:XYZ", `v2:feature:${"a".repeat(16)}`]) {
      const result = validateFeedbackRequest(baseRequest({ idempotency_key: key }));
      expect(result.ok).toBe(false);
    }
  });

  it("rechaza una clave cuyo tipo no coincide con el campo kind", () => {
    const result = validateFeedbackRequest(
      baseRequest({ kind: "food", idempotency_key: `v1:feature:${"a".repeat(16)}` }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_schema");
  });

  it("rechaza cuerpos desmesurados en vez de truncarlos", () => {
    const result = validateFeedbackRequest(
      baseRequest({ summary: "a".repeat(SUMMARY_MAX_LENGTH * 4 + 1) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("too_long");
  });

  it("trunca lo que se pasa de largo pero es razonable", () => {
    const result = validateFeedbackRequest(baseRequest({ title: "a".repeat(TITLE_MAX_LENGTH + 30) }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
  });

  it("rechaza título o resumen que quedan vacíos tras normalizar", () => {
    for (const overrides of [{ title: "   " }, { summary: "\n\n\n" }]) {
      const result = validateFeedbackRequest(baseRequest(overrides));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("empty");
    }
  });

  it("redacta secretos antes de aceptar", () => {
    const secret = `ghp_${"a".repeat(36)}`;
    const result = validateFeedbackRequest(baseRequest({ summary: `mi token ${secret}` }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary).not.toContain(secret);
      expect(result.value.summary).toContain("REDACTADO");
    }
  });

  it("acepta denuncias con su límite ampliado sin cambiar el esquema", () => {
    const summary = "r".repeat(SUMMARY_MAX_LENGTH + 500);
    const result = validateFeedbackRequest(baseRequest({
      kind: "report",
      summary,
      idempotency_key: `v1:report:${"b".repeat(16)}`,
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("report");
      expect(result.value.summary).toBe(summary);
      expect(result.value.summary.length).toBeLessThanOrEqual(REPORT_SUMMARY_MAX_LENGTH);
    }
  });

  it("rechaza entradas que no son objetos sin lanzar", () => {
    for (const input of [null, undefined, 42, "texto", [], true]) {
      const result = validateFeedbackRequest(input);
      expect(result.ok).toBe(false);
    }
  });
});
