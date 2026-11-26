---
type: guía de contribución
title: Guía rápida para cambiar Gymnasia
description: Ruta de entrada para localizar el dominio de un cambio en Gymnasia y aplicar la validación proporcional. Conecta la app móvil local-first, el runtime Coach, el contenido, los servicios auxiliares y las operaciones vigentes.
tags: [quickstart, contribution, mobile, testing, local-first]
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
generated: { by: "openwiki/0.6.0", at: "2026-11-17T17:09:17.831Z" }
---

# Guía rápida para cambiar Gymnasia

Gymnasia tiene una única aplicación de producto, `apps/mobile`: una app Expo para Android, iOS y web. Es *local-first*: el dispositivo conserva los datos y la configuración BYOK, y la app funciona sin un servicio de producto central. Antes de incorporar red, identidad, sincronización o una dependencia remota, lea [Arquitectura local-first y fronteras del sistema](architecture/overview.md).

Esta es una ruta de lectura por tarea, no un sustituto del contrato del dominio. Los scripts, el código y las pruebas ejecutables describen el comportamiento vigente. El tablero de `arquitectura-agente/`, roadmaps e informes pueden orientar la investigación, pero no crean un contrato ejecutable.

## Arrancar y tener una señal inicial

Instale el lockfile y arranque Expo desde la raíz:

```bash
npm ci
npm run dev:mobile
```

Los comandos del workspace móvil fijan `APP_ENV=development` al iniciar Expo. Use el destino que necesite y haga typecheck antes de ampliar la validación al dominio:

```bash
npm --workspace apps/mobile run web
npm --workspace apps/mobile run android
npm --workspace apps/mobile run ios
npm --workspace apps/mobile run build:web
npm --workspace apps/mobile exec tsc --noEmit
```

Para Expo Go en un dispositivo físico, reenvíe los argumentos a Expo tras el segundo separador:

```bash
npm --workspace apps/mobile run start -- --tunnel --clear
```

`build:web` y TypeScript no ejercitan permisos, `SecureStore`, notificaciones, audio, instalación ni actualización nativos. Si el cambio toca una frontera nativa, continúe con [Build, release y estrategia de pruebas](operations/build-release-and-testing.md) y una build y dispositivo representativos.

## Elija la ruta por la tarea

| Si el cambio afecta a… | Empiece por | Después, valide con… |
| --- | --- | --- |
| Capas mobile, estado local, variantes, red o dependencia entre módulos | [Arquitectura local-first](architecture/overview.md) | TypeScript, `npm test` y `npm run check:mobile-boundaries` |
| Backup, recuperación, cifrado portable, borrado o privacidad | [Estado local y copias](mobile/local-state-and-backup.md) y [cifrado y recuperación](mobile/portable-encryption-and-recovery.md) | `npm test`; la E2E de recuperación, de borrado o de privacidad que corresponda; y el inventario si cambian claves, hosts o permisos |
| Shell Expo, destinos, navegación o diferencia web/móvil | [Shell y navegación móvil](mobile/application-shell.md) | TypeScript, `npm --workspace apps/mobile run build:web` y `npm run test:shell:e2e` si cambia el recorrido |
| Entrenamiento, plantillas, series, descansos o historial | [Entrenamiento móvil](mobile/training.md) | `npm test` y la E2E `test:train:*:e2e` que cubra el flujo |
| Dieta, comidas, estimación o catálogo consumido por Dieta/Coach | [Dieta, catálogo y estimación de alimentos](mobile/diet-and-food-estimation.md) | `npm run test:diet:e2e`; sume la prueba del agente si interviene una *tool* |
| Medidas, fotos de progreso o rendimiento del historial | [Medidas y fotos de progreso](mobile/measurements.md) | `npm test` y `npm run test:measurements:performance:e2e` cuando cambien sus contratos web o de rendimiento |
| Turno Coach, contexto, *tools*, consentimiento, proveedores o streaming | [Runtime del agente Coach](agent/runtime.md) y [streaming y proveedores](agent/provider-streaming.md) | prueba focalizada y `npm run test:agent:e2e` para un recorrido web afectado |
| Proveedor, BYOK o configuración de conexión | [Configuración de proveedores](agent/provider-configuration.md) | pruebas del contrato afectado; no convierta una E2E con dobles en disponibilidad de proveedor real |
| Prompt, reglas sanitarias, bundle firmado o promoción de política | [Gobierno de cambios sensibles y política de prompt](operations/prompt-policy-governance.md) y [entrega de política](architecture/policy-delivery.md) | `npm run check:health-safety && npm run test:health-safety`, más los checks y autorización de política aplicables |
| Datos de alimentos, ejercicios, recetas, BLS, CIQUAL o artefactos offline | [Catálogos nutricionales y de ejercicios](content/repositories.md) | checks del artefacto, regresiones y `npm run test:catalogs:e2e` para el consumidor |
| Imágenes de alimentos o ejercicios | [Generación y validación de imágenes](content/image-generation.md) | el check de catálogo, BLS o CIQUAL que corresponda; proyecte explícitamente las imágenes CIQUAL a móvil cuando proceda |
| Permisos, plugins Expo, configuración nativa, build o release | [Build, release y estrategia de pruebas](operations/build-release-and-testing.md) | checks de permisos/configuración nativa, typecheck y build/dispositivo representativos |
| Proxy CORS de Anthropic para depurar web | [Proxy Anthropic y frontera de transporte](services/anthropic-proxy.md) | `npm run check:anthropic-proxy && npm run test:proxy` |
| Feedback opcional o su entrega a GitHub | [Worker de feedback](services/feedback-worker.md) | `npm --workspace apps/feedback-worker run test` |
| Tablero estático o su conciliación con Linear | [Tablero de arquitectura y sincronización con Linear](services/architecture-board.md) | `npm run test:linear && npm run test:board-automation && npm run test:board && npm run test:board:e2e` |
| Automatización de esta wiki | [Automatización de OpenWiki](operations/openwiki-automation.md) | `npm run test:openwiki` |

