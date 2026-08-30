import {
  normalizeProviderModel,
  type ProviderConfiguration,
} from "./providerConfiguration";
import {
  anthropicApiHeaders,
  anthropicProxyCredentials,
  explainAnthropicError,
  fetchProviderConfiguration,
  googleApiHeaders,
} from "./providerTransport";

export type ProviderVerificationResult = {
  ok: boolean;
  message: string;
  severity: "success" | "warning" | "error";
};

export type ProviderVerificationOptions = {
  platform: "web" | "native";
  fakeMode?: boolean;
  anthropicProxyUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const ANTHROPIC_API_VERSION = "2023-06-01";
const SUCCESS_MESSAGE = "Conexión verificada.";
const NO_KEY_MESSAGE = "Atención: guarda una API key para conectar el proveedor.";

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const candidate = payload as {
    error?: string | { message?: string };
    message?: string;
  };
  if (typeof candidate.error === "string" && candidate.error.trim()) return candidate.error.trim();
  if (
    candidate.error &&
    typeof candidate.error === "object" &&
    typeof candidate.error.message === "string" &&
    candidate.error.message.trim()
  ) {
    return candidate.error.message.trim();
  }
  if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message.trim();
  return fallback;
}

function severe(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Error grave: no se pudo comprobar la conexión.";
  return /^error\s+grave:/i.test(trimmed) ? trimmed : `Error grave: ${trimmed}`;
}

async function responsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function verifyProviderConfiguration(
  provider: ProviderConfiguration,
  options: ProviderVerificationOptions,
): Promise<ProviderVerificationResult> {
  if (options.fakeMode) {
    return {
      ok: true,
      severity: "success",
      message: "Fixture local activo; no se ha realizado ninguna llamada externa.",
    };
  }

  const apiKey = provider.api_key.trim();
  if (!apiKey) return { ok: false, severity: "warning", message: NO_KEY_MESSAGE };
  const model = normalizeProviderModel(provider.provider, provider.model);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? undefined;

  try {
    let response: Response;
    if (provider.provider === "openai") {
      response = await fetchProviderConfiguration(
        "https://api.openai.com/v1/models",
        { method: "GET", headers: { Authorization: `Bearer ${apiKey}` } },
        fetchImpl,
        timeoutMs,
      );
    } else if (provider.provider === "anthropic" && options.platform === "web") {
      response = await fetchProviderConfiguration(
        options.anthropicProxyUrl || "/chat/providers/anthropic/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...anthropicProxyCredentials(apiKey, provider.workspace_id),
            model,
          }),
        },
        fetchImpl,
        timeoutMs,
      );
      const payload = await responsePayload(response);
      if (!response.ok) {
        return {
          ok: false,
          severity: "error",
          message: severe(explainAnthropicError(
            errorMessage(payload, `Proxy API error (${response.status})`),
          )),
        };
      }
      if (!payload || typeof payload !== "object") {
        return { ok: false, severity: "error", message: severe("Respuesta inválida del proxy API.") };
      }
      const candidate = payload as { ok?: boolean; message?: string };
      const message = (candidate.message ?? "").trim();
      if (candidate.ok === false) {
        return {
          ok: false,
          severity: "error",
          message: severe(explainAnthropicError(message || "No se pudo verificar la conexión.")),
        };
      }
      if (message.toLowerCase().includes("modelo no disponible")) {
        return { ok: true, severity: "warning", message: `Atención: ${message}` };
      }
      return { ok: true, severity: "success", message: SUCCESS_MESSAGE };
    } else if (provider.provider === "anthropic") {
      response = await fetchProviderConfiguration(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: anthropicApiHeaders(
            apiKey,
            ANTHROPIC_API_VERSION,
            provider.workspace_id,
            { "Content-Type": "application/json" },
          ),
          body: JSON.stringify({
            model,
            max_tokens: 1,
            messages: [{ role: "user", content: "Ping de verificación." }],
          }),
        },
        fetchImpl,
        timeoutMs,
      );
      const payload = await responsePayload(response);
      if (response.status === 404) {
        return {
          ok: true,
          severity: "warning",
          message: `Atención: API key verificada. Modelo no disponible: ${model}.`,
        };
      }
      if (!response.ok) {
        return {
          ok: false,
          severity: "error",
          message: severe(explainAnthropicError(
            errorMessage(payload, `Error de conexión (${response.status})`),
          )),
        };
      }
      return { ok: true, severity: "success", message: SUCCESS_MESSAGE };
    } else {
      response = await fetchProviderConfiguration(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
        { method: "GET", headers: googleApiHeaders(apiKey) },
        fetchImpl,
        timeoutMs,
      );
    }

    const payload = await responsePayload(response);
    if (!response.ok) {
      return {
        ok: false,
        severity: "error",
        message: severe(errorMessage(payload, `Error de conexión (${response.status})`)),
      };
    }
    return { ok: true, severity: "success", message: SUCCESS_MESSAGE };
  } catch (error) {
    return {
      ok: false,
      severity: "error",
      message: severe(error instanceof Error ? error.message : "No se pudo comprobar la conexión."),
    };
  }
}
