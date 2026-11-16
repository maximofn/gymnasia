---
type: guía de contribución
title: Inicio rápido para contribuir en Gymnasia
description: Punto de entrada para instalar y ejecutar Gymnasia, localizar el subsistema responsable de un cambio y elegir una validación proporcional. Distingue los comandos y contratos ejecutables de planes, tableros e informes históricos.
tags: [quickstart, contribution, mobile, testing, local-first]
verified:
  - by: openwiki/0.6.0
    at: 2026-11-11T15:41:01.947Z
sources:
  - id: openwiki-source-338e77d1d6cb373155f08ceb
    resource: repo://.github/workflows/agent-tests.yml
  - id: openwiki-source-88e87a6a49f8c4bba044cff2
    resource: repo://apps/anthropic_proxy/README.md
  - id: openwiki-source-45602fc0f28e2e3187ce8790
    resource: repo://apps/feedback-worker/README.md
  - id: openwiki-source-12bdb95b5f863aab1ff9964a
    resource: repo://apps/mobile/index.js
  - id: openwiki-source-e86fe7b76c693666bc2cb828
    resource: repo://apps/mobile/package.json
  - id: openwiki-source-bd210931c947e300164b7a63
    resource: repo://apps/mobile/scripts/catalogs.e2e.mjs
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-2cc0790639fb245db6d26267
    resource: repo://scripts/catalogs/generate.mjs
  - id: openwiki-source-92ee27e969d35b12e4aae573
    resource: repo://scripts/data-inventory/check.mjs
generated: { by: "openwiki/0.6.0", at: "2026-11-11T15:41:01.947Z" }
---

# Inicio rápido para contribuir en Gymnasia

Gymnasia tiene una única aplicación de producto: `apps/mobile`, una aplicación Expo para Android, iOS y web. Es *local-first*: el dispositivo posee entrenamiento, dieta, mediciones, conversaciones, preferencias y la configuración BYOK; no hay una API de producto ni una sincronización central obligatoria. Antes de introducir red, identidad o una dependencia remota, consulte [Arquitectura local-first y fronteras del sistema](architecture/overview.md).

Esta página es un mapa de entrada. El código, los scripts y las pruebas ejecutables son la fuente de verdad para el comportamiento actual. El tablero `arquitectura-agente/`, los documentos de roadmap y los informes de runtime pueden orientar una investigación, pero no crean un contrato ni sustituyen una prueba focalizada.

## Preparar el entorno y arrancar

El repositorio usa *workspaces* npm y CI instala el lockfile con `npm ci`. Desde la raíz:

```bash
npm ci
npm run dev:mobile
```

La entrada `apps/mobile/index.js` registra `App` mediante `registerRootComponent`. Los scripts del workspace fijan `APP_ENV=development` para sus destinos de desarrollo:

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

`build:web` y el tipado son señales iniciales útiles, no evidencia de que funcionen permisos, almacenamiento seguro, notificaciones, audio, instalación o actualización nativos. Para esos cambios, siga [Compilación, publicación y validación](operations/build-release-and-testing.md) y pruebe una build/dispositivo representativo.

## Mapa de tareas

