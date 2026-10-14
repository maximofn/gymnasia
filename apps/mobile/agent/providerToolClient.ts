import { composeAiSystemPrompt } from "./aiTransparency";
import { COACH_CONTEXT_MESSAGE_LIMIT } from "./coachContext";
import { DEFAULT_GOOGLE_CONTEXT_BUDGET } from "./googleContextBudget";
import {
  buildGoogleHistory,
  type GoogleConversationTurn,
  type GoogleStep,
} from "./googleInteractions";
import {
  requestGoogleProviderInteraction,
  type ChatInputMessage,
  type ProviderChatResult,
  type ProviderChatRuntime,
} from "./providerChatClient";
import {
  DEFAULT_MODELS,
  normalizeProviderModel,
  type ProviderConfiguration,
} from "./providerConfiguration";
import { buildOpenAIReasoningConfig } from "./providerResponseModel";
import {
  streamAnthropicRequestViaXHR,
  streamOpenAIRequestViaFetch,
  streamOpenAIRequestViaXHR,
} from "./providerStreamTransport";
import type { StreamingHandlers } from "./providerStreamParsers";
import {
  closingSystemPrompt,
  MAX_TOOL_ROUNDS,
  parseOpenAIFunctionArguments,
  ROUND_LIMIT_TOOL_RESULT,
  runAnthropicToolLoop,
  runGoogleToolLoop,
  runOpenAIToolLoop,
  ToolRoundLimitError,
  executeToolSafely,
  type ExecuteTool,
} from "./providerToolLoop";
import { CHAT_TOOLS, formatToolInputError } from "./toolDefinitions";
import {
  chatCompletionTools,
  isUnsupportedCustomFeature,
  requestCustomOpenAIChat,
  type ChatCompletionMessage,
} from "./customOpenAIChat";
import { executeToolBatch } from "./toolBatch";
import type { ToolBatchDiagnostics } from "./toolBatchDiagnostics";
import { toolCallOccurrenceKey } from "./toolOperationLedger";
import {
  anthropicApiHeaders,
  anthropicProxyCredentials,
  anthropicThinkingConfig,
  createFakeProviderResult,
} from "./providerTransport";

const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_THINKING_BUDGET = 1024;
const ANTHROPIC_WEB_PROXY_UNREACHABLE_MESSAGE =
  "El proxy configurado en EXPO_PUBLIC_API_BASE_URL no responde. " +
  "Comprueba que sigue levantado, o quita esa variable para que la app hable " +
  "con Anthropic directamente.";

export type ProviderToolChatOptions = StreamingHandlers & {
  executionId?: string;
  executeTool: ExecuteTool;
  toolBatchDiagnostics?: ToolBatchDiagnostics;
};

