// GENERADO: no editar a mano.
// Fuente: docs/legal/privacy-policy.{es,en}.md
// Regenerar: npm run sync:legal
//
// La app enlaza la política publicada y declara el descargo sanitario desde aquí,
// para que el texto legal tenga un único origen (GYM-190).

export const PRIVACY_POLICY_VERSION = "2026-08-v5";
export const PRIVACY_POLICY_EFFECTIVE_DATE = "2026-08-23";
export const PRIVACY_POLICY_CONTACT = "maximofn@maximofn.com";

export const PRIVACY_POLICY_URLS = {
  es: "https://gymnasia.maximofn.com/privacidad",
  en: "https://gymnasia.maximofn.com/privacy",
} as const;

export const PRIVACY_POLICY_DIGESTS = {
  es: "sha256:fadbe8e6c3d9eecf76599ee4f52766ea5db81a36b1dda1bf07aac0b82dd3726d",
  en: "sha256:a13c3edcbbdd4d5482e03410e61ead715bc8b740a4380df57f2f313b52875e33",
} as const;

export const MEDICAL_DISCLAIMER = {
  es: "Gymnasia no es un dispositivo médico y no sustituye el asesoramiento de un profesional sanitario.",
  en: "Gymnasia is not a medical device and does not replace advice from a healthcare professional.",
} as const;

export type PolicyLocale = keyof typeof PRIVACY_POLICY_URLS;
