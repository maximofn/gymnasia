import { createHash } from "node:crypto";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CHAT_SYSTEM_PROMPT_CACHE_SCHEMA_VERSION,
  normalizeChatSystemPromptContent,
  selectChatSystemPrompt,
  validateChatSystemPromptContent,
  type ChatSystemPromptDependencies,
  type ChatSystemPromptDiagnostic,
  type ChatSystemPromptRemoteResponse,
} from "./chatSystemPrompt";
import { CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION } from "./generated/chatSystemPrompt.generated";

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function cacheRecord(content: string, sha256 = hash(content)): string {
  return JSON.stringify({
    schemaVersion: CHAT_SYSTEM_PROMPT_CACHE_SCHEMA_VERSION,
    normalizationVersion: CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION,
    content,
    sha256,
  });
}

function remoteResponse(
  body: string,
  overrides: Partial<ChatSystemPromptRemoteResponse> = {},
): ChatSystemPromptRemoteResponse {
  return {
    ok: true,
    status: 200,
    contentType: "text/plain; charset=utf-8",
    body,
    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<ChatSystemPromptDependencies> = {},
): {
  dependencies: ChatSystemPromptDependencies;
  diagnostics: ChatSystemPromptDiagnostic[];
  writes: string[];
} {
  const diagnostics: ChatSystemPromptDiagnostic[] = [];
  const writes: string[] = [];
  const bundledContent = "Política integrada\n";
  const bundledHash = hash(bundledContent);
  const dependencies: ChatSystemPromptDependencies = {
    fetchRemote: async () => {
      throw new Error("offline");
    },
    readCurrentCache: async () => null,
    readLegacyCache: async () => null,
    writeCurrentCache: async (value) => {
      writes.push(value);
    },
    sha256: async (value) => hash(value),
    bundled: {
      content: bundledContent,
      sha256: bundledHash,
      version: `sha256:${bundledHash}`,
      normalizationVersion: CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION,
    },
    diagnostic: (entry) => {
      diagnostics.push(entry);
    },
    ...overrides,
  };
  return { dependencies, diagnostics, writes };
}

describe("validateChatSystemPromptContent", () => {
  it.each([
    ["", null, "empty"],
    ["   \n", "text/plain", "empty"],
    ["<!doctype html><title>Error</title>", "text/plain", "html"],
    [" <html><body>Error</body></html>", "text/plain", "html"],
    ["Prompt válido", "text/html", "invalid-content-type"],
    ["Prompt válido", "application/json", "invalid-content-type"],
    ["Prompt\u0000válido", "text/plain", "null-byte"],
  ])("rechaza una entrada inválida %#", (value, contentType, reason) => {
    expect(validateChatSystemPromptContent(value, contentType)).toEqual({
      valid: false,
      reason,
    });
  });

  it("normaliza solo BOM y finales de línea", () => {
    expect(validateChatSystemPromptContent("\uFEFFUno\r\nDos\rTres  \n", "text/markdown"))
      .toEqual({ valid: true, content: "Uno\nDos\nTres  \n" });
  });
});

describe("selectChatSystemPrompt", () => {
  it("selecciona, normaliza, identifica y cachea un remoto válido", async () => {
    const { dependencies, diagnostics, writes } = createDependencies({
      fetchRemote: async () => remoteResponse("\uFEFFPrompt remoto\r\nSeguro\n"),
    });

    const result = await selectChatSystemPrompt(dependencies);

    expect(result).toEqual({
      content: "Prompt remoto\nSeguro\n",
      source: "remote",
      sha256: hash("Prompt remoto\nSeguro\n"),
      version: `sha256:${hash("Prompt remoto\nSeguro\n")}`,
    });
    expect(JSON.parse(writes[0] ?? "{}")).toEqual({
      schemaVersion: 2,
      normalizationVersion: CHAT_SYSTEM_PROMPT_NORMALIZATION_VERSION,
      content: "Prompt remoto\nSeguro\n",
      sha256: hash("Prompt remoto\nSeguro\n"),
    });
    expect(diagnostics.at(-1)).toMatchObject({
      event: "selected",
      source: "remote",
      sha256: result.sha256,
    });
    expect(JSON.stringify(diagnostics)).not.toContain("Prompt remoto");
  });

  it.each([
    ["vacío", remoteResponse(" \n")],
    ["HTML", remoteResponse("<!doctype html><html>Error</html>")],
    ["tipo de contenido", remoteResponse("Prompt", { contentType: "application/json" })],
    ["HTTP", remoteResponse("", { ok: false, status: 503 })],
  ])("no cachea un remoto inválido por %s y conserva la caché", async (_case, response) => {
    const cachedContent = "Última política remota válida\n";
    const { dependencies, writes } = createDependencies({
      fetchRemote: async () => response,
      readCurrentCache: async () => cacheRecord(cachedContent),
    });

    const result = await selectChatSystemPrompt(dependencies);

    expect(result).toMatchObject({
      content: cachedContent,
      source: "cache",
      sha256: hash(cachedContent),
    });
    expect(writes).toEqual([]);
  });

  it("usa el snapshot cuando falla la red y no hay caché", async () => {
    const { dependencies, diagnostics } = createDependencies();

    const result = await selectChatSystemPrompt(dependencies);

    expect(result.source).toBe("bundled");
    expect(result.content).toBe(dependencies.bundled.content);
    expect(diagnostics).toContainEqual({
      event: "remote-error",
      source: "remote",
      reason: "request-error",
    });
  });

  it("rechaza una caché manipulada cuyo hash ya no corresponde", async () => {
    const { dependencies, diagnostics } = createDependencies({
      readCurrentCache: async () => cacheRecord("Contenido alterado", "0".repeat(64)),
    });

    const result = await selectChatSystemPrompt(dependencies);

    expect(result.source).toBe("bundled");
    expect(diagnostics).toContainEqual({
      event: "cache-rejected",
      source: "cache",
      reason: "hash-mismatch",
    });
  });

  it("rechaza una caché JSON que no contiene un registro", async () => {
    const { dependencies, diagnostics } = createDependencies({
      readCurrentCache: async () => "null",
    });

    const result = await selectChatSystemPrompt(dependencies);

    expect(result.source).toBe("bundled");
    expect(diagnostics).toContainEqual({
      event: "cache-rejected",
      source: "cache",
      reason: "invalid-record",
    });
  });

  it("valida y migra la caché heredada v1", async () => {
    const legacyContent = "Política heredada\r\n";
    const { dependencies, writes } = createDependencies({
      readLegacyCache: async () => legacyContent,
    });

    const result = await selectChatSystemPrompt(dependencies);

    expect(result).toMatchObject({
      content: "Política heredada\n",
      source: "cache",
      sha256: hash("Política heredada\n"),
    });
    expect(JSON.parse(writes[0] ?? "{}").content).toBe("Política heredada\n");
  });

  it("usa el remoto aunque falle la escritura de caché", async () => {
    const { dependencies, diagnostics } = createDependencies({
      fetchRemote: async () => remoteResponse("Remoto válido"),
      writeCurrentCache: async () => {
        throw new Error("storage full");
      },
    });

    const result = await selectChatSystemPrompt(dependencies);

    expect(result.source).toBe("remote");
    expect(diagnostics).toContainEqual({
      event: "cache-write-error",
      source: "remote",
      reason: "remote-cache-error",
    });
  });

  it("llega al snapshot si fallan ambas lecturas de caché", async () => {
    const { dependencies, diagnostics } = createDependencies({
      readCurrentCache: async () => {
        throw new Error("storage unavailable");
      },
      readLegacyCache: async () => {
        throw new Error("storage unavailable");
      },
    });

    const result = await selectChatSystemPrompt(dependencies);

    expect(result.source).toBe("bundled");
    expect(diagnostics.filter((entry) => entry.event === "cache-read-error"))
      .toHaveLength(2);
  });

  it("no confunde un fallo de hash con una descarga válida", async () => {
    const { dependencies, writes } = createDependencies({
      fetchRemote: async () => remoteResponse("Remoto sin hash"),
      sha256: async () => {
        throw new Error("crypto unavailable");
      },
    });

    const result = await selectChatSystemPrompt(dependencies);

    expect(result.source).toBe("bundled");
    expect(writes).toEqual([]);
  });
});

describe("propiedades de normalización y rechazo", () => {
  it("normaliza de forma determinista e idempotente", () => {
    fc.assert(fc.property(
      fc.array(fc.string().filter((value) => !value.includes("\r")), { minLength: 1 }),
      fc.boolean(),
      (lines, includeBom) => {
        const input = `${includeBom ? "\uFEFF" : ""}${lines.join("\r\n")}`;
        const normalized = normalizeChatSystemPromptContent(input);
        expect(normalized).toBe(lines.join("\n"));
        expect(normalizeChatSystemPromptContent(normalized)).toBe(normalized);
        expect(hash(normalized)).toBe(hash(normalizeChatSystemPromptContent(input)));
      },
    ));
  });

  it("nunca acepta documentos HTML completos como prompt", () => {
    fc.assert(fc.property(
      fc.constantFrom("<!doctype html>", "<html>", "<head>", "<body>"),
      fc.string(),
      (prefix, suffix) => {
        expect(validateChatSystemPromptContent(`${prefix}${suffix}`, "text/plain"))
          .toMatchObject({ valid: false, reason: "html" });
      },
    ));
  });
});
