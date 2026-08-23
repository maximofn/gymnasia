// Credenciales cifradas que una versión anterior pudo guardar en el dispositivo.
// GYM-192 (ticket para retirar temporalmente VivaGym de la versión pública) conserva
// estos valores durante las actualizaciones normales para poder reutilizarlos si la
// integración vuelve. La app retirada no los lee ni los escribe; solo el borrado
// explícito de datos locales consume esta lista.
export const RETAINED_LEGACY_SECURE_STORE_KEYS = [
  "vivagym.email",
  "vivagym.password",
] as const;
