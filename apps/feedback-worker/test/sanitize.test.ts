import { describe, expect, it } from "vitest";
import {
  containsSecret,
  normalizeBlock,
  normalizeLine,
  redactSecrets,
  truncate,
} from "../src/sanitize";

describe("redactSecrets", () => {
  it("redacta tokens de GitHub en sus tres formatos", () => {
    const ghp = `ghp_${"a".repeat(36)}`;
    const pat = `github_pat_${"b".repeat(40)}`;
    const gho = `gho_${"c".repeat(36)}`;
    for (const secret of [ghp, pat, gho]) {
      const output = redactSecrets(`mi token es ${secret} y ya`);
      expect(output).not.toContain(secret);
      expect(output).toContain("[GITHUB_TOKEN REDACTADO]");
    }
  });

  it("redacta claves de los tres proveedores de IA", () => {
    const openai = `sk-${"d".repeat(40)}`;
    const anthropic = `sk-ant-${"e".repeat(40)}`;
    const google = `AIza${"f".repeat(35)}`;
    expect(redactSecrets(openai)).toContain("REDACTADO");
    expect(redactSecrets(anthropic)).toContain("ANTHROPIC_KEY");
    expect(redactSecrets(google)).toContain("GOOGLE_KEY");
  });

  it("redacta un JWT y una cabecera Bearer", () => {
    const jwt = `ey${"a".repeat(20)}.${"b".repeat(20)}.${"c".repeat(20)}`;
    expect(redactSecrets(jwt)).toContain("[JWT REDACTADO]");
    expect(redactSecrets(`Bearer ${"z".repeat(30)}`)).toContain("[BEARER REDACTADO]");
  });

  it("no toca texto normal", () => {
    const text = "El press banca con barra no aparece en el catálogo.";
    expect(redactSecrets(text)).toBe(text);
    expect(containsSecret(text)).toBe(false);
  });

  it("containsSecret es estable entre llamadas (sin lastIndex compartido)", () => {
    const secret = `ghp_${"a".repeat(36)}`;
    expect(containsSecret(secret)).toBe(true);
    expect(containsSecret(secret)).toBe(true);
    expect(containsSecret(secret)).toBe(true);
  });
});

describe("normalizeLine", () => {
  it("colapsa blancos y recorta", () => {
    expect(normalizeLine("  hola   \t  mundo  ")).toBe("hola mundo");
  });

  it("elimina saltos de línea y caracteres de control", () => {
    expect(normalizeLine("uno\ndos")).toBe("uno dos");
    expect(normalizeLine(`a${String.fromCharCode(0)}b`)).toBe("ab");
    expect(normalizeLine(`a${String.fromCharCode(127)}b`)).toBe("ab");
  });

  it("es idempotente", () => {
    const input = "  a \n\n b \t c  ";
    expect(normalizeLine(normalizeLine(input))).toBe(normalizeLine(input));
  });
});

describe("normalizeBlock", () => {
  it("conserva los saltos de línea", () => {
    expect(normalizeBlock("uno\ndos")).toBe("uno\ndos");
  });

  it("colapsa más de dos saltos seguidos", () => {
    expect(normalizeBlock("uno\n\n\n\ndos")).toBe("uno\n\ndos");
  });

  it("quita espacios al final de cada línea", () => {
    expect(normalizeBlock("uno   \ndos  ")).toBe("uno\ndos");
  });

  it("es idempotente", () => {
    const input = "  uno  \n\n\n  dos \t ";
    expect(normalizeBlock(normalizeBlock(input))).toBe(normalizeBlock(input));
  });
});

describe("truncate", () => {
  it("no toca lo que cabe", () => {
    expect(truncate("hola", 10)).toBe("hola");
  });

  it("recorta y añade elipsis", () => {
    const output = truncate("abcdefghij", 5);
    expect(output.length).toBeLessThanOrEqual(5);
    expect(output.endsWith("…")).toBe(true);
  });

  it("no parte un par suplente por la mitad", () => {
    // Cada emoji ocupa dos unidades UTF-16.
    const input = "👍👍👍👍👍";
    const output = truncate(input, 5);
    expect(output.length).toBeLessThanOrEqual(5);
    // Si partiera el par, aparecería U+FFFD al reinterpretar.
    expect(output).not.toContain("�");
    expect([...output].every((character) => character === "👍" || character === "…")).toBe(true);
  });

  it("devuelve cadena vacía con longitud no positiva", () => {
    expect(truncate("hola", 0)).toBe("");
  });
});
