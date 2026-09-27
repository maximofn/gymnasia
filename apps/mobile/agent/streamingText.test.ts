import { readFileSync } from "node:fs";

import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAnthropicStreamParser,
  createGoogleStreamParser,
  createOpenAIStreamParser,
  type StreamingHandlers,
} from "./providerStreamParsers";
import {
  streamAnthropicRequestViaXHR,
  streamOpenAIRequestViaFetch,
  streamOpenAIRequestViaXHR,
} from "./providerStreamTransport";
import { runOpenAIToolLoop } from "./providerToolLoop";
import { parseSSEEvent, splitSSEEvents } from "./sse";
import { createStreamDraftFlusher, STREAM_DRAFT_FLUSH_MS } from "./streamDraftFlusher";

// Las tres fixtures cuentan lo mismo: un razonamiento y después la respuesta, con
// tildes y un emoji de cuatro bytes en UTF-8 para que los cortes de red duelan.
const EXPECTED_CONTENT = "Tu objetivo es ganar músculo 💪.";
const EXPECTED_THINKING = "El usuario pregunta por su objetivo.";

function readRawFixture(name: string): string {
  return readFileSync(new URL(`./__fixtures__/raw/${name}`, import.meta.url), "utf8");
}

type TextParser = {
  push: (chunk: string) => void;
  finish: () => { content: string; thinking: string | null };
};

const providers: Array<{
  provider: string;
  fixture: string;
  createParser: (handlers?: StreamingHandlers) => TextParser;
}> = [
  {
    provider: "Anthropic",
    fixture: "anthropic-thinking-text.sse",
    createParser: (handlers) => createAnthropicStreamParser(handlers),
  },
  {
    provider: "OpenAI",
    fixture: "openai-reasoning-text.sse",
    createParser: (handlers) => createOpenAIStreamParser(handlers),
  },
  {
    provider: "Google",
    fixture: "google-thinking-text.sse",
    createParser: (handlers) => createGoogleStreamParser(handlers),
  },
];

// Registra cada delta tal como lo recibiría la interfaz.
function recordDeltas() {
  const events: Array<{ channel: "content" | "thinking"; delta: string; aggregate: string }> = [];
  const handlers: StreamingHandlers = {
    onContentDelta: (delta, aggregate) => events.push({ channel: "content", delta, aggregate }),
    onThinkingDelta: (delta, aggregate) => events.push({ channel: "thinking", delta, aggregate }),
  };
  const joined = (channel: "content" | "thinking") => events
    .filter((event) => event.channel === channel)
    .map((event) => event.delta)
    .join("");
  return { events, handlers, joined };
}

function replay(raw: string, parser: TextParser, chunkSizes: number[]) {
  let offset = 0;
  for (const size of chunkSizes) {
    if (offset >= raw.length) break;
    parser.push(raw.slice(offset, offset + size));
    offset += size;
  }
  if (offset < raw.length) parser.push(raw.slice(offset));
  return parser.finish();
}

describe("SSE: troceado de eventos", () => {
  it("ignora las líneas vacías de más entre eventos", () => {
    const { events, rest } = splitSSEEvents("data: uno\n\n\n\ndata: dos\n\n");
    expect(rest).toBe("");
    expect(events.map(parseSSEEvent).filter(Boolean)).toEqual([
      { event: "message", data: "uno" },
      { event: "message", data: "dos" },
    ]);
  });

  it("acepta data: sin espacio y solo quita el primer espacio del valor", () => {
    expect(parseSSEEvent("data:{\"a\":1}")?.data).toBe("{\"a\":1}");
    expect(parseSSEEvent("data:  sangrado")?.data).toBe(" sangrado");
  });

  it("une data: multilínea aunque llegue con CRLF", () => {
    const { events } = splitSSEEvents("event: delta\r\ndata: uno\r\ndata: dos\r\n\r\n");
    expect(parseSSEEvent(events[0])).toEqual({ event: "delta", data: "uno\ndos" });
  });

  it("no da por cerrado un evento con un CRLF partido entre dos chunks", () => {
    const first = splitSSEEvents("data: uno\r\n\r");
    expect(first.events).toEqual([]);
    const second = splitSSEEvents(`${first.rest}\ndata: dos`);
    expect(second.events).toEqual(["data: uno"]);
    expect(second.rest).toBe("data: dos");
  });
});

