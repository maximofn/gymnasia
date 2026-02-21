export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const AUTH_TOKEN_KEY = "gimnasia_token";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function hasAuthToken(): boolean {
  return Boolean(getAuthToken());
}

async function parseErrorMessage(response: Response): Promise<string> {
  let detail = response.statusText;
  try {
    const body = (await response.json()) as { detail?: string; message?: string };
    detail = body.detail ?? body.message ?? detail;
  } catch {
    // Ignore non-JSON responses.
  }
  return detail;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { auth?: boolean }
): Promise<T> {
  const auth = options?.auth ?? false;
  const token = getAuthToken();

  if (auth && !token) {
    throw new ApiError("No hay token de sesion. Inicia sesion primero.", 401);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
