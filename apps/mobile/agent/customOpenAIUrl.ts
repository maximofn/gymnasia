/** A base URL is the user's exact HTTPS origin and optional API prefix. */
export function normalizeCustomOpenAIBaseUrl(raw: string): string {
  const input = raw.trim();
  if (!input) throw new Error("Introduce la URL HTTPS del proveedor personalizado.");
  if (/[\\?#\s]/.test(input)) {
    throw new Error("La URL no puede contener espacios, consultas ni fragmentos.");
  }
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Introduce una URL HTTPS absoluta y válida.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("La URL del proveedor debe empezar por https://, también en la red local.");
  }
  if (parsed.username || parsed.password || !parsed.hostname) {
    throw new Error("La URL no puede incluir credenciales y debe tener un host válido.");
  }
  if (/%2f|%5c/i.test(parsed.pathname)) {
    throw new Error("La ruta de la URL contiene separadores ambiguos.");
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

export function customOpenAIEndpoint(baseUrl: string, route: "models" | "chat/completions"): string {
  return `${normalizeCustomOpenAIBaseUrl(baseUrl)}/${route}`;
}
