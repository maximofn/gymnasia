import {
  composeAiSystemPrompt,
  type AiConversationSurface,
} from "./aiTransparency";
import { requestGoogleInteraction } from "./googleStreamTransport";
import {
  buildGoogleHistory,
  type GoogleContent,
  type GoogleConversationTurn,
  type GoogleInteractionTurn,
  type GoogleStep,
} from "./googleInteractions";
import {
  DEFAULT_MODELS,
  normalizeProviderModel,
  type ProviderConfiguration,
} from "./providerConfiguration";
import {
  buildOpenAIReasoningConfig,
  parseAnthropicContent,
  parseOpenAIResponseResult,
} from "./providerResponseModel";
import { extractProviderErrorMessage } from "./providerStreamTransport";
import type { StreamingHandlers } from "./providerStreamParsers";
import {
  anthropicApiHeaders,
  anthropicProxyCredentials,
  anthropicThinkingConfig,
  createFakeProviderResult,
  explainAnthropicError,
} from "./providerTransport";

const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_THINKING_BUDGET = 1024;
const ANTHROPIC_WEB_PROXY_UNREACHABLE_MESSAGE =
  "El proxy configurado en EXPO_PUBLIC_API_BASE_URL no responde. " +
  "Comprueba que sigue levantado, o quita esa variable para que la app hable " +
  "con Anthropic directamente.";

export type ProviderChatResult = {
  content: string;
  thinking: string | null;
  googleTurn?: GoogleConversationTurn;
};

export type ChatInputMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  googleTurn?: GoogleConversationTurn;
  googleInput?: GoogleContent[];
};

export type ProviderChatRuntime = {
  fakeMode: boolean;
  platform: string;
  environment?: string;
  googleFixturePort?: number;
  anthropicWebProxyUrl?: string;
};

export function requestGoogleProviderInteraction(
  provider: ProviderConfiguration,
  options: {
    history: GoogleStep[];
    systemInstruction?: string;
    tools?: Array<Record<string, unknown>>;
    thinking?: boolean;
    responseSchema?: Record<string, unknown>;
  },
  runtime: Pick<ProviderChatRuntime, "platform" | "environment" | "googleFixturePort">,
  handlers?: StreamingHandlers,
): Promise<GoogleInteractionTurn> {
  return requestGoogleInteraction({
    ...options,
    model: provider.model,
    apiKey: provider.api_key,
    platform: runtime.platform,
    environment: runtime.environment,
    fixturePort: runtime.googleFixturePort,
  }, handlers);
}

async function callAnthropicViaWebProxy(
  provider: ProviderConfiguration,
  systemPrompt: string,
  messages: Array<{ role: "assistant" | "user"; content: string }>,
  proxyUrl: string,
): Promise<ProviderChatResult> {
  try {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...anthropicProxyCredentials(provider.api_key, provider.workspace_id),
        model: provider.model || DEFAULT_MODELS.anthropic,
        max_tokens: 700 + ANTHROPIC_THINKING_BUDGET,
        thinking: anthropicThinkingConfig(
          provider.model || DEFAULT_MODELS.anthropic,
          ANTHROPIC_THINKING_BUDGET,
        ),
        system: systemPrompt,
        messages,
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // El mensaje de estado conserva el fallback cuando el cuerpo no es JSON.
    }

    if (!response.ok) {
      throw new Error(explainAnthropicError(
        extractProviderErrorMessage(payload, `Proxy Anthropic error (${response.status})`),
      ));
    }

    const result = parseAnthropicContent(payload);
    if (!result) throw new Error("Anthropic no devolvio contenido.");
    return result;
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : "No se pudo conectar con Anthropic.";
    if (rawMessage.toLowerCase().includes("failed to fetch")) {
      throw new Error(ANTHROPIC_WEB_PROXY_UNREACHABLE_MESSAGE);
    }
    throw new Error(rawMessage);
  }
}

export async function requestProviderText(
  provider: ProviderConfiguration,
  messages: ChatInputMessage[],
  runtime: ProviderChatRuntime,
  surface: AiConversationSurface = "main-chat",
  onGoogleTurn?: (turn: GoogleConversationTurn) => void,
): Promise<string> {
  if (runtime.fakeMode) {
    const latestUserInput = [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content ?? "";
    return createFakeProviderResult(surface, latestUserInput).content;
  }

  const systemPrompt = composeAiSystemPrompt(
    messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n"),
    surface,
  );
  const nonSystemMessages: Array<{ role: "assistant" | "user"; content: string }> = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));

  if (provider.provider === "openai") {
    const reasoning = buildOpenAIReasoningConfig(provider);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model: normalizeProviderModel("openai", provider.model),
        instructions: systemPrompt,
        input: nonSystemMessages,
        ...(reasoning ? { reasoning } : {}),
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // El mensaje de estado conserva el fallback cuando el cuerpo no es JSON.
    }

    if (!response.ok) {
      throw new Error(extractProviderErrorMessage(payload, `OpenAI error (${response.status})`));
    }

    const result = parseOpenAIResponseResult(payload);
    if (!result?.content) throw new Error("OpenAI no devolvio contenido.");
    return result.content;
  }

  if (provider.provider === "anthropic") {
    if (runtime.anthropicWebProxyUrl) {
      const webResult = await callAnthropicViaWebProxy(
        provider,
        systemPrompt,
        nonSystemMessages,
        runtime.anthropicWebProxyUrl,
      );
      return webResult.content;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: anthropicApiHeaders(
        provider.api_key,
        ANTHROPIC_API_VERSION,
        provider.workspace_id,
        { "Content-Type": "application/json" },
        { directBrowserAccess: runtime.platform === "web" },
      ),
      body: JSON.stringify({
        model: provider.model || DEFAULT_MODELS.anthropic,
        max_tokens: 700 + ANTHROPIC_THINKING_BUDGET,
        thinking: anthropicThinkingConfig(
          provider.model || DEFAULT_MODELS.anthropic,
          ANTHROPIC_THINKING_BUDGET,
        ),
        system: systemPrompt,
        messages: nonSystemMessages,
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // El mensaje de estado conserva el fallback cuando el cuerpo no es JSON.
    }

    if (!response.ok) {
      throw new Error(explainAnthropicError(
        extractProviderErrorMessage(payload, `Anthropic error (${response.status})`),
      ));
    }

    const result = parseAnthropicContent(payload);
    if (!result) throw new Error("Anthropic no devolvio contenido.");
    return result.content;
  }

  const turn = await requestGoogleProviderInteraction(provider, {
    history: buildGoogleHistory(messages),
    systemInstruction: systemPrompt,
  }, {
    platform: runtime.platform,
    environment: runtime.environment,
    googleFixturePort: runtime.googleFixturePort,
  });
  if (turn.status !== "completed" || !turn.content) {
    throw new Error("Google AI no devolvió contenido completo.");
  }
  onGoogleTurn?.({
    version: 1,
    model: normalizeProviderModel("google", provider.model),
    steps: turn.steps,
    interactions: [{ id: turn.interactionId, usage: turn.usage }],
  });
  return turn.content;
}
