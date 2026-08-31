---
okf:
  version: 1
  kind: code-wiki
  status: grounded
  scope: Local persistence, hydration, sensitive storage, reset, tracing, and manual backup in apps/mobile
type: concepto
title: Estado local y copia de seguridad
description: Mapa completo de persistencia y ciclo de vida de la aplicación Expo con enfoque local-first, incluidos los límites de almacenamiento, la normalización, la copia de seguridad manual en JSON, los modos de fallo y las invariantes de seguridad.
summary: Complete persistence map and lifecycle for the local-first Expo app, including storage boundaries, normalization, manual JSON backup, failure modes, and security invariants.
tags: [mobile, persistence, local-storage, secure-storage, backup, hydration]
sources:
  - apps/mobile/App.tsx
  - apps/mobile/storage/localDataDeletion.ts
  - apps/mobile/storage/localDataDeletion.test.ts
  - apps/mobile/metro.config.js
  - apps/mobile/trace.ts
  - apps/mobile/app.json
  - apps/mobile/package.json
  - apps/mobile/agent/toolExecutor.ts
  - apps/mobile/agent/toolExecutor.test.ts
  - scripts/data-inventory/inventory.json
  - apps/mobile/agent/providerConfiguration.ts
  - apps/mobile/agent/providerConfigurationPersistence.ts
  - apps/mobile/agent/providerConfigurationPersistence.test.ts
related:
  - ./application-shell.md
  - ./training.md
  - ./measurements.md
  - ./diet-and-food-estimation.md
  - ../agent/runtime.md
  - ../agent/provider-configuration.md
  - ../content/repositories.md
  - ../integrations/vivagym-and-updates.md
  - ../operations/build-release-and-testing.md
---

# Estado local y copia de seguridad

Gymnasia sigue un enfoque local-first: el cliente Expo es propietario del estado del producto, sin una base de datos de la aplicación ni un servicio de sincronización. `App.tsx::GymnasiaApp` mantiene el agregado activo en React, lo hidrata desde `AsyncStorage` y `SecureStore`, y persiste la mayoría de las mutaciones mediante efectos; la configuración de proveedores usa un repositorio con confirmación explícita. El componente `App` exterior permite desmontar y crear de nuevo todo el runtime después de un borrado. La copia de seguridad manual genera un archivo portable en lugar de subirlo a un servicio de Gymnasia. Esta página define ese límite; la semántica de los dominios se aborda en [Entrenamiento](./training.md), [Mediciones](./measurements.md) y [Dieta y estimación de alimentos](./diet-and-food-estimation.md).

## Propiedad del estado y esquemas

### `LocalStore`

`LocalStore` es el principal agregado persistido bajo `STORAGE_KEY` (`gymnasia.mobile.local.v3`):

| Campo | Tipo | Propietario y normalización |
|---|---|---|
| `templates` | `WorkoutTemplate[]` | Plantillas de entrenamiento. La hidratación repara nombres, categorías, iconos, duración, imágenes de ejercicios, series heredadas y series actuales. |
| `workoutHistory` | `WorkoutSessionSummary[]` | Sesiones completadas, normalizadas, con las más recientes primero y limitadas por `MAX_WORKOUT_HISTORY_ITEMS` a 180. |
| `dietByDate` | `Record<string, DietDay>` | Días de dieta normalizados mediante `normalizeDietByDate`. |
| `dietSettings` | `DietSettings` | Completada y migrada mediante `normalizeDietSettings`. |
| `measurements` | `Measurement[]` | Cada registro de métrica/foto se normaliza, se ordena con los más recientes primero y se limita a 1826. Consulte [Mediciones](./measurements.md). |
| `threads` | `ChatThread[]` | Metadatos de los hilos de chat. Los datos ausentes se convierten en un arreglo vacío en lugar de recrear el hilo inicial. |
| `messagesByThread` | `Record<string, ChatMessage[]>` | Los mensajes se reparan por hilo; los roles no válidos se convierten en `assistant`, se generan los identificadores y las fechas ausentes, e `is_streaming` siempre se restablece a `false`. |
| `keys` | `ProviderConfiguration[]` | Reflejo en memoria de la configuración canónica del repositorio de proveedores: exactamente OpenAI, Anthropic y Google, con un activo. El agregado serializado siempre vacía `api_key`. |
| `chatProvider` | `Provider` opcional | Se migra desde la clave activa cuando está ausente. El entorno de ejecución no valida un valor persistido arbitrario frente a la unión de proveedores. |
| `foodAIProvider` | `Provider` opcional | De forma predeterminada, Google cuando está ausente. |

