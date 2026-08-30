import { readFileSync } from "node:fs";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import devStorePolicy from "../dev-store/policy.json";
import {
  sanitizeDevStoreValue,
  serializeDevStore,
} from "./devStore";

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("saneado del espejo de desarrollo", () => {
  it("elimina secretos anidados sin mutar el estado original", () => {
    const original = {
      keys: [{ provider: "openai", api_key: "sk-private", workspace_id: "ws-private" }],
      nested: {
        token: "token-private",
        child: [{ password: "password-private", content: "sk-private sigue siendo texto" }],
      },
    };

    const sanitized = sanitizeDevStoreValue(original);

    expect(sanitized).toEqual({
      keys: [{ provider: "openai", api_key: "", workspace_id: "" }],
      nested: {
        token: "",
        child: [{ password: "", content: "sk-private sigue siendo texto" }],
      },
    });
    expect(original.keys[0].api_key).toBe("sk-private");
  });

  it("es idempotente para cualquier valor JSON", () => {
    fc.assert(fc.property(fc.jsonValue(), (value) => {
      const once = sanitizeDevStoreValue(value);
      expect(sanitizeDevStoreValue(once)).toEqual(once);
    }));
  });

  it("ningún campo sensible conserva un valor arbitrario", () => {
    fc.assert(fc.property(
      fc.constantFrom(...devStorePolicy.sensitiveFieldNames),
      fc.jsonValue(),
      (field, value) => {
        const sanitized = sanitizeDevStoreValue({ level: [{ [field]: value }] });
        expect(sanitized.level[0][field]).toBe("");
      },
    ));
  });

  it("rechaza referencias circulares en vez de serializar parcialmente", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => sanitizeDevStoreValue(circular)).toThrow(/circulares/);
  });

  it("serializa el estado ya censurado", () => {
    const serialized = serializeDevStore({ api_key: "sk-private", child: { secret: "x" } });
    expect(serialized).toBe('{"api_key":"","child":{"secret":""}}');
    expect(serialized).not.toContain("sk-private");
  });
});

describe("contrato del espejo en App.tsx", () => {
  it("usa el mismo saneador para backups y para el espejo", () => {
    expect(appSource).toContain("store: sanitizeDevStoreValue(data.store)");
    expect(appSource).toContain("body: serializeDevStore(store)");
    expect(appSource).toContain("saveDevStoreFile(store)");
    expect(appSource).not.toContain("saveDevStoreFile(JSON.stringify(store))");
  });

  it("mantiene las claves del navegador fuera de este cambio", () => {
    expect(appSource).toContain("if (!secureStoreAvailable) return store;");
    expect(appSource).toContain("return stripProviderApiKeys(store);");
  });
});