describe("deltas de texto y de razonamiento", () => {
  it.each(providers)("$provider separa el razonamiento de la respuesta", ({ fixture, createParser }) => {
    const { events, handlers, joined } = recordDeltas();
    const result = createParser(handlers);
    result.push(readRawFixture(fixture));
    const turn = result.finish();

    expect(joined("content")).toBe(EXPECTED_CONTENT);
    expect(joined("thinking")).toBe(EXPECTED_THINKING);
    expect(turn.content).toBe(EXPECTED_CONTENT);
    expect(turn.thinking).toBe(EXPECTED_THINKING);
    // En estas fixtures el razonamiento llega entero antes que la respuesta.
    const channels = events.map((event) => event.channel);
    expect(channels.lastIndexOf("thinking")).toBeLessThan(channels.indexOf("content"));
  });

  it.each(providers)("$provider entrega cada agregado como el anterior más su delta", ({ fixture, createParser }) => {
    const { events, handlers } = recordDeltas();
    const parser = createParser(handlers);
    parser.push(readRawFixture(fixture));
    parser.finish();

    const previous = { content: "", thinking: "" };
    for (const event of events) {
      expect(event.delta).not.toBe("");
      expect(event.aggregate).toBe(previous[event.channel] + event.delta);
      previous[event.channel] = event.aggregate;
    }
  });
});

describe("regresión: un evento partido en cualquier carácter", () => {
  // El fallo clásico de un parser ingenuo es dar por completo un evento que la red
  // ha cortado, por ejemplo justo entre `data:` y su JSON.
  it.each(providers)("$provider: cortar justo después de `data:` no pierde el delta", ({ fixture, createParser }) => {
    const raw = readRawFixture(fixture);
    const cut = raw.indexOf("data:", raw.indexOf("Tu objetivo") - 200) + "data:".length;
    const { handlers, joined } = recordDeltas();

    const turn = replay(raw, createParser(handlers), [cut]);

    expect(raw.slice(cut - 5, cut)).toBe("data:");
    expect(joined("content")).toBe(EXPECTED_CONTENT);
    expect(turn.content).toBe(EXPECTED_CONTENT);
  });

  it.each(providers)("$provider reconstruye lo mismo al partir en dos en cada posición", ({ fixture, createParser }) => {
    for (const raw of [readRawFixture(fixture), readRawFixture(fixture).replace(/\n/g, "\r\n")]) {
      for (let cut = 1; cut < raw.length; cut += 1) {
        const { handlers, joined } = recordDeltas();
        const turn = replay(raw, createParser(handlers), [cut]);
        expect({ content: joined("content"), thinking: joined("thinking"), final: turn.content })
          .toEqual({ content: EXPECTED_CONTENT, thinking: EXPECTED_THINKING, final: EXPECTED_CONTENT });
      }
    }
  });
});

describe("property: cualquier troceado en N chunks reconstruye el mismo texto", () => {
  it.each(providers)("$provider", ({ fixture, createParser }) => {
    const raw = readRawFixture(fixture);
    fc.assert(fc.property(
      fc.array(fc.integer({ min: 1, max: raw.length }), { minLength: 1, maxLength: 120 }),
      (chunkSizes) => {
        const { handlers, joined } = recordDeltas();
        const turn = replay(raw, createParser(handlers), chunkSizes);
        expect(joined("content")).toBe(EXPECTED_CONTENT);
        expect(joined("thinking")).toBe(EXPECTED_THINKING);
        expect(turn.content).toBe(EXPECTED_CONTENT);
      },
    ), { numRuns: 200 });
  });
});

