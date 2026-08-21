// Apertura de enlaces externos con manejo de error (GYM-190).
//
// `Linking.openURL` rechaza la promesa cuando no hay aplicación capaz de abrir el
// enlace, cuando el sistema lo bloquea o cuando el WebView del dispositivo está
// deshabilitado. Llamarlo sin capturar deja un rechazo sin gestionar y, sobre todo,
// un botón que no hace nada sin decir por qué. Para un enlace legal eso importa: si
// el usuario no puede abrir la política, tiene que poder leer la URL y copiarla.

import { Linking } from "react-native";

import { isSafeExternalUrl } from "./agent/externalLinks";

export type OpenExternalUrlResult =
  | { ok: true }
  | { ok: false; reason: "unsafe" | "unsupported" | "failed" };

export async function openExternalUrl(url: string): Promise<OpenExternalUrlResult> {
  if (!isSafeExternalUrl(url)) return { ok: false, reason: "unsafe" };
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return { ok: false, reason: "unsupported" };
    await Linking.openURL(url);
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
