export type FakeProviderSurface =
  | "main-chat"
  | "food-estimator"
  | "personal-food-assistant";

export type FakeProviderResult = {
  content: string;
  thinking: null;
};

export const DEFAULT_GOOGLE_MODEL = "gemini-3.6-flash";
export const PROVIDER_CONFIGURATION_REQUEST_TIMEOUT_MS = 15_000;
const LEGACY_GOOGLE_DEFAULT_MODELS = new Set([
  "gemini-1.5-flash",
  "gemini-3-flash-preview",
]);

export function normalizeGoogleModel(rawModel: string | null | undefined): string {
  const model = (rawModel ?? "").trim();
  if (!model || LEGACY_GOOGLE_DEFAULT_MODELS.has(model)) {
    return DEFAULT_GOOGLE_MODEL;
  }
  return model;
}

export function googleApiHeaders(
  apiKey: string,
  extraHeaders: Record<string, string> = {},
): Record<string, string> {
  return {
    ...extraHeaders,
    "x-goog-api-key": apiKey.trim(),
  };
}

export function normalizeAnthropicWorkspaceId(
  workspaceId: string | null | undefined,
): string {
  return (workspaceId ?? "").trim();
}

// Anthropic solo devuelve cabeceras CORS si la petición declara esta. Sin
// ella el navegador recibe la respuesta y se niega a dejar que la página la
// lea, que es el muro por el que existía el proxy de desarrollo. Se llama
// "dangerous" porque expone la clave a quien abra las herramientas del
// navegador; aquí la clave es del propio usuario y ya vive en su navegador,
// igual que las de OpenAI y Google.
export const ANTHROPIC_DIRECT_BROWSER_ACCESS_HEADER =
  "anthropic-dangerous-direct-browser-access";

export function anthropicApiHeaders(
  apiKey: string,
  apiVersion: string,
  workspaceId?: string | null,
  extraHeaders: Record<string, string> = {},
  options: { directBrowserAccess?: boolean } = {},
): Record<string, string> {
  const normalizedWorkspaceId = normalizeAnthropicWorkspaceId(workspaceId);
  return {
    ...extraHeaders,
    "x-api-key": apiKey.trim(),
    "anthropic-version": apiVersion,
    ...(normalizedWorkspaceId
      ? { "anthropic-workspace-id": normalizedWorkspaceId }
      : {}),
    // En nativo no hay origen que validar, así que no se envía.
    ...(options.directBrowserAccess
      ? { [ANTHROPIC_DIRECT_BROWSER_ACCESS_HEADER]: "true" }
      : {}),
  };
}

export function anthropicProxyCredentials(
  apiKey: string,
  workspaceId?: string | null,
): { api_key: string; workspace_id?: string } {
  const normalizedWorkspaceId = normalizeAnthropicWorkspaceId(workspaceId);
  return {
    api_key: apiKey.trim(),
    ...(normalizedWorkspaceId ? { workspace_id: normalizedWorkspaceId } : {}),
  };
}

export function explainAnthropicError(message: string): string {
  const trimmed = message.trim();
  if (
    trimmed.toLowerCase().includes("anthropic-workspace-id is required")
    || trimmed.toLowerCase().includes("workspace id is required")
  ) {
    return "Anthropic exige el Workspace ID para esta clave. Copia el valor wrkspc_… desde la consola de Anthropic y añádelo en Ajustes > Proveedor IA.";
  }
  return trimmed;
}

const PERSONAL_FOOD_FIXTURE = {
  name: "Yogur de desarrollo",
  category: "lácteos",
  calories_per_100g: 63,
  protein_per_100g: 5,
  carbs_per_100g: 7,
  fat_per_100g: 2,
  fiber_per_100g: 0,
  serving_size_g: 125,
  serving_description: "1 unidad (125 g)",
};

export function createFakeProviderResult(
  surface: FakeProviderSurface,
  userInput: string,
): FakeProviderResult {
  if (surface === "personal-food-assistant") {
    return {
      content: `Fixture local determinista:\n\n\`\`\`json\n${JSON.stringify(PERSONAL_FOOD_FIXTURE, null, 2)}\n\`\`\``,
      thinking: null,
    };
  }
  if (surface === "food-estimator") {
    return {
      content: "Fixture local: 1 ración estimada, 320 kcal, 24 g de proteína, 36 g de carbohidratos y 9 g de grasa.",
      thinking: null,
    };
  }
  const normalizedInput = userInput.trim().replace(/\s+/g, " ").slice(0, 80);
  return {
    content: normalizedInput
      ? `Fixture local de Gymnasia Coach para: “${normalizedInput}”.`
      : "Fixture local de Gymnasia Coach.",
    thinking: null,
  };
}

export const FAKE_PROVIDER_MODELS = {
  openai: [{ id: "fixture-openai", owned_by: "gymnasia" }],
  anthropic: [{ id: "fixture-anthropic", display_name: "Fixture Anthropic" }],
  google: [{ id: "fixture-google", display_name: "Fixture Google" }],
} as const;

export function providerCredential(
  configuredValue: string | null | undefined,
  fakeMode: boolean,
): string {
  const value = (configuredValue ?? "").trim();
  return value || (fakeMode ? "development-fixture" : "");
}

export async function fetchProviderConfiguration(
  input: string,
  init: RequestInit,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = PROVIDER_CONFIGURATION_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Tiempo de espera agotado al contactar con el proveedor.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
