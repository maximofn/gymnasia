import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  SUMMARY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  buildIdempotencyKey,
  describeOutcomeForModel,
  describeOutcomeForUser,
  formatExerciseSummary,
  formatFoodSummary,
  isVerifiedIssueReference,
  sanitizeFeedbackDraft,
  type FeedbackIssueOutcome,
} from "./feedbackIssues";

const anyText = fc.string({ unit: "grapheme", maxLength: 300 });

describe("sanitizeFeedbackDraft", () => {
  it("normaliza y conserva el contenido útil", () => {
    const draft = sanitizeFeedbackDraft({
      kind: "feature",
      title: "  Exportar   la dieta  ",
      summary: "Quiero  un PDF.  ",
    });
    expect(draft).toEqual({
      kind: "feature",
      title: "Exportar la dieta",
      summary: "Quiero un PDF.",
    });
  });

  it("devuelve null si el título o el resumen quedan vacíos", () => {
    expect(sanitizeFeedbackDraft({ kind: "feature", title: "   ", summary: "x" })).toBeNull();
    expect(sanitizeFeedbackDraft({ kind: "feature", title: "x", summary: "  " })).toBeNull();
  });

  it("respeta los límites de longitud", () => {
    const draft = sanitizeFeedbackDraft({
      kind: "food",
      title: "a".repeat(TITLE_MAX_LENGTH + 50),
      summary: "b".repeat(SUMMARY_MAX_LENGTH + 50),
    });
    expect(draft?.title.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
    expect(draft?.summary.length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
  });

  it("es idempotente", () => {
    fc.assert(
      fc.property(anyText, anyText, (title, summary) => {
        const once = sanitizeFeedbackDraft({ kind: "feature", title, summary });
        if (!once) return;
        expect(sanitizeFeedbackDraft(once)).toEqual(once);
      }),
    );
  });
});

describe("buildIdempotencyKey", () => {
  it("es estable para el mismo contenido", () => {
    const draft = { kind: "feature" as const, title: "A", summary: "B" };
    expect(buildIdempotencyKey(draft)).toBe(buildIdempotencyKey({ ...draft }));
  });

  it("cambia si cambia el contenido", () => {
    const base = { kind: "feature" as const, title: "A", summary: "B" };
    expect(buildIdempotencyKey(base)).not.toBe(buildIdempotencyKey({ ...base, title: "C" }));
    expect(buildIdempotencyKey(base)).not.toBe(buildIdempotencyKey({ ...base, summary: "C" }));
  });

  it("cumple siempre el formato que exige el servidor", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("feature" as const, "food" as const, "exercise" as const),
        anyText,
        anyText,
        (kind, title, summary) => {
          const draft = sanitizeFeedbackDraft({ kind, title, summary });
          if (!draft) return;
          expect(buildIdempotencyKey(draft)).toMatch(
            /^v1:(feature|food|exercise):[0-9a-f]{16}$/,
          );
        },
      ),
    );
  });

  it("es estable al volver a sanear el borrador", () => {
    fc.assert(
      fc.property(anyText, anyText, (title, summary) => {
        const draft = sanitizeFeedbackDraft({ kind: "food", title, summary });
        if (!draft) return;
        const again = sanitizeFeedbackDraft(draft);
        expect(again && buildIdempotencyKey(again)).toBe(buildIdempotencyKey(draft));
      }),
    );
  });
});

describe("isVerifiedIssueReference", () => {
  it("acepta una referencia completa de GitHub", () => {
    expect(
      isVerifiedIssueReference({ number: 7, url: "https://github.com/a/b/issues/7" }),
    ).toBe(true);
  });

  it("rechaza números inválidos y URLs de otro host", () => {
    const bad: unknown[] = [
      null,
      undefined,
      42,
      { number: 0, url: "https://github.com/a" },
      { number: -1, url: "https://github.com/a" },
      { number: 1.5, url: "https://github.com/a" },
      { number: "7", url: "https://github.com/a" },
      { number: 7, url: "https://evil.example/a" },
      { number: 7 },
      { url: "https://github.com/a" },
    ];
    for (const value of bad) expect(isVerifiedIssueReference(value)).toBe(false);
  });
});

describe("describeOutcomeForModel", () => {
  const outcomes: FeedbackIssueOutcome[] = [
    { status: "created", issueNumber: 12, issueUrl: "https://github.com/a/b/issues/12", deduplicated: false },
    { status: "canceled" },
    { status: "unavailable", reason: "not_configured" },
    { status: "rejected", reason: "rate_limited" },
    { status: "error", reason: "timeout" },
  ];

  it("da texto a las cinco variantes sin lanzar", () => {
    for (const outcome of outcomes) {
      expect(describeOutcomeForModel(outcome).length).toBeGreaterThan(0);
      expect(describeOutcomeForUser(outcome).length).toBeGreaterThan(0);
    }
  });

  it("solo la variante created afirma que la incidencia existe", () => {
    // Es la propiedad que sustituye estructuralmente al éxito falso.
    for (const outcome of outcomes) {
      const text = describeOutcomeForModel(outcome).toLowerCase();
      if (outcome.status === "created") {
        expect(text).toContain("registrada con el n");
      } else {
        // La propiedad real: ninguna variante distinta de created puede dar a
        // entender que existe, y todas niegan el registro de forma explícita.
        expect(text).not.toContain("registrada con el n");
        expect(
          text.includes("no afirmes") || text.includes("no se ha registrado"),
        ).toBe(true);
      }
    }
  });

  it("incluye el número real cuando se ha creado", () => {
    const text = describeOutcomeForModel(outcomes[0]);
    expect(text).toContain("12");
  });
});

describe("formateadores de resumen", () => {
  it("el resumen de alimento solo contiene campos del formulario", () => {
    const summary = formatFoodSummary({
      name: "Yogur griego",
      grams: 125,
      calories_kcal: 130,
      protein_g: 10,
      carbs_g: 5,
      fat_g: 8,
    });
    expect(summary).toContain("Yogur griego");
    expect(summary).toContain("125 g");
    // Nada de estructuras internas ni identificadores derivados.
    expect(summary).not.toContain("serving_size_g");
    expect(summary).not.toContain("{");
  });

  it("el resumen de ejercicio tolera campos ausentes", () => {
    const summary = formatExerciseSummary({ name: "Press Arnold" });
    expect(summary).toContain("Press Arnold");
    expect(summary).toContain("Sin especificar");
  });
});
