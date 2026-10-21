---
type: guía de enrutamiento de cambios
title: Inicio rápido para cambiar Gymnasia
description: Mapa breve para iniciar el cliente móvil, identificar qué página de dominio posee un cambio y seleccionar su validación. Distingue las superficies ejecutables actuales de los planes históricos.
tags: [quickstart, change-routing, mobile, operations, local-first]
verified:
  - by: openwiki/0.6.0
    at: 2026-10-20T13:07:24.686Z
sources:
  - id: openwiki-source-45602fc0f28e2e3187ce8790
    resource: repo://apps/feedback-worker/README.md
  - id: openwiki-source-12bdb95b5f863aab1ff9964a
    resource: repo://apps/mobile/index.js
  - id: openwiki-source-e86fe7b76c693666bc2cb828
    resource: repo://apps/mobile/package.json
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "openwiki/0.6.0", at: "2026-10-20T13:07:24.686Z" }
---

# Inicio rápido para cambiar Gymnasia

Gymnasia es una aplicación Expo en `apps/mobile` para Android, iOS y web. El producto es local-first: entrenamiento, dieta, mediciones, conversaciones, preferencias y configuración BYOK pertenecen al cliente; no hay una API de producto ni sincronización central obligatoria. Consulte [Arquitectura y límites de Gymnasia](architecture/overview.md) antes de introducir una dependencia remota o de interpretar como actual un documento de planificación.

Esta página solo orienta el trabajo. El contrato, los invariantes y los casos de fallo pertenecen a la página de dominio enlazada; el código y los tests ejecutables prevalecen sobre tickets, roadmaps y otros planes históricos.

## Arranque

El repositorio usa workspaces npm. Para una instalación reproducible desde el lockfile use `npm ci`; para levantar el cliente use:

```bash
npm ci
npm run dev:mobile
```

`npm run dev:mobile` delega en el script `start` del workspace móvil. La entrada `apps/mobile/index.js` registra `App` con `registerRootComponent`. Para elegir una superficie de desarrollo o comprobar tipos y exportación web:

```bash
npm --workspace apps/mobile run web
npm --workspace apps/mobile run android
npm --workspace apps/mobile run ios
npm --workspace apps/mobile run build:web
npm --workspace apps/mobile exec tsc --noEmit
```

Para Expo Go físico, pase las opciones al script del workspace con el segundo separador:

```bash
npm --workspace apps/mobile run start -- --tunnel --clear
```

## Mapa de tareas

| Si cambia… | Diríjase a | Empiece validando… |
| --- | --- | --- |
| Límites local-first, variantes, persistencia transversal o una dependencia de red | [Arquitectura y límites](architecture/overview.md) | `npm test`, typecheck y el guard rail aplicable. |
| Arranque Expo, shell, navegación o diferencias por plataforma | [Shell de aplicación](mobile/application-shell.md) | typecheck, `build:web` y `npm run test:shell:e2e`. |
| Chat, tools, confirmaciones, reintentos o política en ejecución | [Runtime del agente y herramientas](agent/runtime.md) | pruebas focalizadas, `npm test` y, si cambia el recorrido visible, `npm run test:agent:e2e`. |
| Proveedor, clave BYOK, modelo, streaming o continuaciones | [Streaming y continuaciones de proveedores](agent/provider-streaming.md) | pruebas del adaptador y la E2E de agente afectada. |
| Política firmada, prompt, reglas sanitarias, promoción o activación | [Entrega y activación de políticas](architecture/policy-delivery.md) | checks y tests de política; lea también los requisitos de revisión de seguridad. |
| Dieta, alimentos personales o estimación | [Dieta y estimación de alimentos](mobile/diet-and-food-estimation.md) | `npm run test:diet:e2e` y pruebas del agente cuando intervenga una tool. |
| Mediciones, fotos, gráficos o su persistencia | [Mediciones y métricas corporales](mobile/measurements.md) | pruebas del dominio y de los flujos de copia o borrado implicados. |
| Fichas, imágenes, agregados o publicación de catálogos | [Generación de imágenes de contenido](content/image-generation.md) | `npm run check:catalogs`, `npm run test:catalogs` y `npm run test:catalogs:e2e`. |
| Permisos, plugins Expo, notificaciones, build, artefacto o release | [Build, publicación y pruebas](operations/build-release-and-testing.md) y [Permisos Android](operations/android-permissions.md) | guard rail específico y una build o comprobación nativa representativa. |
| Transporte CORS de Anthropic para depuración web | [Proxy de Anthropic](services/anthropic-proxy.md) | `npm run check:anthropic-proxy` y `npm run test:proxy`. |
| Envío de feedback e incidencias privadas | [Worker de feedback](services/feedback-worker.md) | `npm --workspace apps/feedback-worker run test` y el contrato cliente afectado. |
| Tablero, conciliación con Linear o despliegue Vercel | [Tablero de arquitectura](services/architecture-board.md) | `npm run test:linear`, `npm run test:board-automation`, `npm run test:board` y `npm run test:board:e2e`. |
| Automatización o mantenimiento de estas páginas | [Automatización de OpenWiki](operations/openwiki-automation.md) | `npm run test:openwiki`. |

## Reglas de cambio y validación

- Los cambios en `prompts/` o `policy/health-safety/` cruzan una frontera de seguridad. Ejecute los checks y tests de política que correspondan antes de promoverlos.
- `npm test` ejecuta la suite determinista móvil, el dev store y los límites arquitectónicos móviles. Las E2E de agente, catálogos, entrenamiento, dieta y recuperación son comandos separados: ejecute únicamente las que cubran el flujo modificado, además de los checks del dominio.
- La exportación web y las pruebas deterministas no demuestran capacidades nativas. Para permisos, plugins, notificaciones, recursos, instalación o distribución, aplique el control específico y pruebe una build nativa, preferiblemente en dispositivo.
- El Worker de feedback es la excepción remota limitada: recibe feedback para crear incidencias privadas de GitHub sin ser backend de producto. El cliente debe continuar siendo utilizable si no está configurado o falla; su contrato y operación se documentan en la página del Worker.

## Qué no tomar como topología actual

`apps/mobile` es la aplicación de producto. El Worker de feedback y el proxy de Anthropic son integraciones acotadas; el tablero es un sistema de seguimiento separado. Para decidir una dependencia o un contrato, contraste cualquier documento con el código y los tests ejecutables del dominio.