`createInitialStore()` comienza sin entrenamientos, historial, dieta ni mediciones; con la configuración de dieta predeterminada; un hilo `Coach 1` vacío; y tres registros de proveedores predeterminados. En el navegador, la hidratación sin datos persistidos utiliza en su lugar `createWebSeedStore()`, por lo que una ejecución web nueva no equivale a una ejecución nativa nueva.

### Mapa de almacenamiento independiente

El agregado no constituye todo el modelo de persistencia. A continuación se enumeran todas las claves independientes encontradas en el código fuente.

| Backend y clave exacta | Valor almacenado | ¿Incluido en la copia de seguridad manual? | Ciclo de vida |
|---|---|---:|---|
| AsyncStorage `gymnasia.mobile.local.v3` | `LocalStore` siempre saneado, sin claves BYOK | Sí, como `data.store` con las claves eliminadas | Se lee y normaliza durante la hidratación; se reescribe inmediatamente y después de cada cambio del almacén. |
| AsyncStorage `gymnasia.mobile.local.last_good.v1` | Último `LocalStore` verificado, con huella SHA-256 | No | Se renueva tras cada escritura principal verificada. El borrado parcial la sustituye por el estado ya vaciado; el total la elimina. |
| AsyncStorage `gymnasia.mobile.local.quarantine.v1` | Payload original que no pudo leerse con seguridad e incidencias saneadas | No | Bloquea nuevas escrituras hasta recuperar, reintentar o descartar. Ambos alcances de borrado la eliminan para impedir que reaparezcan datos anteriores. |
| AsyncStorage `gymnasia.mobile.provider_configuration.v1` | Diario versionado `committed`/`pending`; completo en web y sin `api_key` en su espejo nativo | No | Fuente canónica en web; en móvil refleja el diario seguro para inspección y recuperación sin duplicar secretos. |
| AsyncStorage `gymnasia.mobile.training.session.v1` | `WorkoutSession` activo | No | Se normaliza durante la hidratación; se establece mientras está activo y se elimina cuando está ausente o se restablece por una importación. |
| AsyncStorage `gymnasia.mobile.training.session_template_snapshot.v1` | Instantánea de `WorkoutTemplate` anterior a la sesión | No | Solo se lee si se hidrata una sesión; se escribe con una sesión y se elimina cuando esta se cierra. |
| AsyncStorage `gymnasia.mobile.chat.system_prompt.v1` | Último prompt del sistema obtenido de forma remota | No | Alternativa de caché; los errores se ignoran deliberadamente. |
| AsyncStorage `gymnasia.mobile.personal_data.v1` | `PersonalDataField[]`, cada uno con `{key, description, value}` | Sí | La configuración y las herramientas del agente lo cargan y guardan por separado. El JSON ausente o no válido se lee como `[]`. |
| AsyncStorage `gymnasia.mobile.user_prefs.v1` | `UserPreferences` | Sí | Se combina superficialmente sobre los valores predeterminados durante la hidratación; se persiste por separado. Contiene el periodo y la métrica del gráfico, así como la configuración de notificaciones. |
| AsyncStorage `gymnasia.mobile.personal_foods.v1` | `FoodRepoEntry[]` | Sí | Se carga después de la hidratación y se persiste mediante un efecto separado. |
| AsyncStorage `gymnasia.mobile.exercises_repo.v2` | Caché del agregado remoto de ejercicios | No | Estrategia que prioriza la red y usa la caché como alternativa. |
| AsyncStorage `gymnasia.mobile.foods_repo.v1` | Caché remota de alimentos | No | Estrategia que prioriza la red y usa la caché como alternativa. |
| AsyncStorage `gymnasia.mobile.products_repo.v1` | Caché remota de productos | No | Estrategia que prioriza la red y usa la caché como alternativa. |
| AsyncStorage `gymnasia.mobile.recipes_repo.v1` | Caché remota de recetas | No | Estrategia que prioriza la red y usa la caché como alternativa. |
| AsyncStorage `gymnasia.mobile.backup_meta.v1` | `{lastBackupAt: string | null}` | No | Se actualiza después de una ruta de exportación/uso compartido correcta; es solo informativo. |
| AsyncStorage `gymnasia.mobile.health_safety.consent.v1` | Consentimiento por proveedor para la evaluación sanitaria opcional | No | Se conserva en el borrado parcial y se elimina en el total. |
| AsyncStorage `gymnasia.mobile.alarm_health.v1` | Último retraso observado y racha de alarmas tardías | No | Diagnóstico local; se conserva en el borrado parcial y se elimina en el total. |
| AsyncStorage `gymnasia.mobile.signed_policy.cache.v1` | Estado público firmado del canal de política y mayor secuencia observada | No | Se conserva en ambos alcances para impedir replays y retrocesos de seguridad; no contiene datos del usuario. |
| AsyncStorage `gymnasia.mobile.body_fat_migration_done` | Marca heredada de una migración retirada | No | Solo se elimina durante la limpieza de arranque de instalaciones antiguas; ya no se lee ni se escribe. |
| AsyncStorage `gymnasia.mobile.lastUpdateCheck` | Marca heredada del actualizador retirado | No | Solo se elimina durante la limpieza de arranque de instalaciones antiguas; ya no se lee ni se escribe. |
| AsyncStorage `gymnasia_debug_traces` | Hasta 1000 objetos `TraceEntry` | No | Gestionado por `trace.ts`; se carga de forma diferida y se reescribe sin esperar el resultado. |
| SecureStore `gymnasia.mobile.v4.provider_configuration` | Diario canónico completo de proveedores, incluidos los secretos | No | Se hidrata al arrancar y solo cambia mediante commits serializados del repositorio. |
| SecureStore `gymnasia.mobile.v3.provider.api_key.<provider>` | Claves BYOK del esquema anterior | No | Se leen para la primera migración y se eliminan únicamente después de confirmar el diario v4. |
| SecureStore `vivagym.email`, `vivagym.password` | Credenciales heredadas de una integración retirada | No | La versión actual no las lee ni escribe durante la hidratación o el uso normal; una actualización dentro del mismo package name las conserva y «Borrar todos mis datos» las elimina y verifica. |
| Archivo de desarrollo `apps/mobile/.dev-store.json` mediante `/dev-store` | JSON saneado de `LocalStore`, sin credenciales ni identificadores de workspace | No | Solo con `EXPO_PUBLIC_DEV_STORE_MIRROR=1`, web en desarrollo y loopback; lectura alternativa cuando AsyncStorage no tiene agregado y escritura espejo atómica después de cambios. |