## Elegir la evidencia adecuada

`npm test` encadena la suite determinista móvil, el *dev store* y los límites arquitectónicos móviles; no ejecuta las E2E web. Agente, catálogos, entrenamiento, dieta, recuperación, borrado, privacidad y shell se ejecutan con scripts E2E separados. Añada el script que cubra el flujo alterado, en vez de inferir cobertura desde la suite raíz.

Las E2E web exportan React Native Web y ejercitan recorridos con navegador, fixtures e interceptaciones. Demuestran el contrato cliente bajo esas condiciones, no la disponibilidad de un proveedor externo ni Android/iOS. Las evaluaciones con LLM también están separadas de la CI determinista.

Cuando un cambio introduce o elimina almacenamiento local, un host HTTPS o permisos, mantenga el inventario alineado con el código:

```bash
npm run check:data-inventory
npm run test:data-inventory
```

Para texto legal o una experiencia de privacidad publicada, añada `npm run check:legal && npm run test:legal` y, si aplica, `npm run test:privacy:e2e`.

### Catálogos: compruebe antes de escribir

Los checks detectan *drift* sin materializar salidas. `check:catalogs` siempre valida todos los dominios y no acepta `--domain`; `sync:catalogs` escribe todas las salidas. El generador permite limitar solo la escritura a un dominio:

```bash
npm run check:catalogs
npm run test:catalogs
npm run test:catalogs:e2e
npm run sync:catalogs
node scripts/catalogs/generate.mjs --write --domain alimentos
```

BLS y CIQUAL mantienen importadores y checks independientes. Una modificación de CIQUAL o de imágenes requiere la ruta específica: `check:ciqual:mobile` también encadena el índice móvil de imágenes; la proyección de esas imágenes se escribe de forma explícita con `sync:ciqual:images:mobile`. Consulte la matriz de [catálogos](content/repositories.md) o la guía de [imágenes](content/image-generation.md) antes de regenerar.

## Fronteras que deben conservarse

- `apps/feedback-worker` es un canal remoto opcional para crear incidencias privadas de GitHub, no un backend de producto. La app debe seguir siendo usable cuando falte configuración o falle el canal.
- El proxy de Anthropic sirve solo para depurar en web mediante loopback; no debe convertirse en infraestructura desplegada ni requisito de la app publicada.
- Catálogos y política son entradas validadas y cacheables, no sincronización de datos personales. Mantenga su validación de esquema, procedencia, integridad y *fallback*.
- `arquitectura-agente/` es un espejo manual y versionado de Linear, no el runtime de la aplicación. Sus estados o señales agregadas deben contrastarse con los contratos y las pruebas del dominio antes de afirmar comportamiento ejecutable.

Antes de modificar código, siga la página elegida hasta sus invariantes y sus pruebas focalizadas. Después, vuelva a la guía operativa para no sustituir una señal nativa, de release o de política por una prueba web verde.
