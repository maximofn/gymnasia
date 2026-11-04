---
type: guía operativa de Android
title: Permisos Android y configuración nativa
description: Contrato operativo que separa la intención Expo, el prebuild Android limpio, los manifests de dependencias y la inspección de artefactos Production. Describe los permisos, la cuota nativa de AsyncStorage y la cadena de publicación en Google Play.
tags: [android, permissions, native-config, expo, release, privacy]
verified:
  - by: openwiki/0.6.0
    at: 2026-11-04T15:49:26.600Z
sources:
  - id: openwiki-source-0b86c93537ee4ff0031996d7
    resource: repo://.github/workflows/build-apk.yml
  - id: openwiki-source-a6ba9053969a3e00cd971742
    resource: repo://apps/mobile/app.config.ts
  - id: openwiki-source-3de323c9f3752d72d82de839
    resource: repo://apps/mobile/app.json
  - id: openwiki-source-e6092e57680c1313a5efe04e
    resource: repo://apps/mobile/notifications/notificationSounds.json
  - id: openwiki-source-5dfa33a219815904c9a1abec
    resource: repo://apps/mobile/plugins/withAsyncStorageCapacity.cjs
  - id: openwiki-source-365420acf5275e09131fb6f5
    resource: repo://docs/architecture/android-native-config.md
  - id: openwiki-source-2d655b45e3cde056bceb5bed
    resource: repo://docs/legal/play-declarations.md
  - id: openwiki-source-eabbb9df6bf2993bf11b4c2d
    resource: repo://scripts/android-native-config/native-config.mjs
  - id: openwiki-source-11d434466432a7f5b120a19d
    resource: repo://scripts/android-native-config/native-config.test.mjs
  - id: openwiki-source-f216a5859a78da7068bbbf84
    resource: repo://scripts/android-native-config/policy.json
  - id: openwiki-source-04670a0f0e5b5511e325ee46
    resource: repo://scripts/android-permissions/permissions.mjs
  - id: openwiki-source-c657bdb933b7ed64c860ab05
    resource: repo://scripts/android-permissions/permissions.test.mjs
  - id: openwiki-source-64cfb10f64bc60a5e55e4ded
    resource: repo://scripts/android-permissions/policy.json
  - id: openwiki-source-913526c7e32c0e351cbf2431
    resource: repo://scripts/data-inventory/inventory.json
  - id: openwiki-source-f807c3c379c670c5871c2b49
    resource: repo://scripts/data-inventory/inventory.mjs
  - id: openwiki-source-7718d8047e7c1e0a6137f6de
    resource: repo://scripts/production-release/policy.json
  - id: openwiki-source-24a206e2ad72f4f0a1502c09
    resource: repo://scripts/production-release/production-release.mjs
  - id: openwiki-source-a43fcdd54439cd4258ab69e4
    resource: repo://scripts/production-release/verify-artifact.mjs
generated: { by: "openwiki/0.6.0", at: "2026-11-04T15:49:26.600Z" }
---

# Permisos Android y configuración nativa

La configuración publicable tiene cuatro fronteras que deben coincidir, pero que prueban cosas distintas: `app.json` expresa la intención Expo; el chequeo de permisos revisa configuración y manifiestos de dependencias instaladas; el prebuild limpio inspecciona los archivos nativos recién generados; y la release inspecciona el manifest fusionado del APK/AAB. No se debe usar `apps/mobile/android/` como evidencia: está ignorado y puede faltar o estar desactualizado.

## Contrato de permisos y privacidad

