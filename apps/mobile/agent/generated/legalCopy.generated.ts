// GENERADO: no editar a mano.
// Fuente: docs/legal/privacy-policy.{es,en}.md
// Regenerar: npm run sync:legal
//
// La app enlaza la política publicada y declara el descargo sanitario desde aquí,
// para que el texto legal tenga un único origen (GYM-190).

export const PRIVACY_POLICY_VERSION = "2026-09-v4";
export const PRIVACY_POLICY_EFFECTIVE_DATE = "2026-09-14";
export const PRIVACY_POLICY_CONTACT = "maximofn@maximofn.com";

export const PRIVACY_POLICY_URLS = {
  es: "https://gymnasia.maximofn.com/privacidad",
  en: "https://gymnasia.maximofn.com/privacy",
} as const;

export const PRIVACY_POLICY_DIGESTS = {
  es: "sha256:a4844153a76897d82d319c6e90b8fbec131bd3d2c4fd4f1b1327e2f0dab8c898",
  en: "sha256:970e9d6c70a48274259a9144a33b0e7bc560efd25df074d6ad4738887a8440d4",
} as const;

export const MEDICAL_DISCLAIMER = {
  es: "Gymnasia no es un dispositivo médico y no sustituye el asesoramiento de un profesional sanitario.",
  en: "Gymnasia is not a medical device and does not replace advice from a healthcare professional.",
} as const;

export type PolicyLocale = keyof typeof PRIVACY_POLICY_URLS;