// XHR falso que, como el de React Native, expone el cuerpo acumulado en responseText
// y avisa con onprogress cada vez que crece.
function fakeCumulativeXHR(raw: string, options: { chunkSize: number; status?: number }) {
  const progressSnapshots: number[] = [];
  class XHR {
    DONE = 4;
    readyState = 1;
    status = options.status ?? 200;
    responseText = "";
    timeout = 0;
    onprogress: (() => void) | null = null;
    onreadystatechange: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    open() {}
    setRequestHeader() {}
    abort() {}
    send() {
      for (let offset = 0; offset < raw.length; offset += options.chunkSize) {
        this.responseText = raw.slice(0, offset + options.chunkSize);
        progressSnapshots.push(this.responseText.length);
        this.onprogress?.();
      }
      this.readyState = 4;
      this.onreadystatechange?.();
    }
  }
  return { XHR, progressSnapshots };
}

describe("transporte", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Anthropic por XHR pinta los deltas antes de que termine la petición", async () => {
    const raw = readRawFixture("anthropic-thinking-text.sse");
    const { XHR } = fakeCumulativeXHR(raw, { chunkSize: 19 });
    const readyStates: number[] = [];
    let xhr: InstanceType<typeof XHR> | null = null;
    vi.stubGlobal("XMLHttpRequest", class extends XHR {
      constructor() { super(); xhr = this; }
    });

    const result = await streamAnthropicRequestViaXHR("https://api.anthropic.test", {}, {}, {
      onContentDelta: () => readyStates.push(xhr!.readyState),
    });

    expect(result.content).toBe(EXPECTED_CONTENT);
    expect(readyStates.length).toBeGreaterThan(0);
    expect(readyStates.every((state) => state !== 4)).toBe(true);
  });

  it("Anthropic por XHR rechaza un stream cortado aunque ya haya pintado texto", async () => {
    const raw = readRawFixture("anthropic-thinking-text.sse");
    const cut = raw.slice(0, raw.indexOf("event: message_delta"));
    const { XHR } = fakeCumulativeXHR(cut, { chunkSize: 23 });
    vi.stubGlobal("XMLHttpRequest", XHR);
    const onContentDelta = vi.fn();

    await expect(streamAnthropicRequestViaXHR("https://api.anthropic.test", {}, {}, { onContentDelta }))
      .rejects.toThrow("se cortó antes de completarse");
    expect(onContentDelta).toHaveBeenCalled();
  });

  it("OpenAI por fetch no rompe un emoji partido entre dos chunks de bytes", async () => {
    const raw = readRawFixture("openai-reasoning-text.sse");
    const bytes = new TextEncoder().encode(raw);
    const emojiStart = new TextEncoder().encode(raw.slice(0, raw.indexOf("💪"))).length;
    // Tres cortes dentro de los cuatro bytes del emoji.
    const cuts = [0, emojiStart + 1, emojiStart + 2, emojiStart + 3, bytes.length];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({
      start(controller) {
        for (let index = 0; index < cuts.length - 1; index += 1) {
          controller.enqueue(bytes.slice(cuts[index], cuts[index + 1]));
        }
        controller.close();
      },
    }))));
    const { handlers, joined } = recordDeltas();

    const result = await streamOpenAIRequestViaFetch("https://api.openai.test", {}, {}, handlers);

    expect(joined("content")).toBe(EXPECTED_CONTENT);
    expect(result.content).toBe(EXPECTED_CONTENT);
  });

  it("OpenAI entrega el mismo turno por XHR que por fetch", async () => {
    const raw = readRawFixture("openai-reasoning-text.sse");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(raw)));
    vi.stubGlobal("XMLHttpRequest", fakeCumulativeXHR(raw, { chunkSize: 11 }).XHR);

    const viaFetch = await streamOpenAIRequestViaFetch("https://api.openai.test", {}, {});
    const viaXHR = await streamOpenAIRequestViaXHR("https://api.openai.test", {}, {});

    expect(viaXHR).toEqual(viaFetch);
    expect(viaXHR.truncated).toBe(false);
  });

  it("OpenAI marca como cortado un stream sin response.completed y el bucle lo rechaza", async () => {
    const raw = readRawFixture("openai-reasoning-text.sse");
    const cut = raw.slice(0, raw.indexOf("event: response.completed"));
    vi.stubGlobal("XMLHttpRequest", fakeCumulativeXHR(cut, { chunkSize: 29 }).XHR);

    const turn = await streamOpenAIRequestViaXHR("https://api.openai.test", {}, {});

    expect(turn.truncated).toBe(true);
    await expect(runOpenAIToolLoop({
      initialTurn: turn,
      requestNextTurn: vi.fn(),
      executeTool: vi.fn(),
    })).rejects.toThrow("se cortó antes de completarse");
  });

  it("un error HTTP del proveedor llega con su mensaje, no como stream vacío", async () => {
    const body = JSON.stringify({ error: { message: "Rate limit reached" } });
    vi.stubGlobal("XMLHttpRequest", fakeCumulativeXHR(body, { chunkSize: body.length, status: 429 }).XHR);

    await expect(streamAnthropicRequestViaXHR("https://api.anthropic.test", {}, {}))
      .rejects.toThrow("Rate limit reached");
  });
});

