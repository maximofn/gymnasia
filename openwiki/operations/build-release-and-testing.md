---
type: guía operativa
title: Build, release y estrategia de validación
description: Selecciona los comandos de desarrollo, comprobaciones deterministas, E2E controladas y gates de release según el contrato que cambia. Distingue la validación local de las operaciones remotas protegidas de políticas y APK Android.
tags: [operations, ci, testing, release, android, policy, privacy]
verified:
  - by: openwiki/0.5.0
    at: 2026-09-07T11:37:28.236Z
sources:
  - id: openwiki-source-338e77d1d6cb373155f08ceb
    resource: repo://.github/workflows/agent-tests.yml
  - id: openwiki-source-0b86c93537ee4ff0031996d7
    resource: repo://.github/workflows/build-apk.yml
  - id: openwiki-source-3c34e9e772c8ec0511019e4d
    resource: repo://.github/workflows/catalog-tests.yml
  - id: openwiki-source-0820b15716e58461fe98c290
    resource: repo://.github/workflows/promote-policy.yml
  - id: openwiki-source-dbb2f22f3ac148227d7ee8c2
    resource: repo://apps/anthropic_proxy/package.json
  - id: openwiki-source-0239eb67852905377cb7ee70
    resource: repo://apps/anthropic_proxy/pyproject.toml
  - id: openwiki-source-a6ba9053969a3e00cd971742
    resource: repo://apps/mobile/app.config.ts
  - id: openwiki-source-3de323c9f3752d72d82de839
    resource: repo://apps/mobile/app.json
  - id: openwiki-source-ee5b295fb9c3f0589728d747
    resource: repo://apps/mobile/eas.json
  - id: openwiki-source-e86fe7b76c693666bc2cb828
    resource: repo://apps/mobile/package.json
  - id: openwiki-source-229791acb3b83ab8fa63ffe5
    resource: repo://apps/mobile/scripts/agent-chat.e2e.mjs
  - id: openwiki-source-bd210931c947e300164b7a63
    resource: repo://apps/mobile/scripts/catalogs.e2e.mjs
  - id: openwiki-source-9b36e0d3bf6e997011395257
    resource: repo://apps/mobile/scripts/privacy-policy.e2e.mjs
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-c657bdb933b7ed64c860ab05
    resource: repo://scripts/android-permissions/permissions.test.mjs
  - id: openwiki-source-2cc0790639fb245db6d26267
    resource: repo://scripts/catalogs/generate.mjs
  - id: openwiki-source-f807c3c379c670c5871c2b49
    resource: repo://scripts/data-inventory/inventory.mjs
  - id: openwiki-source-7718d8047e7c1e0a6137f6de
    resource: repo://scripts/production-release/policy.json
  - id: openwiki-source-24a206e2ad72f4f0a1502c09
    resource: repo://scripts/production-release/production-release.mjs
  - id: openwiki-source-eca432bcfe70b04e1d09e3d3
    resource: repo://scripts/production-release/release-transaction.mjs
  - id: openwiki-source-ccd3d9e4de4c353ab98fedd2
    resource: repo://scripts/production-release/verify-source.mjs
generated: { by: "openwiki/0.5.0", at: "2026-09-07T11:37:28.236Z" }
---

# Build, release y estrategia de validación

## Principio operativo

La validación debe ser proporcional al cambio y al contrato que podría romperse. Este repositorio separa cuatro señales que no son intercambiables:

1. **Checks locales deterministas:** tipos, contratos, artefactos generados y regresiones con fixtures. Son la señal inicial reproducible tras `npm ci`.
2. **E2E web controlada:** exporta React Native Web, sirve `apps/mobile/dist` y usa Playwright. Comprueba interfaz, estado y recuperación bajo respuestas simuladas; no valida Android ni iOS.
3. **Gates de release:** combinan checks locales con controles de identidad, estado de GitHub y evidencia del binario. Se ejecutan para un candidato exacto, no como sustituto de una revisión ordinaria.
4. **Actos remotos protegidos:** EAS, environments de GitHub, releases y promoción de política requieren credenciales y aprobación. No son necesarios para desarrollar ni para que la app funcione localmente.

