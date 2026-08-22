import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_POLICY_LOCALE,
  isSafeExternalUrl,
  resolvePrivacyPolicyUrl,
} from "./externalLinks";
import {
  MEDICAL_DISCLAIMER,
  PRIVACY_POLICY_CONTACT,
  PRIVACY_POLICY_DIGESTS,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_URLS,
  PRIVACY_POLICY_VERSION,
} from "./generated/legalCopy.generated";

describe("enlace publicado de la política de privacidad", () => {
  it("publica ambos idiomas en HTTPS y bajo el dominio esperado", () => {
    for (const url of Object.values(PRIVACY_POLICY_URLS)) {
      expect(url.startsWith("https://")).toBe(true);
      expect(new URL(url).hostname).toBe("gymnasia.maximofn.com");
    }
    expect(PRIVACY_POLICY_URLS.es).toBe("https://gymnasia.maximofn.com/privacidad");
    expect(PRIVACY_POLICY_URLS.en).toBe("https://gymnasia.maximofn.com/privacy");
  });

  it("registra versión, fecha y contacto", () => {
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-v\d+$/);
    expect(PRIVACY_POLICY_EFFECTIVE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PRIVACY_POLICY_CONTACT).toBe("maximofn@maximofn.com");
  });

  it("lleva el digest de cada idioma para poder contrastar lo publicado", () => {
    for (const digest of Object.values(PRIVACY_POLICY_DIGESTS)) {
      expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
    expect(PRIVACY_POLICY_DIGESTS.es).not.toBe(PRIVACY_POLICY_DIGESTS.en);
  });

  it("declara en ambos idiomas que no es un dispositivo médico", () => {
    expect(MEDICAL_DISCLAIMER.es).toContain("no es un dispositivo médico");
    expect(MEDICAL_DISCLAIMER.es).toContain("profesional sanitario");
    expect(MEDICAL_DISCLAIMER.en).toContain("is not a medical device");
    // El descargo llega como texto plano: los asteriscos del markdown se pierden
    // por el camino o acabarían visibles en la interfaz.
    expect(MEDICAL_DISCLAIMER.es).not.toContain("*");
    expect(MEDICAL_DISCLAIMER.en).not.toContain("*");
  });

  it("cae al español mientras la app no tenga selector de idioma", () => {
    expect(DEFAULT_POLICY_LOCALE).toBe("es");
    expect(resolvePrivacyPolicyUrl()).toBe(PRIVACY_POLICY_URLS.es);
    expect(resolvePrivacyPolicyUrl(null)).toBe(PRIVACY_POLICY_URLS.es);
    expect(resolvePrivacyPolicyUrl("es-ES")).toBe(PRIVACY_POLICY_URLS.es);
    expect(resolvePrivacyPolicyUrl("en")).toBe(PRIVACY_POLICY_URLS.en);
    expect(resolvePrivacyPolicyUrl("EN-GB")).toBe(PRIVACY_POLICY_URLS.en);
  });

  it("ninguna entrada produce una URL fuera de las publicadas", () => {
    const published = Object.values(PRIVACY_POLICY_URLS) as string[];
    fc.assert(
      fc.property(fc.string(), (locale) => {
        const url = resolvePrivacyPolicyUrl(locale);
        expect(published).toContain(url);
        expect(isSafeExternalUrl(url)).toBe(true);
      }),
    );
  });
});

describe("validación de enlaces externos", () => {
  it("acepta HTTPS con host", () => {
    expect(isSafeExternalUrl("https://gymnasia.maximofn.com/privacidad")).toBe(true);
    expect(isSafeExternalUrl("https://github.com/maximofn/gymnasia/releases")).toBe(true);
  });

  it("rechaza esquemas que no son navegación", () => {
    for (const url of [
      "http://gymnasia.maximofn.com/privacidad",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "intent://scan#Intent;scheme=zxing;end",
      "",
      "no es una url",
    ]) {
      expect(isSafeExternalUrl(url)).toBe(false);
    }
  });

  it("rechaza URLs con credenciales embebidas", () => {
    // Disfrazan el destino real: el host que se lee no es al que se navega.
    expect(isSafeExternalUrl("https://gymnasia.maximofn.com@malicioso.example/")).toBe(false);
    expect(isSafeExternalUrl("https://user:pass@malicioso.example/")).toBe(false);
  });

  it("nunca acepta una cadena que no empiece por https", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        if (isSafeExternalUrl(value)) {
          expect(value.startsWith("https://")).toBe(true);
        }
      }),
    );
  });
});
