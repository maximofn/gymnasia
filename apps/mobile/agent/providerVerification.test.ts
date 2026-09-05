import { describe, expect, it, vi } from "vitest";

import type { ProviderConfiguration } from "./providerConfiguration";
import { verifyProviderConfiguration } from "./providerVerification";

function provider(
  providerName: ProviderConfiguration["provider"],
  overrides: Partial<ProviderConfiguration> = {},
): ProviderConfiguration {
  return {
    provider: providerName,
    is_active: providerName === "openai",
    api_key: `${providerName}-secret`,
    model: providerName === "openai"
      ? "gpt-5.6-luna"
      : providerName === "anthropic"
        ? "claude-test"
        : "gemini-test",
    ...overrides,
  };
}

describe("provider verification", () => {
  it("verifies OpenAI without placing its key in the URL", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;

    const result = await verifyProviderConfiguration(provider("openai"), {
      platform: "native",
      fetchImpl,
    });

    expect(result).toEqual({ ok: true, severity: "success", message: "Conexión verificada." });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(String(url)).not.toContain("openai-secret");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer openai-secret");
  });

  it("rejects a provider credential on a 401 response", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      error: { message: "API key incorrecta" },
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;

    const result = await verifyProviderConfiguration(provider("openai"), {
      platform: "native",
      fetchImpl,
    });

    expect(result).toEqual({
      ok: false,
      severity: "error",
      message: "Error grave: API key incorrecta",
    });
  });

  it("accepts an Anthropic credential with a warning when only its model is missing", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      error: { message: "model not found" },
    }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;

    const result = await verifyProviderConfiguration(provider("anthropic"), {
      platform: "native",
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.severity).toBe("warning");
    expect(result.message).toContain("claude-test");
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(String(url)).not.toContain("anthropic-secret");
    expect(new Headers(init?.headers).get("x-api-key")).toBe("anthropic-secret");
    expect(String(init?.body)).not.toContain("anthropic-secret");
  });

  it("uses the web proxy contract for Anthropic", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      message: "Conexión verificada.",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;

    const result = await verifyProviderConfiguration(
      provider("anthropic", { workspace_id: "wrkspc_test" }),
      {
        platform: "web",
        anthropicProxyUrl: "http://127.0.0.1:8000/chat/providers/anthropic/verify",
        fetchImpl,
      },
    );

    expect(result.ok).toBe(true);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/chat/providers/anthropic/verify");
    expect(JSON.parse(String(init?.body))).toEqual({
      api_key: "anthropic-secret",
      workspace_id: "wrkspc_test",
      model: "claude-test",
    });
  });

  it("reports a bounded timeout instead of waiting indefinitely", async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      })) as unknown as typeof fetch;

    const result = await verifyProviderConfiguration(provider("google"), {
      platform: "native",
      fetchImpl,
      timeoutMs: 5,
    });

    expect(result).toEqual({
      ok: false,
      severity: "error",
      message: "Error grave: Tiempo de espera agotado al contactar con el proveedor.",
    });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(String(url)).not.toContain("google-secret");
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("google-secret");
  });

  it("short-circuits fake mode without touching the network", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await verifyProviderConfiguration(provider("google"), {
      platform: "native",
      fakeMode: true,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