```mermaid
flowchart TD
    Change["Cambio propuesto"] --> Local["Checks locales y tipado"]
    Local --> Scope{"¿Cambia contrato web o consumidor?"}
    Scope -->|"Sí"| Web["E2E web con fixtures"]
    Scope -->|"No"| Review["Revisión del cambio"]
    Web --> Review
    Review --> Sensitive{"¿Política o release Android?"}
    Sensitive -->|"Política"| Signed["Promoción firmada y aprobada"]
    Sensitive -->|"Android"| Release["Gates Production y EAS"]
    Sensitive -->|"No"| Done["Validación terminada"]
```

*El diagrama separa cobertura local y web de decisiones remotas; una E2E web verde no acredita capacidades nativas.*

## Preparar y ejecutar la aplicación

El proyecto npm declara `apps/*` como workspaces y CI usa el lockfile con `npm ci`. Empiece desde una instalación limpia:

```bash
npm ci
npm run dev:mobile
```

Los scripts móviles fijan `APP_ENV=development` para iniciar Expo, Android, iOS y web. `build:web` conserva `APP_ENV` si ya está definido y, si no, exporta development:

```bash
npm --workspace apps/mobile run web
npm --workspace apps/mobile run android
npm --workspace apps/mobile run ios
npm --workspace apps/mobile run build:web
npm --workspace apps/mobile exec tsc --noEmit
```

Asocie cada uno a su riesgo: `expo start` sirve para iterar; `expo run:android` y `expo run:ios` ejercitan un runtime nativo de desarrollo; `build:web` detecta fallos de empaquetado web; y `tsc --noEmit` detecta incompatibilidades estáticas sin ejecutar la app. La exportación genera `apps/mobile/dist`, que reutilizan varias E2E, pero no prueba permisos fusionados, SecureStore, alarmas, notificaciones, intents, audio de fondo ni instalación en un teléfono.

