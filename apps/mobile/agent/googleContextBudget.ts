import type { GoogleContent, GoogleStep } from "./googleInteractions";
import { normalizeGoogleModel } from "./providerTransport";

export type GoogleInteractionRequestInput = {
  model: string;
  history: GoogleStep[];
  systemInstruction?: string;
  tools?: Array<Record<string, unknown>>;
  thinking?: boolean;
  responseSchema?: Record<string, unknown>;
};

export type GoogleContextBudget = Readonly<{
  maxExchanges: number;
  maxNonImageBytes: number;
  maxRequestBytes: number;
}>;

export const DEFAULT_GOOGLE_CONTEXT_BUDGET: GoogleContextBudget = {
  maxExchanges: 10,
  maxNonImageBytes: 512 * 1024,
  // Google admite imágenes inline mientras la petición completa no supere
  // 20 MB. El margen evita que pequeños cambios del envoltorio rocen el límite.
  maxRequestBytes: 19_000_000,
};

export type GoogleContextReason =
  | "exchange_limit"
  | "non_image_bytes"
  | "request_bytes"
  | "stale_images";

export type GoogleContextReport = Readonly<{
  outcome: "prepared" | "rejected";
  originalExchanges: number;
  sentExchanges: number;
  droppedExchanges: number;
  candidateNonImageBytes: number;
  sentNonImageBytes: number;
  candidateRequestBytes: number;
  sentRequestBytes: number;
  removedImageCount: number;
  removedImageEncodedBytes: number;
  reasons: readonly GoogleContextReason[];
}>;

export type GoogleContextBudgetErrorCode =
  | "google_images_too_large"
  | "google_context_too_large";

export class GoogleContextBudgetError extends Error {
  readonly code: GoogleContextBudgetErrorCode;
  readonly report: GoogleContextReport;

  constructor(code: GoogleContextBudgetErrorCode, report: GoogleContextReport) {
    super(code === "google_images_too_large"
      ? "Las imágenes seleccionadas ocupan demasiado para enviarlas a Google. Quita alguna y vuelve a intentarlo."
      : "El contexto imprescindible de esta consulta es demasiado grande para enviarlo a Google. Reduce el contenido o inicia una conversación nueva.");
    this.name = "GoogleContextBudgetError";
    this.code = code;
    this.report = report;
  }
}

type GoogleExchange = {
  steps: GoogleStep[];
  hasUserInput: boolean;
};

const STALE_IMAGE_PLACEHOLDER = "Imagen anterior omitida después de su análisis.";

function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function omitImageDataFromParts(parts: GoogleContent[] | undefined): GoogleContent[] | undefined {
  return parts?.map((part) => part.type === "image" ? { ...part, data: "" } : part);
}

function omitInlineImageData(history: readonly GoogleStep[]): GoogleStep[] {
  return history.map((step): GoogleStep => {
    if (step.type === "user_input" || step.type === "model_output") {
      return { ...step, content: omitImageDataFromParts(step.content) ?? [] };
    }
    if (step.type === "thought") {
      return step.summary
        ? { ...step, summary: omitImageDataFromParts(step.summary) }
        : step;
    }
    if (step.type === "function_result") {
      return { ...step, result: omitImageDataFromParts(step.result) ?? [] };
    }
    return step;
  });
}

function splitGoogleExchanges(history: readonly GoogleStep[]): GoogleExchange[] {
  if (history.length === 0) return [];
  const exchanges: GoogleExchange[] = [];
  let current: GoogleExchange = { steps: [], hasUserInput: false };

  for (const step of history) {
    if (step.type === "user_input" && current.hasUserInput) {
      exchanges.push(current);
      current = { steps: [], hasUserInput: false };
    }
    current.steps.push(step);
    if (step.type === "user_input") current.hasUserInput = true;
  }
  if (current.steps.length > 0) exchanges.push(current);
  return exchanges;
}

function stripStaleImages(exchange: GoogleExchange): {
  exchange: GoogleExchange;
  removedImageCount: number;
  removedImageEncodedBytes: number;
} {
  let removedImageCount = 0;
  let removedImageEncodedBytes = 0;
  const steps = exchange.steps.map((step): GoogleStep => {
    if (step.type !== "user_input") return step;
    const content = step.content.filter((part) => {
      if (part.type !== "image") return true;
      removedImageCount += 1;
      if (typeof part.data === "string") {
        removedImageEncodedBytes += new TextEncoder().encode(part.data).byteLength;
      }
      return false;
    });
    if (content.length === step.content.length) return step;
    return {
      ...step,
      content: content.length > 0
        ? content
        : [{ type: "text", text: STALE_IMAGE_PLACEHOLDER }],
    };
  });
  return {
    exchange: { ...exchange, steps },
    removedImageCount,
    removedImageEncodedBytes,
  };
}

function hasInlineImage(exchange: GoogleExchange | undefined): boolean {
  return !!exchange?.steps.some((step) =>
    step.type === "user_input"
    && step.content.some((part) => part.type === "image"));
}

