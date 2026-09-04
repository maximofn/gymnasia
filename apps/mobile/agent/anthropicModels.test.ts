import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import {
  ANTHROPIC_MODELS_MAX_PAGES,
  ANTHROPIC_MODELS_PAGE_LIMIT,
  anthropicModelsQuery,
  collectAnthropicModels,
  parseAnthropicModelOptions,
  parseAnthropicModelPage,
} from "./anthropicModels";

const model = (n: number) => ({ id: `claude-${n}`, display_name: `Claude ${n}` });

describe("parseAnthropicModelPage", () => {
  it("lee la forma cruda de Anthropic", () => {
    const page = parseAnthropicModelPage({
      data: [model(1), model(2)],
      has_more: true,
      last_id: "claude-2",
    });

    expect(page.options.map((o) => o.id)).toEqual(["claude-1", "claude-2"]);
    expect(page.hasMore).toBe(true);
    expect(page.lastId).toBe("claude-2");
  });

  it("acepta tambien la clave models", () => {
    const page = parseAnthropicModelPage({ models: [model(1)] });
    expect(page.options.map((o) => o.id)).toEqual(["claude-1"]);
  });

  it("descarta entradas sin id y normaliza los espacios", () => {
    const page = parseAnthropicModelPage({
      data: [
        { id: "  claude-1  ", display_name: "  Claude 1  " },
        { display_name: "sin id" },
        { id: "   " },
        { id: 42 },
        null,
      ],
    });

    expect(page.options).toEqual([{ id: "claude-1", display_name: "Claude 1" }]);
  });

  it("deja display_name en null cuando no viene", () => {
    const page = parseAnthropicModelPage({ data: [{ id: "claude-1" }] });
    expect(page.options[0].display_name).toBeNull();
  });

  it("no pide mas paginas cuando llega el envoltorio del proxy", () => {
    // El proxy ya recorrio la paginacion: `pagination` significa "ya esta hecho".
    const page = parseAnthropicModelPage({
      data: [model(1)],
      has_more: true,
      last_id: "claude-1",
      pagination: { pages_fetched: 20, truncated: true, partial: false, error: null },
    });

    expect(page.hasMore).toBe(false);
    expect(page.truncated).toBe(true);
  });

  it("propaga el aviso de lista parcial del proxy", () => {
    const page = parseAnthropicModelPage({
      data: [model(1)],
      pagination: { partial: true, truncated: false },
    });

    expect(page.partial).toBe(true);
  });

  it("devuelve vacio ante cualquier basura", () => {
    for (const payload of [null, undefined, 42, "hola", [], {}]) {
      expect(parseAnthropicModelPage(payload).options).toEqual([]);
    }
  });

  it("parseAnthropicModelOptions sigue devolviendo solo la lista", () => {
    expect(parseAnthropicModelOptions({ data: [model(1)] })).toEqual([
      { id: "claude-1", display_name: "Claude 1" },
    ]);
  });
});

describe("anthropicModelsQuery", () => {
  it("no manda cursor en la primera pagina", () => {
    expect(anthropicModelsQuery(null)).toBe(`?limit=${ANTHROPIC_MODELS_PAGE_LIMIT}`);
  });

  it("manda el cursor escapado en las siguientes", () => {
    expect(anthropicModelsQuery("claude/3")).toContain("after_id=claude%2F3");
  });
});

