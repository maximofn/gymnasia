---
name: mobile-expo-runbook
description: Run and troubleshoot this Expo React Native app on physical mobile devices. Use when the user asks to run on mobile, open in Expo Go, scan QR, use tunnel/LAN, or fix errors like "Failed to download remote update", "Project is incompatible with this version of Expo Go", or "The development server returned response error code 500".
---

# Mobile Expo Runbook

## Objetivo
Ejecutar `apps/mobile` de forma fiable en Expo Go y resolver fallos de arranque.

## Flujo Base
1. Ejecutar desde la raiz del repo:
   `npm install`
   `npm --workspace apps/mobile run start -- --tunnel --clear`
2. Esperar en logs:
   `Tunnel connected.`
   `Tunnel ready.`
   URL `exp://...exp.direct`.
3. Escanear QR en Expo Go.
4. Mantener Metro corriendo mientras se prueba la app.

## Verificaciones Rapidas
- Confirmar SDK:
  `cd apps/mobile && npx expo config --type public` -> `sdkVersion: 54.0.0`.
- Confirmar type-check:
  `npm --workspace apps/mobile exec tsc --noEmit`.

## Troubleshooting
### Error: Project is incompatible with this version of Expo Go
1. Alinear SDK y dependencias:
   `npm --workspace apps/mobile exec expo install expo@^54.0.0`
   `npm --workspace apps/mobile exec expo install react react-native expo-status-bar expo-secure-store @react-native-async-storage/async-storage`
   `npm --workspace apps/mobile exec expo install babel-preset-expo`
2. Instalar lockfile actualizado:
   `npm install --workspace apps/mobile`
3. Reintentar start con tunnel.

### Error: Failed to download remote update
1. Confirmar `Tunnel ready` y URL `exp.direct` (no `192.168.x.x`).
2. Usar comando con doble `--`:
   `npm --workspace apps/mobile run start -- --tunnel --clear`
3. Limpiar Expo Go (Android: borrar cache/datos) o reinstalar.
4. Reescanear QR con Metro activo.

### Error: The development server returned response error code 500
1. Revisar el primer error real en logs de Metro.
2. Reinstalar preset de Babel:
   `npm --workspace apps/mobile exec expo install babel-preset-expo`
3. Verificar que el bundle compila:
   `cd apps/mobile && npx expo export --platform android --dev`
4. Corregir el primer error reportado y repetir.

## Notas Del Proyecto
- La app funciona sin backend propio para el flujo principal.
- El chat llama directo a la API del proveedor IA.
- Las API keys se guardan en `SecureStore` en movil.

## Comportamiento Esperado Del Agente
- Ejecutar comandos, no solo describir pasos.
- Confirmar en salida que hay `Tunnel ready` y URL `exp.direct`.
- Si aparece un error, dar causa raiz y fix minimo reproducible.
- Cerrar con siguientes pasos concretos para el usuario.
