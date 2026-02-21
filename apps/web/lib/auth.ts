import { apiFetch, clearAuthToken, setAuthToken } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  email_verified_at: string | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
};

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(response.access_token);
  return response;
}

export async function register(email: string, password: string, birthDate: string): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, birth_date: birthDate }),
  });
  setAuthToken(response.access_token);
  return response;
}

export async function verifyEmail(): Promise<{ ok: boolean; message: string }> {
  return apiFetch<{ ok: boolean; message: string }>("/auth/verify-email", {
    method: "POST",
    auth: true,
    body: JSON.stringify({}),
  });
}

export async function forgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch<{ ok: boolean; message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(email: string, newPassword: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, new_password: newPassword }),
  });
}

export async function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/me", { auth: true });
}

export function logout(): void {
  clearAuthToken();
}