describe("agrupado de renders a 40 ms", () => {
  afterEach(() => vi.useRealTimers());

  it("pinta una sola vez por muchos deltas dentro de la misma ventana", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const flusher = createStreamDraftFlusher(apply);

    for (let index = 0; index < 100; index += 1) flusher.schedule();
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(STREAM_DRAFT_FLUSH_MS);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("con un delta cada 5 ms pinta como mucho una vez por ventana", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const flusher = createStreamDraftFlusher(apply);

    for (let elapsed = 0; elapsed < 400; elapsed += 5) {
      flusher.schedule();
      vi.advanceTimersByTime(5);
    }
    vi.advanceTimersByTime(STREAM_DRAFT_FLUSH_MS);

    // 80 deltas en 400 ms: sin agrupar serían 80 renders.
    expect(apply.mock.calls.length).toBeLessThanOrEqual(400 / STREAM_DRAFT_FLUSH_MS + 1);
    expect(apply.mock.calls.length).toBeGreaterThanOrEqual(400 / STREAM_DRAFT_FLUSH_MS);
  });

  it("flushNow pinta ya y no repite el pintado al vencer la ventana", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const flusher = createStreamDraftFlusher(apply);

    flusher.schedule();
    flusher.flushNow();
    expect(apply).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(STREAM_DRAFT_FLUSH_MS * 3);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("cancel descarta el pintado pendiente para que no pise la respuesta final", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const flusher = createStreamDraftFlusher(apply);

    flusher.schedule();
    flusher.cancel();
    vi.advanceTimersByTime(STREAM_DRAFT_FLUSH_MS * 3);

    expect(apply).not.toHaveBeenCalled();
  });

  it("el último pintado de un stream real muestra el texto completo", () => {
    vi.useFakeTimers();
    const painted: string[] = [];
    let draft = "";
    const flusher = createStreamDraftFlusher(() => painted.push(draft));
    const parser = createAnthropicStreamParser({
      onContentDelta: (_delta, aggregate) => {
        draft = aggregate;
        flusher.schedule();
      },
    });

    const raw = readRawFixture("anthropic-thinking-text.sse");
    for (let offset = 0; offset < raw.length; offset += 13) {
      parser.push(raw.slice(offset, offset + 13));
      vi.advanceTimersByTime(3);
    }
    parser.finish();
    vi.advanceTimersByTime(STREAM_DRAFT_FLUSH_MS);

    expect(painted.at(-1)).toBe(EXPECTED_CONTENT);
    // Cada pintado es un prefijo del texto: nunca se enseña algo que luego desaparece.
    for (const frame of painted) expect(EXPECTED_CONTENT.startsWith(frame)).toBe(true);
  });
});
