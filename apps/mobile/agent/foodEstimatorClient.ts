import { composeAiSystemPrompt } from "./aiTransparency";
import {
  NUTRITION_FOOD_TYPES,
  formatNutritionValidationIssues,
  validateStructuredNutrition,
} from "../diet/nutritionContract";
import { buildGoogleHistory, type GoogleStep } from "./googleInteractions";
import {
  requestGoogleProviderInteraction,
  type ChatInputMessage,
  type ProviderChatResult,
  type ProviderChatRuntime,
} from "./providerChatClient";
import {
  normalizeProviderModel,
  type ProviderConfiguration,
} from "./providerConfiguration";
import { buildOpenAIReasoningConfig } from "./providerResponseModel";
import type {
  OpenAIFunctionCallOutputItem,
  StreamingHandlers,
} from "./providerStreamParsers";
import {
  streamAnthropicRequestViaXHR,
  streamOpenAIRequestViaFetch,
  streamOpenAIRequestViaXHR,
} from "./providerStreamTransport";
import {
  parseOpenAIFunctionArguments,
  runGoogleToolLoop,
  type AnthropicToolUseBlock,
} from "./providerToolLoop";
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

export const FOOD_ESTIMATOR_SYSTEM_PROMPT =
  "Eres Gymnasia Food Estimator, el sistema de inteligencia artificial de la aplicación Gymnasia especializado en estimación visual de comidas. " +
  "Tu tarea es estimar siempre: calorías totales (kcal), gramos de proteína, gramos de carbohidratos, gramos de grasas y peso total de la comida en gramos. " +
  "Si la información es incierta, indica rangos aproximados y explica supuestos breves. " +
  "Responde en español, de forma clara y práctica. " +
  "IMPORTANTE: Si detectas un código de barras (EAN, UPC) en alguna de las imágenes, DEBES usar la herramienta scan_barcode para buscar el producto. " +
  "Lee los dígitos del código de barras de la imagen y pásalos como parámetro. Con los datos de OpenFoodFacts, presenta la información nutricional exacta del producto. " +
  "Si el usuario pide 'Devuelve json' o 'Devuelve el json', responde únicamente con JSON válido y sin texto adicional, " +
  "con estas claves exactas: dish_name, calories_kcal, protein_g, carbs_g, fat_g. " +
  "Cuando el usuario pregunte o debata, responde usando el contexto previo de la conversación y las fotos adjuntas. " +
  "CLASIFICACIÓN: Cuando estimes un alimento, determina siempre si es un 'producto_comercial' o una 'receta'. " +
  "Un producto comercial es cualquier producto que se pueda comprar en un supermercado, tienda o establecimiento (por ejemplo: yogur Danone, galletas Digestive, Coca-Cola, etc.). " +
  "Si has usado la herramienta scan_barcode, es SIEMPRE un producto comercial. " +
  "Una receta es cualquier plato elaborado o combinación de ingredientes preparada por el usuario (por ejemplo: tortilla de patatas, ensalada César, arroz con pollo, etc.). " +
  "Los alimentos genéricos simples (arroz, pollo, huevo, aceite, fruta...) NO son ni producto comercial ni receta, son alimentos base.";

export const FOOD_AI_SYSTEM_PROMPT =
  "Eres Gymnasia Food Estimator, el sistema de inteligencia artificial de la aplicación Gymnasia especializado en estimaciones nutricionales. El usuario te va a decir un alimento, plato o receta. " +
  "Tu objetivo es estimar los valores nutricionales por unidad base (100g, 1ml, 1 unidad, etc.) sin atribuirte credenciales profesionales. " +
  "Flujo: 1) El usuario te dice un alimento, plato o receta. " +
  "2) Si necesitas más datos (ingredientes, cantidades, modo de preparación), pregúntale. " +
  "3) Cuando tengas toda la información, calcula los valores nutricionales. " +
  "4) Presenta los valores al usuario y pregúntale si son correctos. " +
  "5) Cuando el usuario confirme, devuelve EXACTAMENTE un bloque JSON con este formato:\n" +
  "```json\n" +
  '{"name":"Nombre del alimento","category":"categoría","calories_per_100g":0,"protein_per_100g":0,' +
  '"carbs_per_100g":0,"fat_per_100g":0,"fiber_per_100g":0,"serving_size_g":0,"serving_description":"descripción de ración"}\n' +
  "```\n" +
  "Categorías válidas: proteína, carbohidrato, grasa, fruta, verdura, lácteo, legumbre, fruto-seco, receta, suplemento, bebida, otro. " +
  "Responde siempre en español. Sé conciso pero preciso.";

