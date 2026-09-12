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