Las claves de agregado heredadas `gymnasia.mobile.local.v1` y `.v2`, junto con los prefijos más antiguos `gymnasia.mobile.provider.api_key` y `gymnasia.mobile.v2.provider.api_key`, se eliminan durante la hidratación. El prefijo v3 sí participa en la migración al diario v4 y solo se borra después de una escritura correcta.

## Ciclo de vida de hidratación y persistencia

```mermaid
sequenceDiagram
    participant App
    participant AS as AsyncStorage
    participant SS as SecureStore
    participant Repo as ProviderConfigurationRepository
    participant Dev as Metro dev store
    participant Norm as normalizeStore
    App->>SS: Check availability
    App->>AS: Delete legacy aggregate keys
    par Read durable partitions
        App->>AS: Read aggregate session snapshot and preferences
    and Read provider journal and legacy secrets
        App->>SS: Read v4 journal and v3 provider keys
    end
    opt Aggregate is absent on web development
        App->>Dev: GET dev store
        Dev-->>App: Sanitized LocalStore JSON or no value
    end
    App->>Norm: Parse and normalize aggregate
    Norm-->>App: Canonical bounded store
    App->>App: Hydrate repository or migrate legacy provider values
    App->>SS: Commit v4 journal then delete migrated v3 keys
    App->>AS: Rewrite sanitized aggregate
    App->>App: Publish store session preferences and hydrated flag
    App->>AS: Load caches personal foods and backup metadata
    App->>AS: Delete retired updater and body-fat migration markers
```

*Leyenda: La hidratación inicial canoniza el agregado y recupera el último commit completo de proveedores; un `pending` aislado no se activa. Solo después habilita los efectos del resto del dominio.*

La barrera `isHydrated` es la invariante clave: los efectos del agregado, las preferencias, los alimentos personales y la sesión finalizan antes de que se vuelva verdadera, lo que impide que los valores predeterminados iniciales de React sobrescriban el estado duradero durante una carga normal. `loading`, `error` e `isHydrated` son estados distintos. Un agregado principal dañado o una confirmación ambigua no habilita los efectos: abre la recuperación con cuarentena y, cuando existe, el último snapshot íntegro.

Después de la hidratación:

1. Cualquier cambio en `store` se serializa mediante `serializeStoreForAsyncStorage`, escribe el agregado saneado y llama a `saveDevStoreFile` con la misma versión saneada. Los secretos no se persisten mediante este efecto.
2. Los cambios de proveedor pasan por `ProviderConfigurationRepository`: se encolan, escriben un candidato `pending` y solo publican `committed` si la operación sigue vigente.
3. `userPrefs`, `personalFoods` y `activeWorkoutSession` tienen efectos independientes y, por tanto, puntos de confirmación independientes.
4. La eliminación de una sesión también elimina su instantánea de plantilla. Los fallos al escribir la instantánea se ignoran; los fallos de la sesión muestran un error global.
5. Las cachés de repositorios, la caché del prompt del sistema, los datos personales, los metadatos de copia de seguridad y las trazas se escriben mediante sus propias funciones, no mediante el efecto principal de persistencia.
6. Las marcas heredadas del actualizador y de la antigua migración de grasa corporal se eliminan durante la hidratación y no se vuelven a escribir.

### Copropiedad en memoria

La Memoria personal está deliberadamente fuera de `LocalStore`. La configuración y las herramientas del agente comparten `gymnasia.mobile.personal_data.v1`, pero no comparten un único objeto de estado reactivo:

| Actor | Ruta de lectura | Ruta de escritura | Consecuencia para la coherencia |
|---|---|---|---|
| Configuración de Memoria | `loadMemoryFields` llama de forma diferida a `loadPersonalData` una vez cuando se accede por primera vez a la sección | Las confirmaciones, adiciones y eliminaciones de la interfaz llaman a `savePersonalData`; las ediciones también residen en `memoryFields` | No hay suscripción al almacenamiento ni recarga después de la primera carga; la pantalla puede sobrescribir escrituras externas más recientes |
| Herramientas del agente | Los controladores de lista/descripción/valor llaman a la función `loadPersonalData` inyectada para cada operación | `save_personal_data` reemplaza todo el arreglo mediante la función `savePersonalData` inyectada | Las lecturas ven las escrituras duraderas de la interfaz, pero las escrituras no actualizan una pantalla de Memoria que ya esté abierta |
| Exportación de copia de seguridad | Llama a `loadPersonalData` inmediatamente antes de crear la carga útil | Ninguna | Exporta el valor almacenado, no una edición de texto sin guardar que solo se conserve en `memoryFields` |
| Importación de copia de seguridad | No se combina con la Memoria actual | Guarda directamente el arreglo importado o `[]` | No actualiza `memoryFields` ni borra `memoryLoaded`; una pantalla abierta y obsoleta puede sobrescribir posteriormente la importación |
| Borrado parcial | Sin lectura | Sin escritura | Conserva la Memoria almacenada |
| Borrado total | Sin lectura | Elimina la clave y verifica que ya no exista | El remontaje completo descarta además cualquier instantánea de Memoria que quedara en React |

`loadPersonalData` devuelve `[]` cuando el JSON está ausente o no es válido y no realiza ninguna normalización del esquema a nivel de elemento. `save_personal_data` es un reemplazo, no una combinación a nivel de campo. Los cambios en esta área deben coordinar el estado de la interfaz, las dependencias del agente, la copia de seguridad y la semántica de restablecimiento; corregir un único propietario mantiene los riesgos de que prevalezca la última escritura.

### Propiedad de las notificaciones

Las opciones de notificación se encuentran en `UserPreferences.notifications`, dentro de la clave independiente `gymnasia.mobile.user_prefs.v1`, y no son campos de `LocalStore` ni de la sesión de entrenamiento activa. La forma es `{ enabled, sound, vibrate, soundKey }`, con los valores predeterminados `true`, `true`, `true` y `rest_finished`. La hidratación combina superficialmente las preferencias almacenadas sobre `DEFAULT_USER_PREFS`; como el objeto anidado no se combina en profundidad, un objeto `notifications` presente pero parcial o mal formado no se repara campo por campo.