`app.json` define el paquete Android/iOS y la política declarativa de permisos. Permite `FOREGROUND_SERVICE`, `WAKE_LOCK`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED` y `SCHEDULE_EXACT_ALARM`, y bloquea permisos como `USE_EXACT_ALARM`, `REQUEST_INSTALL_PACKAGES`, `RECORD_AUDIO` y `SYSTEM_ALERT_WINDOW`. Para cambios en plugins Expo, dependencias nativas o permisos, ejecute además los controles de permisos y una compilación/prueba nativa representativa. Véase [Validación de permisos Android publicables](android-permissions.md).

## Matriz de validación mínima

| Cambio | Comando focalizado | Contrato que valida y límite |
| --- | --- | --- |
| Lógica móvil determinista, agente o almacenamiento de desarrollo | `npm test` | Ejecuta `test:deterministic` y el check/tests del dev store; no agrega todas las suites del repositorio. |
| Prompt integrado | `npm run check:chat-prompt` | Detecta que el snapshot generado usado por la app deriva del prompt fuente; `test:deterministic` lo invoca como precheck. |
| Salud, seguridad o prompt de política | `npm run check:health-safety && npm run test:health-safety` y/o `npm run check:prompt-policy && npm run test:prompt-policy` | Comprueba la política canónica, sus generados, contratos y regresiones; requiere además la autorización indicada en [Gobierno de cambios sensibles y política de prompt](prompt-policy-governance.md). |
| Tipos de la app móvil | `npm --workspace apps/mobile exec tsc --noEmit` | Análisis estático del workspace móvil, no una prueba de runtime. |
| Configuración, plugin o dependencia Android | `npm run check:android-permissions && npm run test:android-permissions` | El check contrasta configuración y manifests de dependencias instaladas con la política; los tests prueban que el guard rail detecte fallos. Requiere `node_modules` y no sustituye un dispositivo. |
| Claves locales, destinos HTTPS o impacto de permisos en privacidad | `npm run check:data-inventory && npm run test:data-inventory` | Impide que el inventario publicable deje de describir las claves, hosts y permisos declarados por la app. |
| Texto legal o política de privacidad publicada | `npm run check:legal && npm run test:legal` | Comprueba los artefactos legales generados y sus contratos. Para el sitio publicado, añada `npm run test:privacy:e2e`. |
| Catálogos y sus salidas | `npm run check:catalogs && npm run test:catalogs` | Verifica contratos de todos los dominios y que los generados estén actualizados. |
| Consumidores de catálogos | `npm run test:catalogs:e2e` | Prueba la proyección web con fixtures e indisponibilidad simulada, sin consultar servicios externos. |
| Chat/agente web | `npm run test:agent:e2e` | Ejecuta las E2E de chat y proveedor de desarrollo contra navegador y dependencias interceptadas; no acredita proveedores reales ni funcionalidades nativas. |
| Entrenamiento, dieta, recuperación o preferencias web | La E2E específica: por ejemplo `npm run test:train:e2e`, `npm run test:diet:e2e` o `npm run test:storage-recovery:e2e` | Seleccione el script que cubra el flujo afectado; son pruebas web explícitas, no un requisito para iniciar Expo localmente. |
| Eliminación local de datos | `npm run test:data-deletion:e2e` | Siembra datos y cachés en el almacenamiento web para comprobar el borrado visible; no demuestra el borrado de un dispositivo nativo. |
| Proxy Anthropic | `npm run test:proxy` | Delega en el workspace Python aislado; no instala ni transforma sus dependencias en dependencias npm. |
| Release Android | `npm run verify:production-source -- --profile production-apk --artifact-type apk --output /tmp/production-source-evidence.json` | Verificador de candidato Production que necesita checkout, GitHub y gates; el workflow es la entrada normal, no un comando local autosuficiente. |

## Checks de privacidad, catálogos y permisos

El inventario de datos es un guard rail sin red: escanea fuentes TypeScript no-test bajo los roots configurados, compara literales de claves de almacenamiento y hosts HTTPS con `scripts/data-inventory/inventory.json`, y toma los permisos permitidos y extras esperados de la política de permisos. También falla si no pudo escanear ningún archivo, para evitar un verde vacío. Cuando añade o retira almacenamiento, un endpoint o un permiso, actualice el inventario y revise la lista de cambios de privacidad; no trate una política legal estática como evidencia de que el código sigue cumpliéndola.

Los generadores de catálogo separan comprobar de escribir:

```bash
npm run check:catalogs
npm run test:catalogs
npm run sync:catalogs
# escritura limitada a un dominio
node scripts/catalogs/generate.mjs --write --domain alimentos
```

`check:catalogs` no modifica el checkout y verifica todos los catálogos y sus artefactos; no acepta `--domain`. `sync:catalogs` o `--write --domain` materializan salidas que deben revisarse y confirmarse junto con su fuente. Después, los tests y la E2E de consumidores comprueban que una salida correcta sea usable; escribir no reemplaza esa validación.

De modo equivalente, `check:android-permissions` revisa `app.json` y los manifests de dependencias instaladas, mientras `test:android-permissions` valida la capacidad del escáner para detectar las clases de infracción. Un check verde valida el contrato del checkout instalado, no la aceptación por Google Play ni el comportamiento de una alarma en hardware.

## E2E: qué representan

Las E2E son scripts Playwright que normalmente exportan web y sirven `dist`; aceptan variables de entorno para reutilizar una exportación o mostrar el navegador en algunos casos. Están diseñadas para ser deterministas: la E2E de privacidad abre cada página en un contexto limpio, sin cookies, almacenamiento ni claves, y compara el contenido y metadatos con la copia legal generada. La de borrado local siembra claves scoped y verifica que el flujo las elimine. Las E2E del agente y catálogos inyectan o interceptan respuestas de proveedores para cubrir estados de éxito, error y recuperación.

Por ello, use una E2E cuando cambie la interfaz, el contrato de almacenamiento o la integración cliente que cubre, pero no la presente como requisito de arranque local ni como prueba de disponibilidad de OpenAI, Anthropic, Google, GitHub u otros servicios. Tampoco sustituye una prueba Android/iOS cuando el cambio toca una capacidad nativa. Para la estrategia del agente y el uso reservado de evals LLM, consulte `docs/testing/agent-testing.md` y [Entrenamiento móvil](../mobile/training.md).

## Integración continua

`agent-tests.yml` se activa en PR y `main` solo para sus rutas declaradas. Su job Node usa Node 22, `npm ci`, permiso `contents: read` y diez minutos para verificar prompt integrado, política sanitaria, sus tests, `npm test`, la E2E Metro del dev store, feedback worker, automatización OpenWiki y TypeScript. El proxy corre en otro job con `uv`, de modo que no forma parte del entorno Node. Un cambio fuera de esos filtros no recibe este workflow.

`catalog-tests.yml` también usa Node 22 y `npm ci`, instala Chromium y ejecuta `check:catalogs`, `test:catalogs` y `test:catalogs:e2e` para rutas de fuentes, generador y consumidores declaradas. Sus resultados no cubren por sí mismos permisos Android ni una release.

## Política firmada y release Android

La promoción de política es una operación manual protegida, distinta del merge. Requiere el workflow de promoción, una operación y motivo, una activación firmada y los controles remotos de candidato; para el modelo de autorización, staging, producción y rollback consulte [Gobierno de cambios sensibles y política de prompt](prompt-policy-governance.md). Ningún test local autoriza una promoción.

El perfil EAS `production` tiene `APP_ENV=production` e incremento remoto de versión y produce el formato por defecto de EAS; `production-apk` lo extiende y fuerza `android.buildType: apk`. El workflow Android publica con `production-apk`; no confunda ese destino con el perfil `production` que la política de release clasifica como AAB. La versión visible procede de `apps/mobile/app.json` y un cambio en una ruta empaquetada exige el incremento semántico calculado desde la base o la versión publicada más alta.

```mermaid
stateDiagram-v2
    [*] --> prepared
    prepared --> build_submitted: submit EAS build ID
    build_submitted --> build_running: observe IN_PROGRESS
    build_submitted --> build_finished: observe FINISHED
    build_running --> build_finished: observe FINISHED
    build_submitted --> failed: observe ERRORED or CANCELED
    build_running --> failed: observe ERRORED or CANCELED
    failed --> prepared: retry with reason
    failed --> superseded: supersede with reason
    build_finished --> validated: verify artifact
    validated --> [*]
    superseded --> [*]
