import type { ProviderConfiguration } from "./providerConfiguration";
import { customOpenAIEndpoint } from "./customOpenAIUrl";
import { CustomOpenAIError } from "./customOpenAIChat";

export type CustomOpenAIModelsResult = {
  options: Array<{ id: string; owned_by: string | null }>;
  unavailable: boolean;
};

async function readModelsResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const raw = await response.text();
    if (raw.length > 1_048_576) throw new CustomOpenAIError("El catálogo de modelos es demasiado grande.");
    return raw;
  }
  const decoder = new TextDecoder();
  let raw = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
    if (raw.length > 1_048_576) {
      await reader.cancel().catch(() => {});
      throw new CustomOpenAIError("El catálogo de modelos es demasiado grande.");
    }
  }
  return raw + decoder.decode();
}

export async function fetchCustomOpenAIModels(
  provider: Pick<ProviderConfiguration, "base_url" | "api_key">,
  options: { platform: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<CustomOpenAIModelsResult> {
  const url = customOpenAIEndpoint(provider.base_url ?? "", "models");
  const apiKey = provider.api_key.trim();
  if (!apiKey) throw new CustomOpenAIError("Guarda una API key antes de consultar los modelos.");
  const fetchImpl = options.fetchImpl ?? (options.platform === "web"
    ? fetch
    : (await import("expo/fetch")).fetch as typeof fetch);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      credentials: "omit",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if ([404, 405, 501].includes(response.status)) {
      await response.body?.cancel().catch(() => {});
      return { options: [], unavailable: true };
    }
    const raw = await readModelsResponse(response);
    if (!response.ok) {
      let payload: { error?: { message?: string }; message?: string } | null = null;
      try { payload = JSON.parse(raw); } catch { /* Status fallback. */ }
      const detail = payload?.error?.message ?? payload?.message ?? `Error del proveedor (${response.status}).`;
      throw new CustomOpenAIError(detail.replaceAll(apiKey, "[clave oculta]").slice(0, 500), response.status);
    }
    let payload: { data?: unknown[]; models?: unknown[] };
    try { payload = JSON.parse(raw); }
    catch { throw new CustomOpenAIError("El catálogo de modelos no contiene JSON válido."); }
    const records = Array.isArray(payload.models) ? payload.models : payload.data;
    if (!Array.isArray(records)) {
      throw new CustomOpenAIError("El catálogo de modelos no tiene el formato OpenAI esperado.");
    }
    const entries = new Map<string, { id: string; owned_by: string | null }>();
    for (const rawItem of records) {
      const item = rawItem as { id?: unknown; owned_by?: unknown };
      const id = typeof item?.id === "string" ? item.id.trim() : "";
      if (!id) continue;
      entries.set(id, {
        id,
        owned_by: typeof item.owned_by === "string" ? item.owned_by : null,
      });
    }
    return { options: [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)), unavailable: false };
  } catch (error) {
    if (error instanceof CustomOpenAIError) throw error;
    if (controller.signal.aborted) throw new CustomOpenAIError("Tiempo de espera agotado al consultar los modelos.");
    throw new CustomOpenAIError("No se pudo consultar el proveedor. Comprueba la red, HTTPS y CORS si usas web.");
  } finally {
    clearTimeout(timeout);
  }
}