export const SCAN_BARCODE_TOOL = "scan_barcode";
const SCAN_BARCODE_DESC =
  "Busca un producto alimentario por su código de barras (EAN/UPC) en OpenFoodFacts. " +
  "Usa esta herramienta cuando detectes un código de barras en la imagen del usuario. " +
  "Lee los dígitos del código de barras de la imagen y pásalos como parámetro.";
const SCAN_BARCODE_PARAM_DESC = "El número del código de barras (EAN-13, UPC-A, etc.)";

export type FoodEstimatorImage = {
  id: string;
  uri: string;
  base64: string;
  mime_type: string;
};

export type FoodEstimatorCallOptions = StreamingHandlers & {
  onStatus?: (status: string) => void;
  onToolUsed?: (toolName: string) => void;
};

export type StructuredNutritionResult = {
  dish_name: string;
  grams: number;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  food_type: "producto_comercial" | "receta" | "alimento";
};

const foodEstimatorTools = {
  openai: [
    {
      type: "function",
      name: SCAN_BARCODE_TOOL,
      description: SCAN_BARCODE_DESC,
      parameters: {
        type: "object",
        properties: { barcode: { type: "string", description: SCAN_BARCODE_PARAM_DESC } },
        required: ["barcode"],
      },
    },
  ],
  anthropic: [
    {
      name: SCAN_BARCODE_TOOL,
      description: SCAN_BARCODE_DESC,
      input_schema: {
        type: "object",
        properties: { barcode: { type: "string", description: SCAN_BARCODE_PARAM_DESC } },
        required: ["barcode"],
      },
    },
  ],
  google: [{
    type: "function",
    name: SCAN_BARCODE_TOOL,
    description: SCAN_BARCODE_DESC,
    parameters: {
      type: "object",
      properties: { barcode: { type: "string", description: SCAN_BARCODE_PARAM_DESC } },
      required: ["barcode"],
    },
  }],
};