`expo.android.permissions` declara exclusivamente `WAKE_LOCK`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED` y `SCHEDULE_EXACT_ALARM`. `expo.android.blockedPermissions` debe conservar `USE_EXACT_ALARM`, `REQUEST_INSTALL_PACKAGES`, `RECORD_AUDIO` y `SYSTEM_ALERT_WINDOW`. Además, el contrato nativo prohíbe `FOREGROUND_SERVICE`. `expo-av` configura `microphonePermission: false`, coherente con reproducir avisos y no grabar audio.

| Permiso permitido | Necesidad aprobada |
| --- | --- |
| `WAKE_LOCK` | Despertar el dispositivo para el aviso de fin de descanso. |
| `VIBRATE` | Vibración configurable del aviso. |
| `RECEIVE_BOOT_COMPLETED` | Reprogramar avisos tras reiniciar. |
| `SCHEDULE_EXACT_ALARM` | Programar el aviso exacto de descanso. |

`check:android-permissions` normaliza tanto `android.permission.X` como `X`, exige que la lista declarada coincida con la allowlist y exige cada bloqueo configurado. También recorre `AndroidManifest.xml` bajo los `node_modules` raíz y de `apps/mobile`, sin seguir enlaces simbólicos y omitiendo ejemplos, tests e intermedios definidos por política. Si no encuentra manifiestos, falla con `scanner-empty`: ejecutar el check sin `npm ci` no es una comprobación válida.

El escáner de dependencias identifica contribuidores de permisos bloqueados; `acknowledgedContributors` solo silencia ese diagnóstico para un origen ya conocido, no autoriza el permiso final. Una entrada `<uses-permission ... tools:node="remove"/>` no cuenta como declaración: ordena al *manifest merger* retirarla. Por ello, ni este escaneo ni un `grep` del manifest fuente prueban el contenido del binario. El conjunto completo aceptado del manifest final está fijado por `expectedArtifactPermissions`, que incluye contribuciones legítimas de dependencias además de los cuatro permisos configurados explícitamente.

```mermaid
flowchart TD
  Expo["app.json y app.config.ts"] --> DependencyScan["Check de permisos del checkout"]
  Dependencies["Manifests en node_modules"] --> DependencyScan
  Expo --> Prebuild["Prebuild Android limpio"]
  Plugin["Plugin de capacidad AsyncStorage"] --> Prebuild
  DependencyScan --> SourceGate["Gates de fuente"]
  Prebuild --> SourceGate
  SourceGate --> Build["Compilar AAB y APK"]
  Build --> Verify["Verificar manifests de artefactos"]
  Verify --> Publish["Publicar AAB validado en Play production"]
