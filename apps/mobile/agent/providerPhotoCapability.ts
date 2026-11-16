import type { ProviderConfiguration } from "./providerConfiguration";
import { CustomOpenAIError } from "./customOpenAIChat";

export const PHOTO_UNSUPPORTED_MESSAGE =
  "El modelo elegido no permite enviar fotos. Elige otro modelo.";

export function photoCapabilityId(
  provider: Pick<ProviderConfiguration, "provider" | "model" | "base_url">,
): string {
  return JSON.stringify([
    provider.provider,
    provider.model.trim(),
    provider.provider === "custom_openai" ? (provider.base_url ?? "").trim() : "",
  ]);
}

export function isExplicitImageUnsupported(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error instanceof CustomOpenAIError && error.status !== null && ![400, 404, 415, 422, 501].includes(error.status)) {
    return false;
  }
  const message = `${error instanceof CustomOpenAIError ? error.code ?? "" : ""} ${error.message}`.toLowerCase();
  return /image|vision|photo|foto|imagen|multimodal|image_url|image input/.test(message)
    && /not support|unsupported|not available|not accept|cannot process|can't process|does not process|invalid modality|only text|text.only|no soport|no admite|no permite|no procesa|sin soporte/.test(message);
}