export async function lookupBarcode(barcode: string): Promise<string> {
  const cleaned = barcode.replace(/\s/g, "");
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleaned)}.json`,
  );
  if (!response.ok) return `Error al buscar código de barras: HTTP ${response.status}`;
  const data = await response.json();
  if (data.status !== 1 || !data.product) {
    return `Producto no encontrado para el código de barras "${cleaned}". Intenta estimar visualmente la comida.`;
  }
  const product = data.product;
  const nutrients = product.nutriments ?? {};
  return JSON.stringify({
    name: product.product_name ?? "Desconocido",
    brands: product.brands ?? "",
    quantity: product.quantity ?? "",
    serving_size: product.serving_size ?? "",
    per_100g: {
      calories_kcal: nutrients["energy-kcal_100g"] ?? null,
      fat_g: nutrients.fat_100g ?? null,
      saturated_fat_g: nutrients["saturated-fat_100g"] ?? null,
      carbs_g: nutrients.carbohydrates_100g ?? null,
      sugars_g: nutrients.sugars_100g ?? null,
      protein_g: nutrients.proteins_100g ?? null,
      fiber_g: nutrients.fiber_100g ?? null,
      salt_g: nutrients.salt_100g ?? null,
    },
    per_serving: {
      calories_kcal: nutrients["energy-kcal_serving"] ?? null,
      fat_g: nutrients.fat_serving ?? null,
      carbs_g: nutrients.carbohydrates_serving ?? null,
      protein_g: nutrients.proteins_serving ?? null,
    },
    ingredients_text: product.ingredients_text ?? "",
    nutriscore_grade: product.nutriscore_grade ?? "",
  });
}

export async function handleFoodEstimatorToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (name === SCAN_BARCODE_TOOL) {
    const barcode = (args.barcode as string) ?? "";
    if (!barcode) return "No se proporcionó un código de barras.";
    return lookupBarcode(barcode);
  }
  return "Herramienta no reconocida.";
}

export async function requestStructuredNutrition(
  provider: ProviderConfiguration,
  conversationSummary: string,
  runtime: ProviderChatRuntime,
): Promise<StructuredNutritionResult> {
  const requireValidStructuredNutrition = (rawValue: unknown): StructuredNutritionResult => {
    const validation = validateStructuredNutrition(rawValue);
    if (!validation.ok) {
      throw new Error(formatNutritionValidationIssues(validation.issues));
    }
    return {
      dish_name: validation.value.name,
      grams: validation.value.grams,
      calories_kcal: validation.value.calories_kcal,
      protein_g: validation.value.protein_g,
      carbs_g: validation.value.carbs_g,
      fat_g: validation.value.fat_g,
      food_type: validation.value.food_type,
    };
  };
  const model = normalizeProviderModel(provider.provider, provider.model);
  const jsonSchema = {
    type: "object" as const,
    properties: {
      dish_name: { type: "string" as const, description: "Nombre del plato o alimento" },
      grams: {
        type: "number" as const,
        minimum: 0,
        description: "Peso total estimado en gramos",
      },
      calories_kcal: {
        type: "number" as const,
        minimum: 0,
        description: "Calorías totales en kcal",
      },
      protein_g: {
        type: "number" as const,
        minimum: 0,
        description: "Proteínas totales en gramos",
      },
      carbs_g: {
        type: "number" as const,
        minimum: 0,
        description: "Carbohidratos totales en gramos",
      },
      fat_g: {
        type: "number" as const,
        minimum: 0,
        description: "Grasas totales en gramos",
      },
      food_type: {
        type: "string" as const,
        enum: [...NUTRITION_FOOD_TYPES],
        description: "Tipo de alimento: producto_comercial, receta o alimento",
      },
    },
    required: [
      "dish_name",
      "grams",
      "calories_kcal",
      "protein_g",
      "carbs_g",
      "fat_g",
      "food_type",
    ] as string[],
    additionalProperties: false,
  };
  const extractPrompt =
    "Basándote en la conversación anterior, devuelve ÚNICAMENTE un JSON con los datos nutricionales estimados. "
    + conversationSummary;

  if (provider.provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content: extractPrompt }],
        text: {
          format: {
            type: "json_schema",
            name: "nutrition",
            strict: true,
            schema: jsonSchema,
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
    const data = await response.json();
    const outputText = data.output?.find(
      (item: Record<string, unknown>) => item.type === "message",
    )?.content?.find(
      (content: Record<string, unknown>) => content.type === "output_text",
    )?.text;
    if (!outputText) throw new Error("No se recibió respuesta de OpenAI");
    return requireValidStructuredNutrition(JSON.parse(outputText));
  }

  if (provider.provider === "anthropic") {
    const proxyUrl = runtime.anthropicWebProxyUrl;
    const response = await fetch(proxyUrl ?? "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: proxyUrl
        ? { "Content-Type": "application/json" }
        : anthropicApiHeaders(
            provider.api_key,
            ANTHROPIC_API_VERSION,
            provider.workspace_id,
            { "Content-Type": "application/json" },
            { directBrowserAccess: runtime.platform === "web" },
          ),
      body: JSON.stringify({
        ...(proxyUrl
          ? anthropicProxyCredentials(provider.api_key, provider.workspace_id)
          : {}),
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: extractPrompt }],
        tool_choice: { type: "tool", name: "extract_nutrition" },
        tools: [{
          name: "extract_nutrition",
          description: "Extrae datos nutricionales del alimento estimado",
          input_schema: jsonSchema,
        }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
    const data = await response.json();
    const toolBlock = data.content?.find(
      (block: Record<string, unknown>) => block.type === "tool_use",
    );
    if (!toolBlock?.input) {
      throw new Error("No se recibió respuesta estructurada de Anthropic");
    }
    return requireValidStructuredNutrition(toolBlock.input);
  }

  const turn = await requestGoogleProviderInteraction(
    provider,
    {
      history: [{
        type: "user_input",
        content: [{ type: "text", text: extractPrompt }],
      }],
      responseSchema: jsonSchema,
    },
    runtime,
  );
  if (turn.status !== "completed" || !turn.content) {
    throw new Error("Google no devolvió datos completos.");
  }
  return requireValidStructuredNutrition(JSON.parse(turn.content));
}

export async function requestFoodEstimate(
  provider: ProviderConfiguration,
  messages: ChatInputMessage[],
  images: FoodEstimatorImage[],
  runtime: ProviderChatRuntime,
  options?: FoodEstimatorCallOptions,
  skipImages?: boolean,
): Promise<ProviderChatResult> {
  if (runtime.fakeMode) {
    const latestUserInput = [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content ?? "";
    const fixture = createFakeProviderResult("food-estimator", latestUserInput);
    options?.onStatus?.("Fixture local");
    options?.onContentDelta?.(fixture.content, fixture.content);
    return fixture;
  }

  const model = normalizeProviderModel(provider.provider, provider.model);
  const normalizedImages = skipImages ? [] : images
    .filter((image) => image.base64.trim().length > 0)
    .map((image) => ({
      ...image,
      mime_type: image.mime_type.trim() || "image/jpeg",
    }));
  const nonSystemMessages = messages.filter((message) => message.role !== "system");
  const systemPrompt = composeAiSystemPrompt(
    messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n"),
    "food-estimator",
  );
  const lastNonSystemUserMessageIndex = (() => {
    for (let index = nonSystemMessages.length - 1; index >= 0; index -= 1) {
      if (nonSystemMessages[index].role === "user") return index;
    }
    return -1;
  })();

  if (provider.provider === "openai") {
    const openAIInputs: Array<Record<string, unknown>> = nonSystemMessages.map((message, index) => {
      const textContent = message.content.trim()
        || "Analiza esta comida y estima los valores solicitados.";
      if (message.role === "assistant") {
        return { role: "assistant", content: [{ type: "output_text", text: textContent }] };
      }
      if (index !== lastNonSystemUserMessageIndex || normalizedImages.length === 0) {
        return { role: "user", content: [{ type: "input_text", text: textContent }] };
      }
      return {
        role: "user",
        content: [
          { type: "input_text", text: textContent },
          ...normalizedImages.map((image) => ({
            type: "input_image",
            image_url: `data:${image.mime_type};base64,${image.base64}`,
            detail: "auto",
          })),
        ],
      };
    });
    let streamedContent = "";
    let streamedThinking = "";
    const streamHandlers: StreamingHandlers = {
      onContentDelta: (delta) => {
        streamedContent += delta;
        options?.onContentDelta?.(delta, streamedContent);
      },
      onThinkingDelta: (delta) => {
        streamedThinking += delta;
        options?.onThinkingDelta?.(delta, streamedThinking);
      },
    };
    const reasoning = buildOpenAIReasoningConfig(provider);
    const makeRequest = async (
      input: Array<Record<string, unknown>>,
      previousResponseId: string | null,
    ) => {
      const body: Record<string, unknown> = {
        model,
        instructions: systemPrompt,
        input,
        tools: foodEstimatorTools.openai,
      };
      if (reasoning) body.reasoning = reasoning;
      if (previousResponseId) body.previous_response_id = previousResponseId;
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

    options?.onStatus?.(normalizedImages.length > 0 ? "Analizando imagen..." : "Pensando...");
    let payload = await makeRequest(openAIInputs, null);
    for (let round = 0; round < 5; round += 1) {
      const toolCalls = payload.outputItems.filter(
        (item): item is OpenAIFunctionCallOutputItem => item.type === "function_call",
      );
      if (toolCalls.length === 0) break;
      const responseId = payload.responseId;
      if (!responseId) {
        throw new Error("OpenAI no devolvio response_id para continuar la estimación.");
      }
      const toolOutputs: Array<Record<string, unknown>> = [];
      for (const toolCall of toolCalls) {
        const toolName = toolCall.name ?? "";
        options?.onStatus?.(
          toolName === SCAN_BARCODE_TOOL
            ? "Leyendo código de barras..."
            : `Usando herramienta: ${toolName}...`,
        );
        options?.onToolUsed?.(toolName);
        const args = parseOpenAIFunctionArguments(toolCall.arguments);
        const result = await handleFoodEstimatorToolCall(toolName, args);
        toolOutputs.push({
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: result,
        });
      }
      options?.onStatus?.("Procesando resultado...");
      payload = await makeRequest(toolOutputs, responseId);
    }

    const content = streamedContent.trim() || payload.content;
    const thinking = streamedThinking.trim() || payload.thinking || null;
    if (!content) throw new Error("OpenAI no devolvio contenido.");
    return { content, thinking };
  }

  if (provider.provider === "anthropic") {
    if (runtime.platform === "web" && normalizedImages.length > 0) {
      throw new Error(
        "Anthropic en web no admite envío de imágenes en este flujo. Usa Google u OpenAI, o abre la app en dispositivo móvil.",
      );
    }

    const buildAnthropicMessages = (): unknown[] => nonSystemMessages.map((message, index) => {
      if (message.role === "assistant") {
        return { role: "assistant", content: message.content.trim() || "Entendido." };
      }
      const textContent = message.content.trim()
        || "Analiza esta comida y estima los valores solicitados.";
      if (index !== lastNonSystemUserMessageIndex || normalizedImages.length === 0) {
        return { role: "user", content: textContent };
      }
      return {
        role: "user",
        content: [
          { type: "text", text: textContent },
          ...normalizedImages.map((image) => ({
            type: "image",
            source: { type: "base64", media_type: image.mime_type, data: image.base64 },
          })),
        ],
      };
    });
    let streamedContent = "";
    let streamedThinking = "";
    const streamHandlers: StreamingHandlers = {
      onContentDelta: (delta) => {
        streamedContent += delta;
        options?.onContentDelta?.(delta, streamedContent);
      },
      onThinkingDelta: (delta) => {
        streamedThinking += delta;
        options?.onThinkingDelta?.(delta, streamedThinking);
      },
    };
    let currentMessages = buildAnthropicMessages();
    const makeRequest = async (requestMessages: unknown[]) => {
      const body: Record<string, unknown> = {
        model,
        thinking: anthropicThinkingConfig(model, ANTHROPIC_THINKING_BUDGET),
        max_tokens: 1200 + ANTHROPIC_THINKING_BUDGET,
        system: systemPrompt,
        messages: requestMessages,
        tools: foodEstimatorTools.anthropic,
      };
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

    options?.onStatus?.(normalizedImages.length > 0 ? "Analizando imagen..." : "Pensando...");
    let payload = await makeRequest(currentMessages);
    for (let round = 0; round < 5; round += 1) {
      const contentBlocks = payload.contentBlocks;
      const toolUseBlocks = contentBlocks.filter(
        (block): block is AnthropicToolUseBlock => block.type === "tool_use",
      );
      if (toolUseBlocks.length === 0) break;
      const toolResults: Array<Record<string, unknown>> = [];
      for (const block of toolUseBlocks) {
        const toolName = block.name ?? "";
        options?.onStatus?.(
          toolName === SCAN_BARCODE_TOOL
            ? "Leyendo código de barras..."
            : `Usando herramienta: ${toolName}...`,
        );
        options?.onToolUsed?.(toolName);
        const result = await handleFoodEstimatorToolCall(toolName, block.input ?? {});
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: contentBlocks },
        { role: "user", content: toolResults },
      ];
      options?.onStatus?.("Procesando resultado...");
      payload = await makeRequest(currentMessages);
    }

    const content = streamedContent.trim() || payload.content;
    const thinking = streamedThinking.trim() || payload.thinking || null;
    if (!content) throw new Error("Anthropic no devolvio contenido.");
    return { content, thinking };
  }

  const googleMessages = buildGoogleHistory(nonSystemMessages.map((message, index) => (
    index === lastNonSystemUserMessageIndex && normalizedImages.length > 0
      ? {
          ...message,
          googleInput: [
            { type: "text", text: message.content },
            ...normalizedImages.map((image) => ({
              type: "image" as const,
              mime_type: image.mime_type,
              data: image.base64,
            })),
          ],
        }
      : message
  )));
  let streamedContent = "";
  let streamedThinking = "";
  const streamHandlers: StreamingHandlers = {
    onContentDelta: (delta) => {
      streamedContent += delta;
      options?.onContentDelta?.(delta, streamedContent);
    },
    onThinkingDelta: (delta) => {
      streamedThinking += delta;
      options?.onThinkingDelta?.(delta, streamedThinking);
    },
  };
  const makeRequest = (history: GoogleStep[]) => requestGoogleProviderInteraction(
    provider,
    {
      history,
      systemInstruction: systemPrompt,
      tools: foodEstimatorTools.google,
      thinking: true,
    },
    runtime,
    streamHandlers,
  );
  options?.onStatus?.(normalizedImages.length > 0 ? "Analizando imagen..." : "Pensando...");
  const payload = await runGoogleToolLoop({
    initialTurn: await makeRequest(googleMessages),
    initialMessages: googleMessages,
    requestNextTurn: makeRequest,
    maxRounds: 5,
    executeTool: async (name, args) => {
      options?.onStatus?.(
        name === SCAN_BARCODE_TOOL
          ? "Leyendo código de barras..."
          : `Usando herramienta: ${name}...`,
      );
      options?.onToolUsed?.(name);
      const result = await handleFoodEstimatorToolCall(name, args);
      options?.onStatus?.("Procesando resultado...");
      return result;
    },
  });
  const content = streamedContent.trim() || payload.content;
  if (!content) throw new Error("Google AI no devolvió contenido.");
  return {
    content,
    thinking: streamedThinking.trim() || payload.thinking,
    googleTurn: {
      version: 1,
      model,
      steps: payload.history,
      interactions: payload.interactions,
    },
  };
}
