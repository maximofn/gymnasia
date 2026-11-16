import { describe, expect, it } from "vitest";
import { COACH_CONTEXT_MESSAGE_LIMIT, selectCoachContext } from "./coachContext";
import { prepareGoogleInteractionRequest } from "./googleContextBudget";
import { buildGoogleHistory } from "./googleInteractions";

describe("selectCoachContext", () => {
  it("aplica una ventana común y conserva los turnos enriquecidos de Google", () => {
    const googleTurn = { version: 1, steps: [{ type: "model_output", content: [] }] };
    const messages = Array.from({ length: COACH_CONTEXT_MESSAGE_LIMIT + 3 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `mensaje-${index}`,
      ...(index === COACH_CONTEXT_MESSAGE_LIMIT + 1 ? { googleTurn } : {}),
    }));

    const selected = selectCoachContext(messages);

    expect(selected).toHaveLength(COACH_CONTEXT_MESSAGE_LIMIT);
    expect(selected[0]).toBe(messages[3]);
    expect(selected.at(-2)?.googleTurn).toBe(googleTurn);
    expect(messages).toHaveLength(COACH_CONTEXT_MESSAGE_LIMIT + 3);
  });

  it("conserva todos los mensajes si el hilo aún cabe", () => {
    const messages = [{ role: "user", content: "Hola" }];
    expect(selectCoachContext(messages)).toEqual(messages);
  });

  it("entrega a Google la ventana común antes de aplicar sus límites de transporte", () => {
    const messages = Array.from({ length: 12 }, (_, index) => [
      { role: "user" as const, content: `pregunta-${index}` },
      { role: "assistant" as const, content: `respuesta-${index}` },
    ]).flat();
    const history = buildGoogleHistory(selectCoachContext(messages));

    const prepared = prepareGoogleInteractionRequest({ model: "gemini-3.8-flash", history });

    expect(prepared.report).toMatchObject({
      originalExchanges: 10,
      sentExchanges: 10,
      droppedExchanges: 0,
    });
    expect((prepared.body.input as typeof history)[0]).toEqual({
      type: "user_input",
      content: [{ type: "text", text: "pregunta-2" }],
    });
  });
});