```

*La transacción durable permite reconciliar un timeout sin recompilar; un fallo terminal exige una decisión manual motivada.*

`build-apk.yml` se activa por push a `main` en rutas empaquetadas o manualmente con `reconcile`, `retry-failed` o `supersede-failed`; su concurrencia no cancela una ejecución en curso. Antes de usar `EXPO_TOKEN`, valida el SHA exacto y ejecuta todos los `PRODUCTION_GATES`: políticas, permisos, inventario de datos, legal, prompt, pruebas, OpenWiki, tipos, export Android de desarrollo y E2E de agente/entrenamiento. Si un gate falla o ensucia el checkout, el candidato no es publicable.

Después crea o recupera una transacción durable en un draft de GitHub, adopta como máximo un build EAS que coincida con perfil, versión, SHA y mensaje, y observa EAS hasta terminar. El APK se descarga a cuarentena y `verify:production-artifact` inspecciona su estructura, manifest, firma, tamaño, MIME, paquete, SDK, permisos, configuración y snapshot de política antes de adjuntarlo como `gymnasia.apk` y publicar el draft. La operación exige el environment `Production` y sus controles remotos; una comprobación local no puede reemplazarlos.

Incluso con todos los gates verdes, instale el APK en un dispositivo representativo antes de distribuirlo y compruebe versión, migración/conservación de datos, notificaciones, alarmas y ejecución en segundo plano. La app no implementa un actualizador desde GitHub; la instalación directa es manual y distinta de Play.

## Selección rápida

- **Cambio aislado de lógica:** añada/ejecute el test determinista responsable, `npm test` y typecheck si modifica el workspace móvil.
- **Cambio de UI, persistencia o flujo web:** añada `build:web` y la E2E concreta; amplíe a flujos vecinos cuando comparten el contrato.
- **Cambio de catálogo:** `check:catalogs`, `test:catalogs` y `test:catalogs:e2e`; ejecute escritura solo si debe actualizar salidas.
- **Cambio de privacidad o datos:** `check:data-inventory`, sus tests, checks legales y la E2E de privacidad o borrado cuando modifique la experiencia publicada o de eliminación.
- **Cambio de permiso, plugin o dependencia nativa:** guard rail de permisos, tipado, export y build/prueba nativa; una E2E web no basta.
- **Cambio sensible de prompt o salud:** gates de política más autorización explícita antes de merge; promoción firmada posterior si corresponde.
- **Release Android:** deje que el workflow aplique `verify:production-source`, el environment y la verificación del artefacto; complete con prueba manual en dispositivo.

Para el inventario de repositorios y fuentes de contenido, consulte [Repositorios y fuentes de contenido](../content/repositories.md); para preparar un entorno local, [Inicio rápido](../quickstart.md).