| Si cambia… | Empiece por | Validación inicial |
| --- | --- | --- |
| Fronteras local-first, variantes, red o dependencia entre capas | [Arquitectura local-first](architecture/overview.md) | `npm --workspace apps/mobile exec tsc --noEmit`, `npm test` y `npm run check:mobile-boundaries` |
| Persistencia, claves, backup, recuperación, borrado o privacidad | [Arquitectura local-first](architecture/overview.md) | `npm test`; añada `npm run check:data-inventory && npm run test:data-inventory` y la E2E de recuperación, borrado o privacidad aplicable |
| Shell Expo, navegación, pantallas o diferencia web/móvil | [Shell y navegación móvil](mobile/application-shell.md) | typecheck, `npm --workspace apps/mobile run build:web` y `npm run test:shell:e2e` si cambia el recorrido |
| Entrenamiento, series, historial o ejecución de ejercicios | [Entrenamiento móvil](mobile/training.md) | `npm test` y la E2E de entrenamiento concreta (`test:train:*:e2e`) |
| Dieta, alimento personal, catálogo nutricional o estimación | [Dieta, catálogo y estimación de alimentos](mobile/diet-and-food-estimation.md) | `npm run test:diet:e2e`; sume pruebas del agente si interviene una *tool* |
| Catálogos fuente, BLS, CIQUAL, imágenes o consumidores offline | [Catálogos nutricionales y de ejercicios](content/repositories.md) | `npm run check:catalogs && npm run test:catalogs && npm run test:catalogs:e2e`; añada checks BLS/CIQUAL y de proyección móvil según el artefacto modificado |
| Conversación, herramientas, confirmaciones, proveedores o streaming | [Runtime del agente y herramientas](agent/runtime.md) | prueba focalizada del contrato y `npm run test:agent:e2e` si cambia el recorrido web |
| Prompt, reglas sanitarias, bundle firmado o promoción de política | [Arquitectura local-first](architecture/overview.md) | `npm run check:health-safety && npm run test:health-safety`; sume los checks de política y la autorización exigida |
| Permiso, plugin Expo, configuración nativa, notificación, build o release | [Compilación, publicación y validación](operations/build-release-and-testing.md) | checks de permisos/configuración nativa, typecheck y una build/prueba nativa representativa |
| Proxy CORS de Anthropic para depuración web | [Arquitectura local-first](architecture/overview.md) | `npm run check:anthropic-proxy && npm run test:proxy` |
| Feedback opcional | [Arquitectura local-first](architecture/overview.md) | `npm --workspace apps/feedback-worker run test` |
| Automatización de esta wiki | [Automatización de OpenWiki](operations/openwiki-automation.md) | `npm run test:openwiki` |

## Elegir la evidencia correcta

`npm test` ejecuta la suite determinista móvil, los checks/tests del *dev store* y los límites arquitectónicos móviles. No ejecuta las E2E web. Agente, catálogos, entrenamiento, dieta, recuperación, borrado, privacidad y shell tienen scripts E2E separados; ejecute el que cubra el flujo afectado además de los checks de su dominio.

Las E2E web exportan y ejercitan un recorrido controlado con navegador, fixtures e interceptaciones. Acreditan ese contrato cliente, no la disponibilidad de un proveedor externo ni Android/iOS. Las evaluaciones con LLM también están separadas de la CI determinista: no las presente como requisito habitual para arrancar o validar un cambio local.

Cuando modifique claves locales, destinos HTTPS o permisos, el inventario debe seguir describiendo lo detectado por el código:

```bash
npm run check:data-inventory
npm run test:data-inventory
```

Para texto legal o una experiencia de privacidad publicada, añada `npm run check:legal && npm run test:legal` y, cuando proceda, `npm run test:privacy:e2e`.

### Catálogos: comprobar antes de escribir

Los `check:*` detectan *drift* sin materializar artefactos. `check:catalogs` valida todos los dominios y no acepta una selección de dominio; `sync:catalogs` escribe todas las salidas. Para regenerar y revisar una salida limitada use el generador directamente:

```bash
npm run check:catalogs
npm run test:catalogs
npm run test:catalogs:e2e
npm run sync:catalogs
node scripts/catalogs/generate.mjs --write --domain alimentos
```

BLS y CIQUAL tienen importadores y checks independientes. Una modificación de CIQUAL o de imágenes no queda cubierta solo por el generador común: siga la matriz de [catálogos](content/repositories.md) para ejecutar `check:ciqual`, `check:ciqual:images`, `check:ciqual:mobile` y, si corresponde, el check de BLS o la sincronización explícita de imágenes móviles.

## Límites que no deben cambiarse por accidente

- `apps/feedback-worker` es un canal remoto opcional que crea incidencias privadas de GitHub; no es un backend de producto. La app debe continuar utilizable si falta configuración o el canal falla.
- El proxy de Anthropic solo sirve para depuración web en loopback. No lo convierta en infraestructura desplegada ni en una dependencia de la app publicada.
- Catálogos y política son entradas remotas validadas y cacheables; no son sincronización de datos personales. Mantenga sus comprobaciones de esquema, procedencia, integridad y *fallback*.
- `arquitectura-agente/` es un tablero estático independiente, no el runtime de la aplicación. De la misma forma, una señal agregada de telemetría sirve para priorizar investigación, pero debe contrastarse con el control de flujo, el contrato y las pruebas del dominio antes de afirmar comportamiento ejecutable.

Antes de editar, siga la página enlazada del dominio: ahí están los invariantes, los fallos esperados y la prueba que demuestra el contrato concreto.
