import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  FEEDBACK_ISSUE_KINDS,
  SUMMARY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "../src/contract";
import { validateFeedbackRequest } from "../src/schema";
import {
  containsSecret,
  normalizeBlock,
  normalizeLine,
  redactSecrets,
  truncate,
} from "../src/sanitize";

// fast-check 4 retiró `fullUnicodeString`. `unit: "grapheme"` genera texto
// Unicode bien formado, incluidos caracteres del plano astral, que es lo que
// interesa para probar el truncado sin partir pares suplentes.
const anyText = fc.string({ unit: "grapheme", maxLength: 400 });

describe("saneado: propiedades", () => {
  it("normalizeLine es idempotente y no deja saltos ni controles", () => {
    fc.assert(
      fc.property(anyText, (input) => {
        const once = normalizeLine(input);
        expect(normalizeLine(once)).toBe(once);
        expect(once).not.toContain("\n");
        expect([...once].every((character) => {
          const code = character.codePointAt(0) ?? 0;
          return code > 0x1f && code !== 0x7f;
        })).toBe(true);
      }),
    );
  });

  it("normalizeBlock es idempotente y nunca deja tres saltos seguidos", () => {
    fc.assert(
      fc.property(anyText, (input) => {
        const once = normalizeBlock(input);
        expect(normalizeBlock(once)).toBe(once);
        expect(once.includes("\n\n\n")).toBe(false);
      }),
    );
  });

  it("truncate respeta siempre el límite y nunca rompe un par suplente", () => {
    fc.assert(
      fc.property(anyText, fc.integer({ min: 1, max: 200 }), (input, limit) => {
        const output = truncate(input, limit);
        expect(output.length).toBeLessThanOrEqual(limit);
        // Un par suplente roto se convierte en U+FFFD al recodificar.
        expect(Buffer.from(output, "utf8").toString("utf8")).toBe(output);
      }),
    );
  });

  it("redactSecrets nunca lanza y es idempotente sobre su propia salida", () => {
    fc.assert(
      fc.property(anyText, (input) => {
        const once = redactSecrets(input);
        expect(typeof once).toBe("string");
        expect(redactSecrets(once)).toBe(once);
      }),
    );
  });

  it("ningún secreto reconocible sobrevive al saneado", () => {
    const secretArb = fc.oneof(
      fc.string({ minLength: 36, maxLength: 40, unit: fc.constantFrom(..."abcdef0123456789") })
        .map((tail) => `ghp_${tail}`),
      fc.string({ minLength: 40, maxLength: 44, unit: fc.constantFrom(..."abcdef0123456789") })
        .map((tail) => `sk-${tail}`),
      fc.string({ minLength: 35, maxLength: 39, unit: fc.constantFrom(..."abcdef0123456789") })
        .map((tail) => `AIza${tail}`),
    );
    fc.assert(
      fc.property(secretArb, fc.string({ maxLength: 40 }), (secret, noise) => {
        const sanitized = redactSecrets(normalizeBlock(`${noise} ${secret} ${noise}`));
        expect(containsSecret(sanitized)).toBe(false);
      }),
    );
  });
});

describe("validateFeedbackRequest: propiedades", () => {
  it("nunca lanza, sea cual sea la entrada", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        expect(() => validateFeedbackRequest(input)).not.toThrow();
      }),
    );
  });

  it("cuando acepta, respeta siempre los límites y no deja secretos", () => {
    const requestArb = fc.record({
      schema_version: fc.constant(1),
      kind: fc.constantFrom(...FEEDBACK_ISSUE_KINDS),
      title: anyText,
      summary: anyText,
      hex: fc.string({ minLength: 16, maxLength: 16, unit: fc.constantFrom(..."0123456789abcdef") }),
    });

    fc.assert(
      fc.property(requestArb, (raw) => {
        const result = validateFeedbackRequest({
          schema_version: raw.schema_version,
          kind: raw.kind,
          title: raw.title,
          summary: raw.summary,
          idempotency_key: `v1:${raw.kind}:${raw.hex}`,
        });
        if (!result.ok) return;
        expect(result.value.title.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
        expect(result.value.summary.length).toBeLessThanOrEqual(SUMMARY_MAX_LENGTH);
        expect(result.value.title.length).toBeGreaterThan(0);
        expect(result.value.summary.length).toBeGreaterThan(0);
        expect(containsSecret(result.value.title)).toBe(false);
        expect(containsSecret(result.value.summary)).toBe(false);
        expect(result.value.kind).toBe(raw.kind);
        // El tipo del payload y el de la clave nunca pueden divergir.
        expect(result.value.idempotency_key.startsWith(`v1:${raw.kind}:`)).toBe(true);
      }),
    );
  });

  it("ninguna clave extra consigue pasar la validación", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (key) =>
            !["schema_version", "kind", "title", "summary", "idempotency_key"].includes(key),
        ),
        fc.anything(),
        (extraKey, extraValue) => {
          const result = validateFeedbackRequest({
            schema_version: 1,
            kind: "feature",
            title: "Título válido",
            summary: "Resumen válido",
            idempotency_key: `v1:feature:${"a".repeat(16)}`,
            [extraKey]: extraValue,
          });
          expect(result.ok).toBe(false);
        },
      ),
    );
  });
});