```

*El diagrama muestra las fronteras de verificación: una declaración Expo o un manifest generado no sustituye la inspección del artefacto distribuible.*

## Configuración dinámica y prebuild limpio

`app.config.ts` rechaza un `APP_ENV` desconocido, parte de `app.json`, cambia el identificador de paquete por variante y vuelve a añadir `expo-notifications` con las rutas del catálogo de sonidos. Así, cambiar un plugin, un sonido, el configurador dinámico o una dependencia que aporte configuración nativa requiere revisar el contrato, no solo TypeScript/JavaScript.

`npm run check:android-native-config` no reutiliza el Android ignorado del checkout. Copia `apps/mobile` a un directorio temporal excluyendo `.expo`, `android`, `ios`, `dist` y `node_modules`; enlaza las dependencias ya instaladas y allí ejecuta:

```bash
expo prebuild --platform android --clean --no-install
```

El proceso fija `APP_ENV=production`, `CI=1` y `EXPO_NO_GIT_STATUS=1`, lee los resultados generados y borra el temporal salvo que su API reciba `keepTemporary`. Detecta así deriva introducida por configuración o plugins con un árbol nativo nuevo, sin modificar el checkout.

La política evalúa productos del prebuild, no el comportamiento de la aplicación en ejecución:

| Producto generado | Invariante actual |
| --- | --- |
| `AndroidManifest.xml` fuente | Conjuntos exactos de permisos declarados y directivas `tools:node="remove"`; ningún permiso fuente prohibido. |
| Etiquetas `application` y `.MainActivity` | `enableOnBackInvokedCallback=false`, atributos revisados de actividad y marcadores Kotlin requeridos. |
| `res/raw` | Exactamente los WAV de notificación aprobados. |
| `gradle.properties` | Una y solo una propiedad `AsyncStorage_db_size_in_MB=64`. |
| Salida de `expo prebuild` | Solo advertencias reconocidas por `allowedPrebuildWarnings`. |

Las advertencias se extraen solo de líneas que comienzan por `!`, `»`, `⚠`, `warning` o `warn`. Una advertencia es aceptable únicamente si coincide con un patrón de política; la allowlist actual está vacía, por lo que cualquier advertencia detectada produce `prebuild-warning`. No se debe añadir una allowlist genérica: hay que entender y aprobar el cambio concreto de Expo o del plugin.

### Cuota de AsyncStorage: ajuste nativo, no capacidad web

`withAsyncStorageCapacity.cjs` elimina durante el prebuild Android cualquier `AsyncStorage_db_size_in_MB` anterior y escribe `64`. El check confirma que el `gradle.properties` generado contiene exactamente una ocurrencia con ese valor; ausencia, el valor por defecto de 6 MiB o duplicados fallan como `gradle-property`.

Este mecanismo no migra ni reemplaza la base de datos y no declara permisos. Tampoco describe ni aumenta una cuota del runtime web: su alcance es el proyecto Android nativo generado y la propiedad Gradle de AsyncStorage. Los límites, errores de capacidad y recuperación de datos en runtime se tratan en [Estado local, persistencia y copias](../mobile/local-state-and-backup.md).

## De la fuente validada a Production y Play

`validate-production` hace checkout del SHA seleccionado y ejecuta `verify:production-source` antes de la aprobación del entorno `Production`. Sus gates canónicos incluyen los checks y tests de permisos y de configuración nativa; la verificación también falla si esos gates ensucian el checkout. `compile-android` es el único job asociado al entorno `Production`: vuelve a obtener el SHA validado en el runner self-hosted `wallabot` y construye AAB antes que APK.

Los resultados del build se transfieren como no confiables. `verify-artifacts`, en un runner separado, los descarga a cuarentena y ejecuta `verify:production-artifact` para cada formato. El verificador usa `bundletool` fijado y comprobado para el AAB, y herramientas Android para el APK; extrae el manifest y rechaza un permiso bloqueado o un conjunto diferente de `expectedArtifactPermissions`. Esto verifica declaraciones del artefacto distribuible, no que un usuario haya concedido un permiso ni que una alarma funcione en un dispositivo.

Para el destino Play se restaura **solo** el AAB validado junto con sus evidencias y se envía mediante el perfil `production` al track `production` con estado `completed`. Antes de publicar el borrador, el flujo reconcilia el envío y obtiene el recibo de Google Play; comprueba además la transacción durable y los hashes de AAB, APK, evidencias y recibo. Un fallo conserva el estado durable para reconciliar o reintentar sin duplicar un envío incierto. Que Play complete el envío no prueba revisión de Google ni disponibilidad pública: debe verificarse la versión en Play Console y Play Store.

## Operación y diagnóstico

Ejecute desde la raíz con dependencias instaladas:

```bash
npm ci
npm run check:android-permissions
npm run test:android-permissions
npm run check:android-native-config
npm run test:android-native-config
npm run check:data-inventory
npm run test:data-inventory
```

Los checks evalúan el checkout y el prebuild; los tests ejercitan el evaluador con fixtures y regresiones. `permissions.test.mjs` cubre el contrato real, la vivacidad del recorrido de manifests, códigos de infracción y que `tools:node="remove"` no sea una declaración. `native-config.test.mjs` cubre conjuntos exactos, atributos y marcadores de `MainActivity`, sonidos, warnings y la propiedad Gradle de 64 MiB, incluidos ausencia, valor de 6 MiB y duplicados. Son guardrails deterministas y no sustituyen pruebas Android físicas de permisos concedidos/denegados, alarmas, notificaciones, audio, segundo plano o capacidad real.

| Señal | Acción segura |
| --- | --- |
| `config-drift` o `config-missing-block` | Alinear `app.json` y la política; no retirar el gate. |
| `dependency-contribution` | Revisar el manifest de la dependencia y confirmar el bloqueo; reconocer el origen no autoriza el artefacto. |
| `scanner-empty` | Ejecutar `npm ci` y repetir. |
| `source-permissions`, `removal-directives` o `forbidden-source-permission` | Revisar la configuración/plugin y la semántica del merger. |
| `gradle-property` | Corregir el plugin o la política para dejar una única cuota nativa de 64 MiB. |
| `prebuild-warning`, `main-activity-*` o `notification-sounds` | Investigar el cambio específico; no ampliar una allowlist genérica. |
| `permission` o `artifact-permissions` | Detener la release: el manifest fusionado no satisface el contrato. |

Un cambio intencionado debe actualizar en la misma revisión la configuración Expo, las políticas afectadas y su justificación. Si modifica el prebuild, actualice también el contrato nativo y sus pruebas. Los cambios de permisos requieren revisar el inventario Data safety y las declaraciones de Play. Antes de una release, ejecute también `npm run test:production-release`, `npm run check:legal` y `npm run test:legal`; `expectedArtifactPermissions` solo se modifica tras revisar un artefacto, nunca para silenciar un fallo.

Para la cadena completa consulte [Build, release y estrategia de validación](build-release-and-testing.md). Para el ciclo del runtime móvil, consulte [Shell y navegación de la aplicación móvil](../mobile/application-shell.md).
