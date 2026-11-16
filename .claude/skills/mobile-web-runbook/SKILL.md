---
name: mobile-web-runbook
description: Run and troubleshoot the Expo web preview for this repository (`apps/mobile`). Use when the user asks to run the mobile app in a browser, start Expo web mode, install missing web dependencies, fix Metro startup errors, or validate web bundling without opening a local server.
---

# Mobile Web Runbook

## Objetivo
Ejecutar `apps/mobile` en navegador y resolver fallos de arranque/build en web.

## Flujo Base
1. Desde la raiz del repo:
   `npm install`
2. Arrancar web:
   `npm --workspace apps/mobile run web`
3. Abrir la URL que imprima Expo (normalmente `http://localhost:8081`).

## Prechecks
- Confirmar SDK y config de Expo:
  `cd apps/mobile && npx expo config --type public`
- Confirmar type-check:
  `npm --workspace apps/mobile exec tsc --noEmit`

## Dependencias Web Requeridas
Si falta soporte web, instalar versiones compatibles con el SDK:
`npm --workspace apps/mobile exec expo install react-dom react-native-web @expo/metro-runtime`

## Troubleshooting

### Error: web support missing (`react-native-web` / `react-dom`)
1. Ejecutar instalación de dependencias web:
   `npm --workspace apps/mobile exec expo install react-dom react-native-web @expo/metro-runtime`
2. Reintentar:
   `npm --workspace apps/mobile run web`

### Error: Metro devuelve 500
1. Leer el primer error real en logs.
2. Asegurar preset Babel:
   `npm --workspace apps/mobile exec expo install babel-preset-expo`
3. Verificar bundle web sin servidor:
   `cd apps/mobile && npx expo export --platform web --dev`
4. Corregir el primer error reportado y reintentar `run web`.

### Error de puertos / entorno restringido
Si el entorno no permite abrir puertos locales (por ejemplo, sandbox/CI), usar validacion por export:
`cd apps/mobile && npx expo export --platform web --dev`

## Notas Importantes Del Proyecto
- `SecureStore` en navegador no tiene las mismas garantias que en movil nativo.
- El chat directo a proveedor IA en web puede fallar por CORS o politicas del proveedor.

## Comportamiento Esperado Del Agente
- Ejecutar comandos, no solo describir pasos.
- Identificar y reportar la causa raiz del primer error, no sintomas secundarios.
- Cerrar con un fix minimo reproducible y el siguiente comando exacto a ejecutar.
