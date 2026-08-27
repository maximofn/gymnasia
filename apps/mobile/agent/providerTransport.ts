export type FakeProviderSurface =
  | "main-chat"
  | "food-estimator"
  | "personal-food-assistant";

export type FakeProviderResult = {
  content: string;
  thinking: null;
};

export const DEFAULT_GOOGLE_MODEL = "gemini-3.6-flash";
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
