// Resolución y validación de enlaces externos (GYM-190).
//
// Separado del adaptador que llama a `Linking` para que la lógica sea comprobable
// en Node: la decisión de qué URL se abre y si es aceptable no debería depender de
// tener un dispositivo delante.

import {
  PRIVACY_POLICY_URLS,
  type PolicyLocale,
} from "./generated/legalCopy.generated";

export const DEFAULT_POLICY_LOCALE: PolicyLocale = "es";

/**
 * Solo se abren URLs https con host. Un enlace legal que aceptara `javascript:` o
 * `file:` sería una vía de ejecución disfrazada de aviso de privacidad, y uno con
 * credenciales embebidas (`https://user:pass@host`) es la forma clásica de disfrazar
 * el destino real.
 */
export function isSafeExternalUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (!parsed.hostname) return false;
  if (parsed.username || parsed.password) return false;
  return true;
}

/**
 * Elige el idioma de la política publicada. La app todavía no tiene selector de
 * idioma (GYM-147); mientras tanto, cualquier entrada que no sea inglés cae al
 * español, que es el idioma de la interfaz.
 */
export function resolvePrivacyPolicyUrl(locale?: string | null): string {
  const normalized = (locale ?? "").trim().toLowerCase();
  const matched: PolicyLocale = normalized.startsWith("en") ? "en" : DEFAULT_POLICY_LOCALE;
  return PRIVACY_POLICY_URLS[matched];
}
