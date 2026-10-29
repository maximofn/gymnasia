---
type: guía de enrutamiento de cambios
title: Guía de inicio para cambios seguros
description: Ruta breve para localizar el dominio responsable de un cambio en Gymnasia y escoger la validación mínima que corresponde. Distingue arquitectura local-first, privacidad, contenido, agente, operación y pruebas.
tags: [quickstart, change-routing, mobile, operations, local-first]
verified:
  - by: openwiki/0.6.0
    at: 2026-10-29T14:43:04.676Z
sources:
  - id: openwiki-source-88e87a6a49f8c4bba044cff2
    resource: repo://apps/anthropic_proxy/README.md
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
  - id: openwiki-source-2cc0790639fb245db6d26267
    resource: repo://scripts/catalogs/generate.mjs
  - id: openwiki-source-92ee27e969d35b12e4aae573
    resource: repo://scripts/data-inventory/check.mjs
generated: { by: "openwiki/0.6.0", at: "2026-10-29T14:43:04.676Z" }
---

# Guía de inicio para cambios seguros

Gymnasia tiene una única aplicación de producto en `apps/mobile`, ejecutable con Expo en Android, iOS y web. Es local-first: el dispositivo conserva el estado de entrenamiento, dieta, mediciones, conversaciones, preferencias y configuración BYOK; no hay una API de producto ni sincronización central obligatoria. Antes de añadir red, identidad o una dependencia remota, lea [Arquitectura del sistema](architecture/overview.md).

Esta página enruta el trabajo; no sustituye el contrato, los invariantes ni los fallos descritos por la página de cada dominio. El código y sus pruebas ejecutables prevalecen sobre planes históricos.

## Arranque local

El repositorio usa *workspaces* npm. Desde una instalación limpia, use el lockfile y arranque el workspace móvil:

```bash
npm ci
npm run dev:mobile
```

La entrada `apps/mobile/index.js` registra `App` mediante `registerRootComponent`. Para abrir superficies de desarrollo, exportar web o comprobar tipos:

```bash
npm --workspace apps/mobile run web
npm --workspace apps/mobile run android
npm --workspace apps/mobile run ios
npm --workspace apps/mobile run build:web
npm --workspace apps/mobile exec tsc --noEmit
```

Para Expo Go en un dispositivo físico, reenvíe los argumentos a Expo con el segundo separador:

```bash
npm --workspace apps/mobile run start -- --tunnel --clear
```

## Mapa compacto de tareas

| Si cambia… | Lea primero | Validación mínima inicial |
| --- | --- | --- |
| Fronteras local-first, variante, dependencia de red o responsabilidad entre capas | [Arquitectura del sistema](architecture/overview.md) | `npm --workspace apps/mobile exec tsc --noEmit`, `npm test` y `npm run check:mobile-boundaries`. |
| Estado local, claves, copias, recuperación, borrado o privacidad de datos | [Estado local, cachés y respaldo](mobile/local-state-and-backup.md) y [Arquitectura del sistema](architecture/overview.md) | `npm test`; añada `npm run check:data-inventory && npm run test:data-inventory` y la E2E de borrado, recuperación o privacidad que cubra el cambio. |
| Shell Expo, navegación, pantallas o diferencia web/móvil | [Shell y navegación móvil](mobile/application-shell.md) | typecheck, `npm --workspace apps/mobile run build:web` y `npm run test:shell:e2e` si afecta el recorrido. |
| Entrenamiento, series, historial o ejecución de ejercicios | [Entrenamiento móvil](mobile/training.md) | `npm test` y la E2E de entrenamiento específica afectada. |
| Dieta, alimento personal, catálogo nutricional o estimación asistida | [Dieta, catálogo y estimación de alimentos](mobile/diet-and-food-estimation.md) | `npm run test:diet:e2e`; añada pruebas del agente si una *tool* interviene. |
| Catálogos fuente, CIQUAL, agregados, imágenes o consumidor offline | [Repositorios de contenido y catálogos](content/repositories.md) y [Generación y uso de imágenes de catálogo](content/image-generation.md) | `npm run check:catalogs && npm run test:catalogs && npm run test:catalogs:e2e`; sume los checks CIQUAL si modifica su importación o proyección móvil. |
| Conversación, herramientas, confirmaciones, reintentos o contexto de política | [Runtime del agente y herramientas](agent/runtime.md) | pruebas focalizadas, `npm test` y `npm run test:agent:e2e` si cambia el recorrido web. |
| Clave BYOK, proveedor, modelo, streaming o continuación | [Configuración de proveedores](agent/provider-configuration.md) y [Streaming y continuaciones](agent/provider-streaming.md) | pruebas del adaptador y la E2E del agente afectada. |
| Prompt, regla sanitaria, artefacto firmado o promoción de política | [Arquitectura del sistema](architecture/overview.md) | `npm run check:health-safety`, `npm run test:health-safety`, los checks de política aplicables y la autorización requerida. |
| Permiso, plugin Expo, configuración nativa, notificación, build o release | [Build, release y pruebas](operations/build-release-and-testing.md) | guard rails de Android aplicables, typecheck, export y una build/prueba nativa representativa. |
| Proxy CORS de Anthropic en depuración web | [Proxy de Anthropic](services/anthropic-proxy.md) | `npm run check:anthropic-proxy && npm run test:proxy`. |
| Feedback remoto opcional | [Worker de feedback](services/feedback-worker.md) | `npm --workspace apps/feedback-worker run test` y el contrato cliente afectado. |
| Tablero, conciliación con Linear o despliegue Vercel | [Tablero de arquitectura](services/architecture-board.md) | `npm run test:linear && npm run test:board-automation && npm run test:board && npm run test:board:e2e`. |
| Automatización de esta wiki | [Automatización de OpenWiki](operations/openwiki-automation.md) | `npm run test:openwiki`. |

## Seleccionar evidencia sin sobreafirmar cobertura

`npm test` encadena la suite determinista móvil, los checks/tests del *dev store* y los límites arquitectónicos móviles. Las E2E de agente, catálogos, entrenamiento, dieta, recuperación, borrado, privacidad y shell son scripts separados: ejecute la que cubre el flujo modificado, además de los checks del dominio.

La exportación web y las pruebas deterministas no prueban capacidades nativas. Un cambio de permisos, plugins, notificaciones, recursos, instalación o distribución requiere los controles específicos y una comprobación nativa —preferiblemente en dispositivo—. Del mismo modo, una E2E web valida el recorrido controlado y sus dobles, no un proveedor externo ni Android/iOS.

Para modificaciones de privacidad, no basta con que la UI funcione: actualice y compruebe el inventario de datos cuando cambien claves locales, hosts HTTPS o permisos, y añada el check legal o la E2E de privacidad/borrado si cambia la experiencia o el contenido publicado. Para contenido, `check:*` detecta *drift* sin escribir; use `sync:catalogs` solo cuando deba materializar y revisar artefactos derivados.

## Límites que deben sobrevivir al cambio

- El Worker de feedback es una excepción remota limitada: crea incidencias privadas de GitHub y no es un backend de producto. Si no está configurado o falla, la aplicación debe seguir siendo utilizable.
- El proxy de Anthropic solo ayuda a depurar web en loopback; no convierta esa ruta en infraestructura publicada.
- Catálogos y política son entradas remotas que se validan y pueden usar caché o *fallback*; no son sincronización de datos personales.
- No interprete `arquitectura-agente/` como runtime de la aplicación: es un tablero estático separado.

Para el detalle de cada garantía y las pruebas que la acreditan, siga el enlace del dominio de la tabla antes de editar.