Las preferencias se persisten por separado después de la hidratación, se incluyen en la copia de seguridad como `data.userPrefs` y se reemplazan durante la importación (o se restablecen a sus valores predeterminados cuando están ausentes). El borrado parcial las conserva y el total elimina y verifica su clave. La propiedad en tiempo de ejecución corresponde al entrenamiento: `enabled` controla la programación en segundo plano, mientras que el sonido y la vibración en primer plano siguen sus propias opciones. Los efectos exactos, las diferencias de canales de Android y los tonos disponibles se describen en [Entrenamiento](./training.md#preferencias-de-notificación-y-efectos-exactos); la ruta de configuración se encuentra en [Interfaz de la aplicación](./application-shell.md#control-de-la-configuración-de-notificaciones).

### Invariantes de normalización

`normalizeStore` es el límite de compatibilidad, no un validador general de esquemas. Aplica invariantes locales importantes:

- las mediciones y el historial de entrenamientos se ordenan por fecha descendente y tienen límites;
- existen los tres registros de proveedores, con uno y solo uno activo;
- los valores de medición positivos se redondean a dos decimales, mientras que los valores no válidos o no positivos se convierten en `null`;
- los mensajes de chat no pueden reanudarse en estado de transmisión después de reiniciar;
- la representación antigua del entrenamiento basada en `sets`, `load_kg` y `rest_seconds` se concilia con las series actuales;
- los registros y la configuración de dieta, así como los resúmenes de entrenamientos, se normalizan antes de pasar a estar activos.

No valida en profundidad cada objeto. En particular, `threads` se acepta directamente, los campos de selección de proveedor se convierten mediante una aserción de tipo en lugar de comprobarse, y la validación de la copia de seguridad puede aceptar datos anidados mal formados que posteriormente hagan que la normalización lance una excepción.

## Límite de datos sensibles

`serializeStoreForAsyncStorage` reemplaza cada `ProviderConfiguration.api_key` por `""` antes de serializar el agregado y sus snapshots de recuperación. Los backups y el espejo usan el saneamiento recursivo de `devStore`, que censura claves API, identificadores de workspace y otros campos de credencial conocidos. El repositorio admite los valores del agregado y las claves v3 únicamente como entrada de migración; a partir de entonces, el diario es la autoridad.

En web, donde SecureStore no existe por definición, el diario completo de proveedores vive en AsyncStorage y la interfaz advierte de la menor protección. En una plataforma nativa que debería tener SecureStore pero no puede usarlo, la aplicación no degrada un guardado nuevo a texto plano: informa del fallo y conserva la configuración anterior. Las credenciales heredadas de VivaGym no tienen alternativa en texto sin formato.

El espejo de desarrollo está desactivado por defecto. `web:mirror` activa el cliente y el middleware con `EXPO_PUBLIC_DEV_STORE_MIRROR=1`; aun así, `/dev-store` solo acepta loopback y mismo origen, no emite CORS permisivo y valida tipo, límite de 5 MiB y esquema raíz. Cliente y servidor censuran los campos sensibles, de modo que un cliente alterado tampoco puede escribir credenciales. El reemplazo usa un temporal en el mismo directorio, `fsync`, rename atómico, permisos `0600` y una cola que ordena escrituras concurrentes. Un archivo heredado se sanea antes de servirse. Sigue conteniendo estado personal de salud y chat, por lo que debe tratarse como sensible y nunca confirmarse en Git.

Las entradas de traza pueden contener cualquier tipo de `data`. `pushTrace` las envía también a la consola y las almacena en AsyncStorage; quienes realicen llamadas no deben añadir credenciales ni datos personales. La persistencia de trazas conserva las 1000 entradas más recientes, pero sus escrituras sin espera no son transaccionales.

### Carga, copia, borrado y privacidad de las trazas

`trace.ts` administra un búfer a nivel de módulo junto con `gymnasia_debug_traces`. La primera llamada a `pushTrace` o `getTraces` analiza de forma diferida el JSON almacenado; solo se comprueba que sea un arreglo, y los errores de lectura o análisis producen un búfer vacío. Las primeras llamadas concurrentes comparten `traceBufferLoading`, lo que evita que una carga sobrescriba a otra. Las lecturas posteriores devuelven una copia superficial del arreglo del búfer en memoria y no vuelven a leer el almacenamiento. Cada inserción añade `{ ts, tag, message, data }`, conserva las 1000 entradas más recientes, inicia una escritura de persistencia sin esperarla y también registra en la consola la entrada con formato.

El panel de trazas de Configuración ofrece tres operaciones distintas:

- **Cargar/actualizar:** `getTraces` devuelve el búfer actual. `formatTraces` añade la plataforma, la marca de tiempo de generación, el recuento, la marca de tiempo ISO de cada entrada y la serialización JSON sin censura de `data`.
- **Copiar:** `Clipboard.setStringAsync` recibe todo el texto sin formato. Los errores de copia se descartan. No hay censura, confirmación, uso compartido o carga automáticos ni limpieza del portapapeles; la privacidad del portapapeles después de la llamada es responsabilidad del sistema operativo.
- **Borrar:** `clearTraces` espera la carga inicial, vacía el búfer e intenta ejecutar `AsyncStorage.removeItem`. Los errores de eliminación se descartan y, a continuación, el panel borra su lista local; por tanto, el estado vacío visible no demuestra un borrado duradero.

Las trazas se excluyen de la copia de seguridad/importación y del borrado parcial; el borrado total vacía el búfer del módulo, elimina la clave y verifica ambos resultados. La importación no puede sobrescribirlas y la exportación de una copia de seguridad no las revela. Sin embargo, pueden permanecer copias en la consola de Expo o en herramientas como `adb logcat`, independientemente de que se borre AsyncStorage. Los productores actuales incluyen el montaje de la aplicación, eventos de permiso/canal/programación/cancelación/entrega/pulsación de notificaciones, errores de alertas de descanso y los títulos, cuerpos y activadores asociados; los cuerpos de las notificaciones pueden contener nombres de ejercicios. Tanto el almacenamiento de trazas como los volcados al portapapeles deben tratarse como datos de diagnóstico potencialmente personales. El flujo de la interfaz está enlazado desde [Interfaz de la aplicación](./application-shell.md#panel-de-trazas-y-límite-de-privacidad).

## Contrato de copia de seguridad manual

### Sobre de la versión 1

`buildBackupPayload` genera la siguiente estructura JSON:

```json
{
  "app": "gymnasia",
  "type": "backup",
  "schemaVersion": 1,
  "appVersion": "1.16.0",
  "createdAt": "ISO-8601 timestamp",
  "data": {
    "store": "LocalStore with every provider api_key blank",
    "userPrefs": "UserPreferences",
    "personalFoods": "FoodRepoEntry[]",
    "personalData": "PersonalDataField[]"
  }
}
```

`appVersion` procede de la configuración de Expo, con `0.0.0` como valor alternativo; es un metadato, no una comprobación de compatibilidad de importación. `schemaVersion` es el control de compatibilidad. El analizador acepta versiones de esquema inferiores o iguales a `BACKUP_SCHEMA_VERSION`, rechaza las versiones futuras y solo comprueba la identidad del sobre, la versión numérica y la presencia de `data.store`. No existen funciones explícitas de migración por versión.

Los datos excluidos son importantes desde el punto de vista semántico: claves de API de proveedores, credenciales heredadas de integraciones retiradas, entrenamiento activo e instantánea anterior a la sesión, cachés remotas, caché de prompts, trazas, metadatos de copias de seguridad y marcas heredadas de funciones retiradas. Una cadena `photo_uri` dentro de una medición se incluye porque las mediciones residen en `store`, pero los bytes de la imagen referenciada **no** se copian en el JSON. Por tanto, un dispositivo restaurado puede contener URI `file:` o `content:` inservibles.

### Secuencias de exportación e importación

```mermaid
sequenceDiagram
    participant User
    participant UI as Backup settings
    participant Builder as buildBackupPayload
    participant FileSys as File or browser download
    participant Meta as Backup metadata
    User->>UI: Export
    UI->>UI: Load personal data
    UI->>Builder: Store preferences foods personal data
    Builder->>Builder: Strip provider API keys
    Builder-->>UI: Version 1 JSON
    alt Web
        UI->>FileSys: Create Blob and trigger download
    else Native
        UI->>FileSys: Write cache file and open share sheet
        UI->>FileSys: Delete temporary cache file in finally
    end
    UI->>Meta: Write successful export timestamp
    Meta-->>User: Show success
```

*Leyenda: La exportación captura cuatro particiones de datos del usuario, elimina los secretos de los proveedores y delega la ubicación duradera a una descarga del navegador o a la hoja nativa de uso compartido.*

El nombre de archivo usa la hora local: `gymnasia_backup_YYYYMMDD_HHMM.json`. En el entorno nativo, el archivo de caché se reemplaza y, a continuación, se requieren `Sharing.isAvailableAsync()` y `shareAsync()`; un bloque `finally` elimina la copia temporal tanto si compartir termina como si falla. El archivo elegido para importar también se copia a caché y se elimina después de leerlo. La marca de tiempo de los metadatos significa que el flujo llegó al final de la invocación de descarga o uso compartido; no puede demostrar que el usuario conservara o subiera el archivo.

```mermaid
sequenceDiagram
    participant User
    participant Picker as DocumentPicker
    participant Parser as parseBackupPayload
    participant Import as applyPendingImport
    participant SS as SecureStore
    participant React as React state
    participant Effects as Persistence effects
    User->>Picker: Select one file
    Picker->>Parser: Parse JSON and validate envelope
    Parser-->>React: Set pending import
    User->>Import: Confirm replacement
    Import->>Repo: Read current committed provider keys
    Import->>Import: Normalize imported LocalStore
    Import->>Import: Merge current local keys
    Import->>Repo: Commit imported provider metadata plus current secrets
    Import->>React: Replace store preferences and personal foods
    Import->>Effects: Save personal data directly
    Import->>React: Close active workout session
    Effects->>Effects: Persist changed partitions asynchronously
```

*Leyenda: La importación es un reemplazo confirmado de las particiones incluidas en la copia de seguridad, que conserva las claves de proveedor actuales y finaliza intencionadamente cualquier entrenamiento activo.*

La selección acepta JSON, texto sin formato o cualquier tipo MIME; lee el archivo, analiza el JSON, valida superficialmente el sobre y lo almacena en `pendingImport`. La selección por sí sola no modifica ninguna partición duradera. Después, la confirmación normaliza `data.store`, superpone las claves y workspace actuales del último commit local, confirma primero esa configuración mediante el repositorio, asigna valores predeterminados a las preferencias ausentes, actualiza el estado de React, espera directamente la escritura de datos personales y llama a `setActiveWorkoutSession(null)`.

La importación no elimina directamente el almacenamiento de la sesión. Después de que React publique la sesión nula, el efecto protegido de la sesión elimina tanto `gymnasia.mobile.training.session.v1` como `gymnasia.mobile.training.session_template_snapshot.v1`; por tanto, la importación finaliza cualquier entrenamiento activo y elimina ambas claves excluidas, en lugar de intentar normalizarlas respecto a las plantillas importadas. Las demás particiones modificadas son persistidas por efectos independientes, de modo que la finalización no constituye una confirmación duradera atómica. La Memoria importada tampoco se copia en `memoryFields`, por lo que se mantiene la salvedad sobre la copropiedad descrita anteriormente.

## Atomicidad, restablecimiento y comportamiento ante fallos

No existe ninguna transacción que abarque AsyncStorage, SecureStore, el estado de React, el archivo de desarrollo o las particiones de la copia de seguridad.

- El agregado principal y la configuración de proveedores continúan siendo particiones distintas, pero ya no se escriben juntas mediante un efecto. Cada mutación de proveedor espera su diario; un fallo restaura el commit anterior y evita publicar el candidato en React.
- En móvil, el diario escribe un `pending` completo, después el espejo saneado y finalmente el `committed` seguro. No es una transacción del sistema operativo, pero la hidratación nunca promociona un `pending` sobreviviente.
- La importación modifica el almacén, las preferencias y los alimentos en React antes de esperar la persistencia de los datos personales. Si esa escritura final falla, la interfaz informa de un fallo de importación aunque las particiones anteriores en memoria hayan cambiado y quizá ya se hayan persistido mediante efectos.
- `saveMeasurementsToStorage` y el efecto principal del agregado escriben en la misma clave. La ruta de lectura-modificación-escritura de la migración/herramienta puede entrar en conflicto con una escritura más reciente del agregado.
- La mayoría de los fallos de cachés, preferencias, alimentos personales, prompts, trazas e instantáneas se descartan. La aplicación prioriza la disponibilidad sobre la confirmación de escritura duradera.
- Un JSON de agregado dañado o una confirmación ambigua bloquea la hidratación normal y ofrece restaurar, exportar, reintentar o descartar; los efectos no pueden sobrescribir ese estado mientras la recuperación siga pendiente.
- Los fallos de SecureStore durante un commit de proveedor se devuelven al controlador de guardado, que muestra el error y conserva la configuración anterior. Si el diario seguro no puede hidratarse, la app conserva la configuración legible, marca el almacenamiento seguro como no disponible para nuevos guardados y muestra un aviso no fatal.

La gestión de datos se apoya en un manifiesto explícito (`LOCAL_DATA_MANIFEST` y
`LOCAL_SECURE_DATA_MANIFEST`) cuyo alcance debe coincidir exactamente con
`scripts/data-inventory/inventory.json`:

- «Borrar actividad y conversaciones» reescribe el agregado principal con rutinas,
  historial, dieta, medidas y chats vacíos, pero conserva `dietSettings`, la selección y
  configuración de proveedores y sus claves; dentro de la misma cola de recuperación
  elimina la sesión y su instantánea, descarta la cuarentena y crea un snapshot íntegro
  del estado ya vaciado. Las particiones independientes de Memoria, alimentos personales,
  preferencias, cachés, diagnósticos, consentimientos y metadatos se conservan.
- «Borrar todos mis datos» elimina en exclusiva el agregado, su snapshot, la cuarentena y
  la sesión; además recorre tanto el manifiesto como cualquier clave encontrada en el
  namespace activo, excepto `gymnasia.mobile.signed_policy.cache.v1`. También elimina
  trazas, claves actuales y antiguas de SecureStore, credenciales heredadas y el espejo
  web de desarrollo cuando está habilitado.
- Ambos alcances cancelan avisos programados y descartan notificaciones presentadas.
  Después de cada operación se vuelve a leer el destino. Un timeout, rechazo o valor
  todavía presente produce un informe incompleto; los otros destinos siguen
  procesándose y la interfaz ofrece reintento.
- El único valor conservado por seguridad es la caché pública firmada anti-retroceso:
  no contiene datos del usuario y evita cargar instrucciones de seguridad anteriores.
- Tras terminar, el componente `App` incrementa una generación y remonta
  `GymnasiaApp`. Así desaparecen referencias, borradores, propuestas de feedback y
  otras instantáneas de React que podrían volver a persistir datos borrados.

El borrado no puede alcanzar copias exportadas, fotos de la galería, permisos y canales
del sistema, logs del sistema operativo ni datos ya enviados a un proveedor. La interfaz
y la política enumeran esos límites en vez de presentar el resultado como un borrado
global del dispositivo.

## Pruebas y comandos de validación

`storage/localDataDeletion.test.ts` cubre el orden borrar/verificar, fallos parciales,
timeouts, reintentos y combinaciones arbitrarias con `fast-check`. También compara los
dos manifiestos de runtime con el inventario de privacidad para que añadir una nueva
partición sin decidir sus dos alcances rompa la suite. `providerConfigurationPersistence.test.ts`
cubre migración, diario web/nativo, saneamiento de AsyncStorage, fallo de la escritura
segura final, rollback obsoleto, recuperación de `pending` y commits concurrentes;
`agent-chat.e2e.mjs` prueba además el reinicio web y el ciclo BYOK. Siguen requiriendo
validación de integración y nativa la hidratación completa, la atomicidad transversal
de importación y la portabilidad de fotos.

Ejecute las comprobaciones específicas actuales desde la raíz del repositorio:

```bash
npm test
npm --workspace apps/mobile run test:deterministic
npm --workspace apps/mobile exec tsc --noEmit
```

El comando de TypeScript es una comprobación específica útil del contrato, pero no está declarado como script del paquete. Para la validación manual de la persistencia:

```bash
npm run dev:mobile
npm --workspace apps/mobile run web
npm --workspace apps/mobile run web:mirror
```

Verifique por separado un ciclo nativo y uno web: cree cada partición, reinicie, inspeccione el estado normalizado, exporte, compruebe que todos los valores `data.store.keys[*].api_key` estén vacíos, importe después de cambiar las claves locales, confirme que se conserven, cierre la sesión activa y pruebe archivos ausentes, no válidos y futuros. En móvil, compruebe que el espejo AsyncStorage no contiene el secreto; en web, compruebe que solo el diario dedicado y nunca `local.v3` ni `.dev-store.json` lo contiene. Para el espejo ejecute `npm run test:dev-store` y `npm run test:dev-store:e2e`: deben demostrar activación explícita, CORS denegado, saneado profundo, límites, atomicidad y ausencia del archivo en el índice Git sin tocar el estado real del desarrollador.

## Procedimiento seguro para realizar cambios

1. Añada un campo al tipo de TypeScript propietario y a su constructor inicial/predeterminado.
2. Amplíe `normalizeStore` o el cargador independiente para que los valores persistidos antiguos o mal formados reciban un valor determinista.
3. Decida si el campo corresponde a datos del usuario, estado efímero, una caché que puede volver a descargarse o un secreto; colóquelo en el backend adecuado en lugar de ampliar automáticamente `LocalStore`.
4. Si debe incluirse en una copia de seguridad portable, actualice `BackupData`. Para cambios incompatibles, incremente `BACKUP_SCHEMA_VERSION` y añada una migración explícita de importación en lugar de depender de una aserción de tipo.
5. Actualice deliberadamente la semántica de restablecimiento y documente si los usuarios existentes conservan el campo.
6. Pruebe fallos entre todas las particiones confirmadas de forma independiente, el comportamiento cuando SecureStore no está disponible, guardados obsoletos o concurrentes, el JSON dañado y las copias antiguas/futuras.
7. Si añade contenido multimedia, exporte los bytes o los archivos copiados en lugar de incluir únicamente URI locales del entorno aislado.

Las invariantes centrales son: no persistir secretos en el agregado general ni en el espejo nativo; no activar un candidato hasta confirmar su diario; no iniciar efectos antes de hidratar; normalizar toda entrada duradera; mantener limitadas las colecciones acotadas; y no afirmar que una restauración completa es atómica mientras las demás particiones sigan teniendo confirmaciones independientes.
