import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  AI_REPORT_REASONS,
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_QUESTION_MAX_LENGTH,
  REPORT_RESPONSE_MAX_LENGTH,
  REPORT_SUMMARY_MAX_LENGTH,
  SUMMARY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  buildIdempotencyKey,
  describeOutcomeForModel,
  describeOutcomeForUser,
  findPreviousUserMessage,
  formatAiResponseReport,
  formatExerciseSummary,
  formatFoodSummary,
  isVerifiedIssueReference,
  isReportableAssistantMessage,
  redactFeedbackSecrets,
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
        fc.constantFrom("feature" as const, "food" as const, "exercise" as const, "report" as const),
        anyText,
        anyText,
        (kind, title, summary) => {
          const draft = sanitizeFeedbackDraft({ kind, title, summary });
          if (!draft) return;
          expect(buildIdempotencyKey(draft)).toMatch(
            /^v1:(feature|food|exercise|report):[0-9a-f]{16}$/,
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

describe("denuncias de respuestas", () => {
  const secret = `sk-${"a".repeat(40)}`;
  const base = {
    surface: "main-chat" as const,
    reason: "dangerous_or_harmful" as const,
    details: `Insistió en usar ${secret}`,
    question: `¿Puedo compartir ${secret}?`,
    response: `Sí, usa ${secret}`,
    appVersion: "1.2.3",
    provider: "openai",
    model: "gpt-test",
    origin: "model" as const,
  };

  it("incluye motivo, pregunta, respuesta y contexto sin secretos", () => {
    const report = formatAiResponseReport(base);
    expect(report.kind).toBe("report");
    expect(report.title).toBe("Respuesta denunciada · Chat principal");
    expect(report.summary).toContain("Peligrosa o perjudicial (dangerous_or_harmful)");
    expect(report.summary).toContain("## Pregunta anterior");
    expect(report.summary).toContain("## Respuesta denunciada");
    expect(report.summary).toContain("gpt-test");
    expect(report.summary).not.toContain(secret);
    expect(report.summary.match(/\[OPENAI_KEY REDACTADO\]/g)?.length).toBe(3);
  });

  it("incluye las reglas de una intervención sanitaria sin el borrador oculto", () => {
    const report = formatAiResponseReport({
      ...base,
      origin: "health_safety",
      response: "Respuesta limitada por seguridad.",
      healthSafety: {
        level: "critical",
        policyVersion: "2026-08-v1",
        ruleIds: ["HS-EMERGENCY-001"],
      },
    });
    expect(report.summary).toContain("HS-EMERGENCY-001");
    expect(report.summary).toContain("Respuesta limitada por seguridad.");
    expect(report.summary).not.toContain("borrador");
  });

  it("aplica límites por sección y al cuerpo final", () => {
    const report = formatAiResponseReport({
      ...base,
      details: "d".repeat(REPORT_DETAILS_MAX_LENGTH + 100),
      question: "q".repeat(REPORT_QUESTION_MAX_LENGTH + 100),
      response: "r".repeat(REPORT_RESPONSE_MAX_LENGTH + 100),
    });
    expect(report.summary.length).toBeLessThanOrEqual(REPORT_SUMMARY_MAX_LENGTH);
    expect(report.summary).not.toContain("q".repeat(REPORT_QUESTION_MAX_LENGTH + 1));
    expect(report.summary).not.toContain("r".repeat(REPORT_RESPONSE_MAX_LENGTH + 1));
  });

  it("solo marca respuestas finales visibles y encuentra la pregunta anterior", () => {
    const messages = [
      { id: "intro", role: "assistant" as const, content: "Soy una IA", kind: "ai_identity_disclosure" },
      { id: "u1", role: "user" as const, content: "Primera" },
      { id: "a1", role: "assistant" as const, content: "Respuesta" },
      { id: "error", role: "assistant" as const, content: "Error", kind: "technical_error" },
      { id: "u2", role: "user" as const, content: "Segunda" },
      { id: "stream", role: "assistant" as const, content: "Parcial", is_streaming: true },
      { id: "safe", role: "assistant" as const, content: "Limitada", kind: "health_safety_intervention" },
    ];
    expect(isReportableAssistantMessage(messages[0])).toBe(false);
    expect(isReportableAssistantMessage(messages[2])).toBe(true);
    expect(isReportableAssistantMessage(messages[3])).toBe(false);
    expect(isReportableAssistantMessage(messages[5])).toBe(false);
    expect(isReportableAssistantMessage(messages[6])).toBe(true);
    expect(findPreviousUserMessage(messages, "safe")?.id).toBe("u2");
  });

  it("mantiene un catálogo estable de cinco motivos", () => {
    expect(AI_REPORT_REASONS.map((reason) => reason.id)).toEqual([
      "dangerous_or_harmful",
      "incorrect_or_misleading",
      "offensive_or_inappropriate",
      "privacy_or_secrets",
      "other",
    ]);
  });

  it("el saneado de secretos es idempotente", () => {
    const once = redactFeedbackSecrets(`Token ${secret}`);
    expect(redactFeedbackSecrets(once)).toBe(once);
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
