/**
 * Lectura del catálogo de modelos de Anthropic, con paginación.
 *
 * Vive aquí y no en App.tsx porque App.tsx no es testeable por unidades: la
 * configuración de Vitest solo recoge `agent/**\/*.test.ts`.
 *
 * Anthropic pagina `/v1/models` con `has_more` y `last_id`. Antes ni el proxy
 * ni la app los miraban, así que un catálogo que no cupiera en una página
 * aparecía recortado en el desplegable sin ningún aviso. El móvil llama a la
 * API directamente, sin pasar por el proxy, así que arreglarlo solo en el proxy
 * habría dejado el navegador bien y el móvil mal.
 */

export type AnthropicModelOption = { id: string; display_name: string | null };

export type AnthropicModelPage = {
  options: AnthropicModelOption[];
  /** Quedan más páginas por pedir a la API. */
  hasMore: boolean;
  /** Cursor para la siguiente página. */
  lastId: string | null;
  /** El proxy agotó su tope de páginas. */
  truncated: boolean;
  /** El proxy devolvió una lista incompleta porque una página falló. */
  partial: boolean;
};

export type AnthropicModelCatalog = {
  options: AnthropicModelOption[];
  pagesFetched: number;
  truncated: boolean;
  partial: boolean;
  /** Texto listo para enseñar cuando la lista no está completa. */
  warning: string | null;
};

export const ANTHROPIC_MODELS_PAGE_LIMIT = 100;
export const ANTHROPIC_MODELS_MAX_PAGES = 20;

export const ANTHROPIC_MODELS_INCOMPLETE_WARNING =
  "No se pudo leer el catálogo completo de Anthropic: puede faltar algún modelo.";

type RawModelItem = { id?: unknown; display_name?: unknown };

function normalizeItem(item: unknown): AnthropicModelOption | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as RawModelItem;
  const modelId = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!modelId) return null;
  const displayName = typeof raw.display_name === "string" ? raw.display_name.trim() : "";
  return { id: modelId, display_name: displayName || null };
}

/**
 * Lee una página del catálogo.
 *
 * Acepta las dos formas que circulan: la respuesta cruda de Anthropic
 * (`data` + `has_more` + `last_id`) y el envoltorio del proxy, que ya recorrió
 * la paginación por su cuenta y añade `pagination`. Cuando llega ese
 * envoltorio no hay nada más que pedir, pero sí puede haber que avisar.
 */
export function parseAnthropicModelPage(payload: unknown): AnthropicModelPage {
  const empty: AnthropicModelPage = {
    options: [],
    hasMore: false,
    lastId: null,
    truncated: false,
    partial: false,
  };
  if (!payload || typeof payload !== "object") return empty;

  const record = payload as {
    data?: unknown;
    models?: unknown;
    has_more?: unknown;
    last_id?: unknown;
    pagination?: unknown;
  };

  const rawItems = Array.isArray(record.models)
    ? record.models
    : Array.isArray(record.data)
      ? record.data
      : [];

  const dedup = new Map<string, AnthropicModelOption>();
  rawItems.forEach((item) => {
    const option = normalizeItem(item);
    if (option) dedup.set(option.id, option);
  });
  const options = Array.from(dedup.values());

  const envelope =
    record.pagination && typeof record.pagination === "object"
      ? (record.pagination as { truncated?: unknown; partial?: unknown })
      : null;

  if (envelope) {
    return {
      options,
      hasMore: false,
      lastId: null,
      truncated: envelope.truncated === true,
      partial: envelope.partial === true,
    };
  }

  return {
    options,
    hasMore: record.has_more === true,
    lastId: typeof record.last_id === "string" && record.last_id ? record.last_id : null,
    truncated: false,
    partial: false,
  };
}

/** Compatibilidad con los consumidores que solo quieren la lista. */
export function parseAnthropicModelOptions(payload: unknown): AnthropicModelOption[] {
  return parseAnthropicModelPage(payload).options;
}

/**
 * Recorre el catálogo entero pidiendo página tras página.
 *
 * `fetchPage` va inyectada, así que esta función no sabe de red y se prueba
 * sin ella. Si falla la primera página el error se propaga —no hay nada que
 * enseñar—; si falla una posterior se devuelve lo acumulado marcado como
 * incompleto, porque un desplegable con parte del catálogo y un aviso sirve
 * más que un error total. Lo que no puede es parecer completo.
 */
export async function collectAnthropicModels(
  fetchPage: (afterId: string | null) => Promise<unknown>,
): Promise<AnthropicModelCatalog> {
  const options: AnthropicModelOption[] = [];
  const seen = new Set<string>();
  let afterId: string | null = null;
  let pagesFetched = 0;
  let truncated = false;
  let partial = false;
  let completed = false;

  while (pagesFetched < ANTHROPIC_MODELS_MAX_PAGES) {
    let payload: unknown;
    try {
      payload = await fetchPage(afterId);
    } catch (err) {
      if (pagesFetched === 0) throw err;
      partial = true;
      break;
    }

    pagesFetched += 1;
    const page = parseAnthropicModelPage(payload);
    truncated = truncated || page.truncated;
    partial = partial || page.partial;

    let added = 0;
    page.options.forEach((option) => {
      if (seen.has(option.id)) return;
      seen.add(option.id);
      options.push(option);
      added += 1;
    });

    if (!page.hasMore) {
      completed = true;
      break;
    }

    // Tres cortafuegos contra un upstream que diga "hay más" para siempre: el
    // tope de páginas de la condición, un cursor ausente o repetido, y una
    // página que no aporta ningún modelo nuevo.
    if (!page.lastId || page.lastId === afterId || added === 0) {
      truncated = true;
      break;
    }
    afterId = page.lastId;
  }

  if (!completed && !partial) truncated = true;

  const incomplete = truncated || partial;
  return {
    options,
    pagesFetched,
    truncated,
    partial,
    warning: incomplete ? ANTHROPIC_MODELS_INCOMPLETE_WARNING : null,
  };
}

/** Query string de una página, compartida por la ruta nativa y la del proxy. */
export function anthropicModelsQuery(afterId: string | null): string {
  const params = new URLSearchParams({ limit: String(ANTHROPIC_MODELS_PAGE_LIMIT) });
  if (afterId) params.set("after_id", afterId);
  return `?${params.toString()}`;
}