function assertGoogleContextBudget(budget: GoogleContextBudget): void {
  if (!Number.isInteger(budget.maxExchanges) || budget.maxExchanges < 1
    || !Number.isInteger(budget.maxNonImageBytes) || budget.maxNonImageBytes < 1
    || !Number.isInteger(budget.maxRequestBytes) || budget.maxRequestBytes < 1) {
    throw new Error("El presupuesto de contexto de Google no es válido.");
  }
}

function addReason(reasons: GoogleContextReason[], reason: GoogleContextReason): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

export function buildGoogleInteractionRequest(
  input: GoogleInteractionRequestInput,
): Record<string, unknown> {
  return {
    model: normalizeGoogleModel(input.model),
    input: input.history,
    stream: true,
    store: false,
    ...(input.systemInstruction ? { system_instruction: input.systemInstruction } : {}),
    ...(input.tools?.length ? { tools: input.tools } : {}),
    ...(input.thinking ? { generation_config: { thinking_level: "high", thinking_summaries: "auto" } } : {}),
    ...(input.responseSchema ? { response_format: {
      type: "text", mime_type: "application/json", schema: input.responseSchema,
    } } : {}),
  };
}

export function prepareGoogleInteractionRequest(
  input: GoogleInteractionRequestInput,
  budget: GoogleContextBudget = DEFAULT_GOOGLE_CONTEXT_BUDGET,
): { body: Record<string, unknown>; report: GoogleContextReport } {
  assertGoogleContextBudget(budget);
  const originalExchanges = input.history.filter((step) => step.type === "user_input").length;
  const originalUnits = splitGoogleExchanges(input.history);
  const latestUnitHasImage = hasInlineImage(originalUnits[originalUnits.length - 1]);
  const reasons: GoogleContextReason[] = [];
  let removedImageCount = 0;
  let removedImageEncodedBytes = 0;

  let selectedUnits = originalUnits.slice(-budget.maxExchanges);
  if (selectedUnits.length < originalUnits.length) addReason(reasons, "exchange_limit");

  selectedUnits = selectedUnits.map((exchange, index) => {
    if (index === selectedUnits.length - 1) return exchange;
    const sanitized = stripStaleImages(exchange);
    removedImageCount += sanitized.removedImageCount;
    removedImageEncodedBytes += sanitized.removedImageEncodedBytes;
    return sanitized.exchange;
  });
  if (removedImageCount > 0) addReason(reasons, "stale_images");

  const measureSelection = () => {
    const history = selectedUnits.flatMap((exchange) => exchange.steps);
    const body = buildGoogleInteractionRequest({ ...input, history });
    return {
      body,
      requestBytes: jsonByteLength(body),
      nonImageBytes: jsonByteLength(buildGoogleInteractionRequest({
        ...input,
        history: omitInlineImageData(history),
      })),
    };
  };

  let measured = measureSelection();
  // Estos tamaños describen el candidato ya saneado y limitado a diez
  // intercambios. Así el diagnóstico nunca obliga a serializar un historial
  // local potencialmente ilimitado ni sus imágenes antiguas.
  const candidateRequestBytes = measured.requestBytes;
  const candidateNonImageBytes = measured.nonImageBytes;
  while (selectedUnits.length > 1
    && (measured.nonImageBytes > budget.maxNonImageBytes
      || measured.requestBytes > budget.maxRequestBytes)) {
    if (measured.nonImageBytes > budget.maxNonImageBytes) {
      addReason(reasons, "non_image_bytes");
    }
    if (measured.requestBytes > budget.maxRequestBytes) addReason(reasons, "request_bytes");
    selectedUnits = selectedUnits.slice(1);
    measured = measureSelection();
  }

  if (measured.nonImageBytes > budget.maxNonImageBytes) {
    addReason(reasons, "non_image_bytes");
  }
  if (measured.requestBytes > budget.maxRequestBytes) addReason(reasons, "request_bytes");

  const sentExchanges = selectedUnits.reduce(
    (total, exchange) => total + (exchange.hasUserInput ? 1 : 0),
    0,
  );
  const baseReport = {
    originalExchanges,
    sentExchanges,
    droppedExchanges: Math.max(0, originalExchanges - sentExchanges),
    candidateNonImageBytes,
    sentNonImageBytes: measured.nonImageBytes,
    candidateRequestBytes,
    sentRequestBytes: measured.requestBytes,
    removedImageCount,
    removedImageEncodedBytes,
    reasons,
  };

  if (measured.nonImageBytes > budget.maxNonImageBytes
    || measured.requestBytes > budget.maxRequestBytes) {
    const report: GoogleContextReport = { outcome: "rejected", ...baseReport };
    throw new GoogleContextBudgetError(
      latestUnitHasImage && measured.requestBytes > budget.maxRequestBytes
        ? "google_images_too_large"
        : "google_context_too_large",
      report,
    );
  }

  return {
    body: measured.body,
    report: { outcome: "prepared", ...baseReport },
  };
}