export async function requestProviderToolChat(
  provider: ProviderConfiguration,
  messages: ChatInputMessage[],
  runtime: ProviderChatRuntime,
  options: ProviderToolChatOptions,
): Promise<ProviderChatResult> {
  const latestUserInput = [...messages]
    .reverse()
    .find((message) => message.role === "user")?.content ?? "";
  if (runtime.fakeMode) {
    const fixture = createFakeProviderResult("main-chat", latestUserInput);
    options.onContentDelta?.(fixture.content, fixture.content);
    return fixture;
  }

  const systemPrompt = composeAiSystemPrompt(
    messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n"),
  );
  const nonSystemMessages: Array<{ role: "assistant" | "user"; content: string }> = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));

  if (provider.provider === "openai") {
    let streamedContent = "";
    let streamedThinking = "";
    const model = normalizeProviderModel("openai", provider.model);
    const reasoning = buildOpenAIReasoningConfig(provider);
    const streamHandlers: StreamingHandlers = {
      onContentDelta: (delta) => {
        streamedContent += delta;
        options.onContentDelta?.(delta, streamedContent);
      },
      onThinkingDelta: (delta) => {
        streamedThinking += delta;
        options.onThinkingDelta?.(delta, streamedThinking);
      },
    };

    const makeRequest = async (
      input: Array<Record<string, unknown>>,
      includeTools: boolean,
      toolChoice?: "none",
    ) => {
      const body: Record<string, unknown> = {
        model,
        instructions: toolChoice ? closingSystemPrompt(systemPrompt) : systemPrompt,
        input,
        store: false,
        include: ["reasoning.encrypted_content"],
      };
      if (reasoning) body.reasoning = reasoning;
      if (includeTools) body.tools = CHAT_TOOLS.openai;
      if (includeTools && toolChoice) body.tool_choice = toolChoice;
      const headers = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${provider.api_key}`,
      };
      return runtime.platform === "web"
        ? streamOpenAIRequestViaFetch(
            "https://api.openai.com/v1/responses",
            headers,
            body,
            streamHandlers,
            "No se pudo conectar con OpenAI.",
            "OpenAI error",
          )
        : streamOpenAIRequestViaXHR(
            "https://api.openai.com/v1/responses",
            headers,
            body,
            streamHandlers,
            "No se pudo conectar con OpenAI.",
            "OpenAI error",
          );
    };

    const initialInput = nonSystemMessages;
    const payload = await runOpenAIToolLoop({
      initialInput,
      initialTurn: await makeRequest(initialInput, true),
      requestNextTurn: (context) => makeRequest(context, true),
      requestClosingTurn: (context) => makeRequest(context, true, "none"),
      executeTool: options.executeTool,
      toolBatchDiagnostics: options.toolBatchDiagnostics,
      executionId: options.executionId,
    });

    const content = streamedContent.trim() || payload.content;
    const thinking = streamedThinking.trim() || payload.thinking || null;
    if (!content) {
      if (payload.roundLimitReached) throw new ToolRoundLimitError();
      throw new Error("OpenAI no devolvio contenido.");
    }
    return { content, thinking };
  }

  if (provider.provider === "custom_openai") {
    const history: ChatCompletionMessage[] = [
      { role: "system", content: systemPrompt },
      ...nonSystemMessages,
    ];
    const tools = chatCompletionTools(CHAT_TOOLS.openai);
    const occurrences = new Map<string, number>();
    let fullContent = "";
    for (let round = 0; round <= MAX_TOOL_ROUNDS + 1; round += 1) {
      // Tras MAX_TOOL_ROUNDS rondas de tools queda una llamada de cierre con las tools prohibidas.
      const closing = round > MAX_TOOL_ROUNDS;
      let turn;
      let streamedThisTurn = "";
      try {
        const messagesForRound = closing
          ? [{ role: "system" as const, content: closingSystemPrompt(systemPrompt) }, ...history.slice(1)]
          : history;
        turn = await requestCustomOpenAIChat(provider, messagesForRound, {
          platform: runtime.platform,
          tools,
          ...(closing ? { toolChoice: "none" as const } : {}),
          onContentDelta: (delta) => {
            streamedThisTurn += delta;
            fullContent += delta;
            options.onContentDelta?.(delta, fullContent);
          },
        });
      } catch (error) {
        if (closing) throw new ToolRoundLimitError({ cause: error });
        if (isUnsupportedCustomFeature(error, "tools")) {
          throw new Error("Este modelo no admite las herramientas que necesita Gymnasia Coach. Elige otro modelo.");
        }
        throw error;
      }
      if (!streamedThisTurn && turn.content) {
        fullContent += turn.content;
        options.onContentDelta?.(turn.content, fullContent);
      }
      if (closing && turn.toolCalls.length > 0) throw new ToolRoundLimitError();
      if (turn.toolCalls.length === 0) {
        if (!fullContent.trim()) {
          if (closing) throw new ToolRoundLimitError();
          throw new Error("El modelo no devolvió contenido.");
        }
        return { content: fullContent.trim(), thinking: null };
      }
      history.push({ role: "assistant", content: turn.content || null, tool_calls: turn.toolCalls });
      if (round === MAX_TOOL_ROUNDS) {
        // Sin rondas: las tools pendientes no se ejecutan y el modelo lo sabe.
        for (const call of turn.toolCalls) {
          history.push({ role: "tool", content: ROUND_LIMIT_TOOL_RESULT, tool_call_id: call.id });
        }
        continue;
      }
      const calls = turn.toolCalls.map((call) => {
        const name = call.function.name;
        const args = parseOpenAIFunctionArguments(call.function.arguments);
        let envelope = null;
        if (args !== null) {
          const key = toolCallOccurrenceKey(name, args);
          const occurrence = occurrences.get(key) ?? 0;
          occurrences.set(key, occurrence + 1);
          envelope = {
            executionId: options.executionId ?? "legacy-execution",
            provider: "custom_openai" as const, providerCallId: call.id, name, args, occurrence,
          };
        }
        return { name, id: call.id, envelope };
      });
      const results = await executeToolBatch(calls, async (call) =>
        call.envelope === null
          ? { output: formatToolInputError(["Los argumentos deben ser un objeto JSON válido."]), isError: true }
          : executeToolSafely(options.executeTool, call.name, call.envelope.args, call.envelope), 1, options.toolBatchDiagnostics);
      history.push(...calls.map((call, index) => ({
        role: "tool" as const, content: results[index].output, tool_call_id: call.id,
      })));
    }
  }

  if (provider.provider === "anthropic") {
    let streamedContent = "";
    let streamedThinking = "";
    const streamHandlers: StreamingHandlers = {
      onContentDelta: (delta) => {
        streamedContent += delta;
        options.onContentDelta?.(delta, streamedContent);
      },
      onThinkingDelta: (delta) => {
        streamedThinking += delta;
        options.onThinkingDelta?.(delta, streamedThinking);
      },
    };

    const makeRequest = async (
      currentMessages: unknown[],
      includeTools: boolean,
      toolChoice?: "none",
    ) => {
      const body: Record<string, unknown> = {
        model: provider.model || DEFAULT_MODELS.anthropic,
        max_tokens: 2048 + ANTHROPIC_THINKING_BUDGET,
        thinking: anthropicThinkingConfig(
          provider.model || DEFAULT_MODELS.anthropic,
          ANTHROPIC_THINKING_BUDGET,
        ),
        system: toolChoice ? closingSystemPrompt(systemPrompt) : systemPrompt,
        messages: currentMessages,
      };
      // Con tool_use en el historial, Anthropic exige la lista de tools aunque se prohíba usarlas.
      if (includeTools) body.tools = CHAT_TOOLS.anthropic;
      if (includeTools && toolChoice) body.tool_choice = { type: toolChoice };
      if (runtime.anthropicWebProxyUrl) {
        return streamAnthropicRequestViaXHR(
          runtime.anthropicWebProxyUrl,
          { "Content-Type": "application/json", Accept: "text/event-stream" },
          {
            ...anthropicProxyCredentials(provider.api_key, provider.workspace_id),
            ...body,
          },
          streamHandlers,
          ANTHROPIC_WEB_PROXY_UNREACHABLE_MESSAGE,
          "Proxy Anthropic error",
        );
      }
      return streamAnthropicRequestViaXHR(
        "https://api.anthropic.com/v1/messages",
        anthropicApiHeaders(
          provider.api_key,
          ANTHROPIC_API_VERSION,
          provider.workspace_id,
          { "Content-Type": "application/json", Accept: "text/event-stream" },
          { directBrowserAccess: runtime.platform === "web" },
        ),
        body,
        streamHandlers,
        "No se pudo conectar con Anthropic.",
        "Anthropic error",
      );
    };

    const payload = await runAnthropicToolLoop({
      initialTurn: await makeRequest([...nonSystemMessages], true),
      initialMessages: nonSystemMessages,
      requestNextTurn: (currentMessages) => makeRequest(currentMessages, true),
      requestClosingTurn: (currentMessages) => makeRequest(currentMessages, true, "none"),
      executeTool: options.executeTool,
      toolBatchDiagnostics: options.toolBatchDiagnostics,
      executionId: options.executionId,
    });

    const content = streamedContent.trim() || payload.content;
    const thinking = streamedThinking.trim() || payload.thinking || null;
    if (!content) {
      if (payload.roundLimitReached) throw new ToolRoundLimitError();
      throw new Error("Anthropic no devolvio contenido.");
    }
    return { content, thinking };
  }

  const googleMessages = buildGoogleHistory(messages);
  let streamedContent = "";
  let streamedThinking = "";
  const streamHandlers: StreamingHandlers = {
    onContentDelta: (delta) => {
      streamedContent += delta;
      options.onContentDelta?.(delta, streamedContent);
    },
    onThinkingDelta: (delta) => {
      streamedThinking += delta;
      options.onThinkingDelta?.(delta, streamedThinking);
    },
  };
  const makeRequest = (history: GoogleStep[], toolChoice?: "none") => requestGoogleProviderInteraction(
    provider,
    {
      history,
      systemInstruction: toolChoice ? closingSystemPrompt(systemPrompt) : systemPrompt,
      tools: CHAT_TOOLS.google,
      thinking: true,
      // Coach already selected at most 20 messages for every provider.
      // This cap must not shorten Google's selection by exchange count.
      contextBudget: {
        ...DEFAULT_GOOGLE_CONTEXT_BUDGET,
        maxExchanges: COACH_CONTEXT_MESSAGE_LIMIT,
      },
      ...(toolChoice ? { toolChoice } : {}),
    },
    runtime,
    streamHandlers,
  );
  const payload = await runGoogleToolLoop({
    initialTurn: await makeRequest(googleMessages),
    initialMessages: googleMessages,
    requestNextTurn: (history) => makeRequest(history),
    requestClosingTurn: (history) => makeRequest(history, "none"),
    executeTool: options.executeTool,
    toolBatchDiagnostics: options.toolBatchDiagnostics,
    executionId: options.executionId,
  });
  const content = streamedContent.trim() || payload.content;
  if (!content) {
    if (payload.roundLimitReached) throw new ToolRoundLimitError();
    throw new Error("Google AI no devolvió contenido.");
  }
  const googleTurn: GoogleConversationTurn = {
    version: 1,
    model: normalizeProviderModel("google", provider.model),
    steps: payload.history,
    interactions: payload.interactions,
  };
  return {
    content,
    thinking: streamedThinking.trim() || payload.thinking,
    googleTurn,
  };
}