describe("collectAnthropicModels", () => {
  const pager = (pages: Array<Array<{ id: string; display_name: string }>>) =>
    vi.fn(async (afterId: string | null) => {
      const index =
        afterId === null
          ? 0
          : pages.findIndex((page) => page[page.length - 1]?.id === afterId) + 1;
      const page = pages[index] ?? [];
      return {
        data: page,
        has_more: index < pages.length - 1,
        last_id: page[page.length - 1]?.id ?? null,
      };
    });

  it("una sola pagina se pide una sola vez", async () => {
    const fetchPage = pager([[model(1), model(2)]]);

    const result = await collectAnthropicModels(fetchPage);

    expect(result.options.map((o) => o.id)).toEqual(["claude-1", "claude-2"]);
    expect(result.pagesFetched).toBe(1);
    expect(result.warning).toBeNull();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("concatena todas las paginas", async () => {
    const fetchPage = pager([[model(1)], [model(2)], [model(3)]]);

    const result = await collectAnthropicModels(fetchPage);

    expect(result.options.map((o) => o.id)).toEqual(["claude-1", "claude-2", "claude-3"]);
    expect(result.pagesFetched).toBe(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, null);
    expect(fetchPage).toHaveBeenNthCalledWith(2, "claude-1");
  });

  it("no duplica modelos repetidos entre paginas", async () => {
    const fetchPage = pager([[model(1), model(2)], [model(2), model(3)]]);

    const result = await collectAnthropicModels(fetchPage);

    expect(result.options.map((o) => o.id)).toEqual(["claude-1", "claude-2", "claude-3"]);
  });

  it("propaga el error si falla la primera pagina", async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error("sin red");
    });

    await expect(collectAnthropicModels(fetchPage)).rejects.toThrow("sin red");
  });

  it("devuelve lo acumulado y avisa si falla una pagina posterior", async () => {
    const fetchPage = vi.fn(async (afterId: string | null) => {
      if (afterId === null) {
        return { data: [model(1)], has_more: true, last_id: "claude-1" };
      }
      throw new Error("se cayo a mitad");
    });

    const result = await collectAnthropicModels(fetchPage);

    expect(result.options.map((o) => o.id)).toEqual(["claude-1"]);
    expect(result.partial).toBe(true);
    expect(result.warning).toBeTruthy();
  });

  it("no se cuelga si el cursor no avanza", async () => {
    const fetchPage = vi.fn(async () => ({
      data: [model(1)],
      has_more: true,
      last_id: "claude-1",
    }));

    const result = await collectAnthropicModels(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.truncated).toBe(true);
    expect(result.warning).toBeTruthy();
  });

  it("no se cuelga si falta el cursor", async () => {
    const fetchPage = vi.fn(async () => ({ data: [model(1)], has_more: true }));

    const result = await collectAnthropicModels(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.truncated).toBe(true);
  });

  it("respeta el tope de paginas", async () => {
    let n = 0;
    const fetchPage = vi.fn(async () => {
      n += 1;
      return { data: [model(n)], has_more: true, last_id: `claude-${n}` };
    });

    const result = await collectAnthropicModels(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(ANTHROPIC_MODELS_MAX_PAGES);
    expect(result.truncated).toBe(true);
  });

  it("hereda el aviso cuando el proxy ya pagino y quedo incompleto", async () => {
    const fetchPage = vi.fn(async () => ({
      data: [model(1)],
      pagination: { truncated: false, partial: true },
    }));

    const result = await collectAnthropicModels(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.partial).toBe(true);
    expect(result.warning).toBeTruthy();
  });

  it("siempre termina y nunca duplica, sea cual sea la respuesta", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            data: fc.array(
              fc.record({ id: fc.string(), display_name: fc.string() }),
              { maxLength: 4 },
            ),
            has_more: fc.boolean(),
            last_id: fc.oneof(fc.string(), fc.constant(null)),
          }),
          { maxLength: 6 },
        ),
        async (pages) => {
          let calls = 0;
          const result = await collectAnthropicModels(async () => {
            calls += 1;
            return pages[(calls - 1) % Math.max(pages.length, 1)] ?? {};
          });

          expect(calls).toBeLessThanOrEqual(ANTHROPIC_MODELS_MAX_PAGES);
          const ids = result.options.map((o) => o.id);
          expect(new Set(ids).size).toBe(ids.length);
          if (result.warning === null) {
            expect(result.truncated).toBe(false);
            expect(result.partial).toBe(false);
          }
        },
      ),
    );
  });
});
