import { composeAiSystemPrompt } from "./aiTransparency";
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
  runAnthropicToolLoop,
  runGoogleToolLoop,
  runOpenAIToolLoop,
} from "./providerToolLoop";
import type { ToolCallEnvelope } from "./toolOperationLedger";
import { CHAT_TOOLS } from "./toolDefinitions";
import {
  chatCompletionTools,
  isUnsupportedCustomFeature,
  requestCustomOpenAIChat,
  type ChatCompletionMessage,
} from "./customOpenAIChat";
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
  executeTool: (
    name: string,
    args: Record<string, unknown>,
    call: ToolCallEnvelope,
  ) => Promise<string>;
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
      previousResponseId: string | null,
      includeTools: boolean,
    ) => {
      const body: Record<string, unknown> = {
        model,
        instructions: systemPrompt,
        input,
      };
      if (reasoning) body.reasoning = reasoning;
      if (previousResponseId) body.previous_response_id = previousResponseId;
      if (includeTools) body.tools = CHAT_TOOLS.openai;
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

    const payload = await runOpenAIToolLoop({
      initialTurn: await makeRequest(nonSystemMessages, null, true),
      requestNextTurn: (outputs, previousResponseId) => (
        makeRequest(outputs, previousResponseId, true)
      ),
      executeTool: options.executeTool,
      executionId: options.executionId,
    });

    const content = streamedContent.trim() || payload.content;
    const thinking = streamedThinking.trim() || payload.thinking || null;
    if (!content) throw new Error("OpenAI no devolvio contenido.");
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
    for (let round = 0; round <= 10; round += 1) {
      let turn;
      let streamedThisTurn = "";
      try {
        turn = await requestCustomOpenAIChat(provider, history, {
          platform: runtime.platform,
          tools,
          onContentDelta: (delta) => {
            streamedThisTurn += delta;
            fullContent += delta;
            options.onContentDelta?.(delta, fullContent);
          },
        });
      } catch (error) {
        if (isUnsupportedCustomFeature(error, "tools")) {
          throw new Error("Este modelo no admite las herramientas que necesita Gymnasia Coach. Elige otro modelo.");
        }
        throw error;
      }
      if (!streamedThisTurn && turn.content) {
        fullContent += turn.content;
        options.onContentDelta?.(turn.content, fullContent);
      }
      if (turn.toolCalls.length === 0) {
        if (!fullContent.trim()) throw new Error("El modelo no devolvió contenido.");
        return { content: fullContent.trim(), thinking: null };
      }
      if (round === 10) throw new Error("El modelo superó el límite de rondas de herramientas.");
      history.push({ role: "assistant", content: turn.content || null, tool_calls: turn.toolCalls });
      for (const call of turn.toolCalls) {
        let args: unknown;
        try { args = JSON.parse(call.function.arguments); }
        catch { throw new Error("El modelo devolvió argumentos de herramienta incompletos."); }
        if (!args || typeof args !== "object" || Array.isArray(args)) {
          throw new Error("El modelo devolvió argumentos de herramienta inválidos.");
        }
        const parsedArgs = args as Record<string, unknown>;
        const key = toolCallOccurrenceKey(call.function.name, parsedArgs);
        const occurrence = occurrences.get(key) ?? 0;
        occurrences.set(key, occurrence + 1);
        const output = await options.executeTool(call.function.name, parsedArgs, {
          executionId: options.executionId ?? "legacy-execution",
          provider: "custom_openai",
          providerCallId: call.id,
          name: call.function.name,
          args: parsedArgs,
          occurrence,
        });
        history.push({ role: "tool", content: output, tool_call_id: call.id });
      }
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

    const makeRequest = async (currentMessages: unknown[], includeTools: boolean) => {
      const body: Record<string, unknown> = {
        model: provider.model || DEFAULT_MODELS.anthropic,
        max_tokens: 2048 + ANTHROPIC_THINKING_BUDGET,
        thinking: anthropicThinkingConfig(
          provider.model || DEFAULT_MODELS.anthropic,
          ANTHROPIC_THINKING_BUDGET,
        ),
        system: systemPrompt,
        messages: currentMessages,
      };
      if (includeTools) body.tools = CHAT_TOOLS.anthropic;
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
      executeTool: options.executeTool,
      executionId: options.executionId,
    });

    const content = streamedContent.trim() || payload.content;
    const thinking = streamedThinking.trim() || payload.thinking || null;
    if (!content) throw new Error("Anthropic no devolvio contenido.");
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
  const makeRequest = (history: GoogleStep[]) => requestGoogleProviderInteraction(
    provider,
    {
      history,
      systemInstruction: systemPrompt,
      tools: CHAT_TOOLS.google,
      thinking: true,
    },
    runtime,
    streamHandlers,
  );
  const payload = await runGoogleToolLoop({
    initialTurn: await makeRequest(googleMessages),
    initialMessages: googleMessages,
    requestNextTurn: makeRequest,
    executeTool: options.executeTool,
    executionId: options.executionId,
  });
  const content = streamedContent.trim() || payload.content;
  if (!content) throw new Error("Google AI no devolvió contenido.");
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
