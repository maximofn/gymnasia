---
okf:
  version: 1
  kind: code-wiki
  status: grounded
  requirement: RQ-01
  scope: Canonical AI provider configuration across settings UI, persistence, selection, verification, discovery, and consumers
type: concepto
title: Configuración de proveedores
description: Ciclo de vida completo de la configuración, selección, credenciales, modelos, verificación, enrutamiento, fallos, pruebas y extensiones de OpenAI, Anthropic y Google.
summary: RQ-01-complete lifecycle for OpenAI, Anthropic, and Google configuration, selection, credentials, models, verification, routing, failures, tests, and extensions.
tags:
  - agent
  - configuration
  - providers
  - credentials
  - models
  - requirements
related:
  - ./runtime.md
  - ./provider-streaming.md
  - ../mobile/local-state-and-backup.md
  - ../mobile/diet-and-food-estimation.md
  - ../services/anthropic-proxy.md
  - ../operations/build-release-and-testing.md
---

# Configuración de proveedores

Esta página satisface **RQ-01** al cubrir el ámbito canónico completo de la configuración de proveedores: tipos y valores predeterminados de proveedores/modelos; estado persistido frente a editable; selección y alternativas para el chat y el estimador de alimentos; normalización y compatibilidad con el razonamiento de OpenAI; descubrimiento y filtrado de modelos; estados de verificación y gravedad; ciclo de vida de guardado, eliminación y restablecimiento; persistencia de credenciales; precedencia del entorno y de la URL base; enrutamiento web/nativo; comportamiento de los consumidores; fallos parciales; pruebas; y superficies de extensión. Los aspectos internos del protocolo de streaming permanecen en [Streaming de proveedores](./provider-streaming.md), mientras que el comportamiento de las herramientas permanece en [Entorno de ejecución del agente](./runtime.md).

La aplicación admite exactamente `Provider = "anthropic" | "openai" | "google"`. `ProviderConfiguration` es `{provider, is_active, api_key, model, workspace_id?, reasoning_effort?}`; `App.tsx` conserva el alias histórico `AIKey` para ese tipo. `ProviderDraft` es exclusivo de la IU y contiene los campos editables. La normalización, la máquina de revisiones, la persistencia y la verificación ya no pertenecen al componente monolítico: viven en módulos deterministas bajo `apps/mobile/agent/`.

## Modelo de configuración y propiedad

| Aspecto | Símbolos exactos | Comportamiento canónico |
|---|---|---|
| Universo de proveedores | `Provider`, `PROVIDERS` | El orden de los auxiliares de IU/persistencia es OpenAI, Anthropic y Google. |
| Valores predeterminados | `DEFAULT_MODELS`, `createDefaultProviderKeys` | OpenAI `gpt-5-mini` activo de forma predeterminada; Anthropic `claude-3-5-sonnet-latest`; Google `gemini-3.6-flash`; todas las claves vacías. |
| Estado guardado | `ProviderConfigurationRepository`, `LocalStore.keys`, `chatProvider?`, `foodAIProvider?` | El repositorio versionado es la autoridad duradera para los tres registros; `LocalStore.keys` es su reflejo en memoria para los consumidores. |
| Estado editable | `providerDraftByProvider`, `createProviderDraftMap`, `updateProviderDraft` | Los cambios no se convierten en credenciales para los consumidores hasta que se guardan correctamente, salvo la eliminación mediante el guardado de un valor vacío. |
| Orden de operaciones | `ProviderOperationMap`, `ProviderSaveToken`, `ProviderDiscoveryToken` | Revisiones separadas de borrador, guardado y descubrimiento impiden que respuestas antiguas confirmen o muestren datos obsoletos. |
| Estado de verificación | `ProviderConnectionStatus`, `providerConnectionStatus` | Estado efímero de la IU: `connected`, `disconnected`, `checking`, `unknown`, además de gravedad/detalle. No se conserva ni se reconstruye como éxito tras reiniciar. |
| Resolutor del chat | memo `activeProvider` | El `chatProvider` configurado preferido; de lo contrario, el primer registro con una clave; de lo contrario, `store.keys[0]`. |
| Resolutor del estimador | `resolveFoodEstimatorProvider`, `resolveFoodEstimatorProviderFromState` | El `foodAIProvider` configurado preferido cuando corresponda; prioridad alternativa Google → OpenAI → Anthropic. |
| Resolutor genérico de minichat | `resolveProviderByPriority`, `MiniChat` | El proveedor preferido si tiene clave; de lo contrario, la prioridad indicada por el llamador, usando de forma predeterminada la prioridad del estimador. |
| Almacenamiento de configuración | `ProviderConfigurationRepository` | Diario `committed`/`pending` bajo `gymnasia.mobile.v4.provider_configuration` en SecureStore nativo; espejo saneado en AsyncStorage. En web, el diario completo vive en `gymnasia.mobile.provider_configuration.v1`. |
| URL base web de Anthropic | `resolveWebApiBaseUrl`, `buildWebProxyUrl` | Recorta `EXPO_PUBLIC_API_BASE_URL`; si no existe, usa el valor predeterminado vacío; elimina las barras diagonales finales y, a continuación, añade la ruta. |

`is_active` indica el proveedor preferido del chat dentro del registro canónico. `selectChatProvider` confirma primero esa selección en el repositorio y solo después publica `chatProvider` y `store.keys`; si la escritura falla, el proveedor anterior continúa activo. `normalizeProviderConfigurations` repara el invariante de exactamente un elemento activo y la hidratación deriva `chatProvider` de ese commit.

## Invariantes de hidratación y normalización

`normalizeStore(raw)` normaliza el agregado general, mientras que `normalizeProviderConfigurations(values)` reconstruye exactamente una entrada para cada proveedor compatible y en orden. Recorta las claves, completa los modelos, normaliza el workspace y el esfuerzo de OpenAI y conserva exactamente un `is_active`. Si ninguno está activo, OpenAI pasa a estarlo; si hay varios, solo permanece activo el primero. Un `foodAIProvider` ausente usa Google de forma predeterminada.

`normalizeProviderModel(provider, rawModel)` recorta un modelo y, si está vacío, usa `DEFAULT_MODELS[provider]`. También migra estos valores predeterminados heredados exactos:

- OpenAI `gpt-4o-mini` → `gpt-5-mini`
- Google `gemini-1.5-flash` o `gemini-3-flash-preview` → `gemini-3.6-flash`

Los ID de modelos arbitrarios indicados por el usuario se conservan en los demás casos. No se comprueba ninguna lista de permitidos durante la persistencia.

`serializeStoreForAsyncStorage` elimina siempre las claves de `STORAGE_KEY = gymnasia.mobile.local.v3`, también en web y en el espejo de desarrollo. La configuración se confirma por separado mediante `ProviderConfigurationRepository`:

- en móvil, SecureStore contiene el diario completo y AsyncStorage solo un espejo sin `api_key`;
- en web, el diario completo queda en AsyncStorage porque no existe SecureStore;
- durante la primera hidratación, el repositorio migra el antiguo agregado y las claves individuales `gymnasia.mobile.v3.provider.api_key.{provider}`; estas últimas solo se eliminan tras confirmar la nueva copia;
- un `pending` superviviente nunca se promociona al arrancar: se restaura el último `committed`.

La ausencia de SecureStore en una plataforma nativa no provoca una degradación a texto plano: la configuración anterior puede usarse en memoria durante esa sesión, pero un guardado nuevo falla de forma visible y no sustituye la copia anterior. Consulte [Estado local y copia de seguridad](../mobile/local-state-and-backup.md).

## Semántica de selección y alternativas

### Chat principal

El memo `activeProvider` busca primero un `store.chatProvider` con una clave no vacía. Si está ausente o sin configurar, toma el primer registro con clave de `store.keys` (normalmente en el orden normalizado OpenAI, Anthropic, Google). Si no existe ninguna clave, devuelve `store.keys[0]`, lo que hace que `sendMessage` informe de que falta la clave de ese proveedor en lugar de indicar que «no hay proveedor». Un proveedor seleccionado que falle en el momento de la solicitud **no** cambia automáticamente a otro proveedor.

### Estimador de alimentos y minichat

`FOOD_ESTIMATOR_PROVIDER_PRIORITY` es Google, OpenAI, Anthropic. `resolveFoodEstimatorProvider` y `resolveProviderByPriority` omiten las claves ausentes o vacías, recortan la clave elegida y normalizan su modelo. Las rutas específicas del estado del estimador de alimentos respetan primero `foodAIProvider` cuando tiene una clave y, después, recurren a la prioridad. De forma similar, `MiniChat` respeta `preferredProvider`, después una prioridad proporcionada y, por último, la prioridad del estimador. Consulte [Dieta y estimación de alimentos](../mobile/diet-and-food-estimation.md) para conocer el comportamiento de imágenes, códigos de barras y resultados estructurados.

### Invariantes del proveedor activo

- Los registros de proveedores deben ser únicos y estar completos después de `normalizeStore`.
- Exactamente un `is_active` sobrevive a la normalización, pero `chatProvider` y `foodAIProvider` pueden apuntar a proveedores diferentes.
- La selección solo requiere una clave guardada no vacía, no un estado actualmente «conectado». El estado de verificación es efímero y los resolutores no lo consultan.
- Un fallo de verificación deja intacto el registro del proveedor guardado previamente, mientras conserva los valores fallidos en el borrador para su corrección.

## Ciclo de vida de borrador, descubrimiento, verificación y guardado

```mermaid
stateDiagram-v2
    [*] --> NoKey
    NoKey --> Dirty: edit nonblank key model or effort
    Dirty --> Checking: press Save
    Checking --> Persisting: verification succeeds
    Checking --> Disconnected: verification fails
    Persisting --> Connected: durable commit succeeds
    Persisting --> SaveFailed: durable commit fails
    Disconnected --> Dirty: edit draft
    Connected --> Dirty: edit draft
    SaveFailed --> Dirty: edit or retry
    Dirty --> Persisting: save blank key
    Persisting --> NoKey: blank-key commit succeeds
    Connected --> Persisting: confirm delete
```

*Leyenda: El estado efímero de conexión sigue las ediciones del borrador y la verificación; solo una verificación correcta confirma una credencial no vacía.*

`createProviderConnectionStatusMap` inicializa los proveedores con clave como `unknown`/advertencia («verificación pendiente») y los proveedores vacíos como `disconnected`/advertencia («guarde una clave de API»). No vuelve a verificar durante la hidratación.

`updateProviderDraft(provider, updates)`:

1. actualiza únicamente el mapa de borradores;
2. vuelve a normalizar el esfuerzo de OpenAI con respecto al modelo previsto;
3. cuando cambia la clave, cierra y borra el menú desplegable, las opciones y el filtro de modelos de ese proveedor;
4. incrementa `draftRevision`, invalida el guardado y descubrimiento anteriores, y marca el borrador como cambio sin guardar.

Abrir un menú desplegable de modelos requiere una clave de **borrador** no vacía e inicia el descubrimiento con un `ProviderDiscoveryToken`. Solo la respuesta cuya revisión de borrador y descubrimiento sigue vigente puede publicar opciones, errores o finalizar el indicador de carga. Seleccionar un modelo actualiza únicamente el borrador. La selección de OpenAI también normaliza el esfuerzo para el nuevo modelo.

`saveProviderApiKey(provider)` normaliza un candidato y obtiene un `ProviderSaveToken`. Sus ramas son:

- **Clave normalizada vacía:** omite la red y pide al repositorio confirmar la eliminación. La configuración anterior sigue activa hasta que el commit termina.
- **Clave no vacía:** verifica primero y solo llama a `persistProviderCandidate` si `check.ok` es verdadero. La confirmación activa el proveedor únicamente después de escribir el commit duradero.
- **Respuesta antigua:** si el usuario editó el borrador o inició otro guardado, el token deja de ser actual. Su verificación no cambia estado ni persistencia; si ya había empezado una escritura, el repositorio restaura el commit anterior.
- **Fallo de persistencia:** conserva el commit y proveedor anterior, mantiene el borrador para reintentar y muestra explícitamente que el guardado no se aplicó.

`openDeleteProviderApiKeyModal` enmascara la clave **persistida** y solo se abre cuando existe una. `confirmDeleteProviderApiKey` construye un candidato vacío y pasa por el mismo commit versionado; un fallo deja la clave anterior activa. «Borrar actividad y conversaciones» conserva el diario y la selección. «Borrar todos mis datos» elimina y verifica el diario nuevo, su espejo web/nativo y los prefijos heredados antes de remontar el runtime; si SecureStore no está disponible en móvil, el informe queda incompleto en vez de afirmar que las credenciales desaparecieron.

## Matriz de verificación

| Proveedor | Solicitud de verificación | Comportamiento de éxito/advertencia |
|---|---|---|
| OpenAI | `GET https://api.openai.com/v1/models` con clave de portador | Cualquier respuesta 2xx es correcta; no se verifica el modelo seleccionado. |
| Anthropic nativo | `POST /v1/messages` con el modelo seleccionado, `max_tokens: 1` y un ping | Una respuesta 2xx es correcta. HTTP 404 se trata como `ok: true`, con gravedad `warning`: la clave se ha verificado, pero el modelo no está disponible. Otros códigos distintos de 2xx son errores. |
| Anthropic web | `POST {base}/chat/providers/anthropic/verify` con clave/modelo | `{ok:false}` del proxy es un error. `{ok:true}` es correcto, salvo que el mensaje contenga `modelo no disponible`, en cuyo caso se convierte en advertencia. |
| Google | `GET .../v1beta/models/{model}` con `x-goog-api-key` | Una respuesta 2xx es correcta; una distinta de 2xx es un error. La clave no aparece en la URL. |

`verifyProviderConnection` delega en `verifyProviderConfiguration` y devuelve `{ok, message, severity}`. Las claves ausentes devuelven una advertencia sin red. Todas las solicitudes de verificación y descubrimiento pasan por `fetchProviderConfiguration`, que las aborta a los 15 segundos y devuelve un error legible. Una advertencia con `ok: true` se puede confirmar y mostrar como conectada.

El estado de conexión es orientativo: se vuelve a crear después de recargar y no impide las llamadas del chat o del estimador. A la inversa, el descubrimiento correcto de la lista de modelos no establece el estado conectado ni guarda nada.

## Descubrimiento y filtrado de modelos

| Proveedor | Símbolo/ruta de descubrimiento | Notas de análisis/filtrado |
|---|---|---|
| OpenAI | `fetchOpenAIModelsDirect` → `GET /v1/models` | `parseOpenAIModelOptions`; el filtro de la IU busca coincidencias en `id` en minúsculas más `owned_by`. |
| Anthropic nativo | `fetchAnthropicModelsDirect` → `GET /v1/models` | Envía `x-api-key` y `anthropic-version`. |
| Anthropic web | `fetchAnthropicModelsViaWebProxy` → `/chat/providers/anthropic/models` | Envía la clave en el cuerpo POST; un fallo de obtención se convierte en instrucciones que indican que se requiere el proxy. El filtro de la IU busca coincidencias en `id` más `display_name`. |
| Google | `fetchGoogleModelsDirect` → `GET /v1beta/models` con `x-goog-api-key` | El analizador elimina el prefijo `models/`, quita duplicados, ordena y excluye las entradas cuya lista no vacía de métodos de generación no contenga `generateContent`; el filtro de la IU busca coincidencias en `id` más el nombre para mostrar. |

Una lista vacía es una advertencia; un fallo de solicitud o análisis borra las opciones y muestra un error. El texto del modelo continúa siendo editable manualmente, por lo que el descubrimiento es una ayuda y no una lista de permitidos. Cambiar una clave del borrador invalida las opciones almacenadas en caché para evitar mostrar modelos autorizados por una clave anterior.

## Compatibilidad con el esfuerzo de razonamiento de OpenAI

`getSupportedOpenAIReasoningEfforts(model)` y `normalizeOpenAIReasoningEffort(effort, model)` constituyen la política canónica de compatibilidad:

| Prefijo del modelo normalizado | Esfuerzos permitidos |
|---|---|
| `gpt-5.4-pro` | medium, high, xhigh |
| `gpt-5-pro` | high |
| `gpt-5.4`, `gpt-5.3`, `gpt-5.2` | none, low, medium, high, xhigh |
| `gpt-5.1` | none, low, medium, high |
| otros `gpt-5` | minimal, low, medium, high |
| `o...` | low, medium, high |
| otros modelos | sin configuración de razonamiento |

La normalización conserva un valor proporcionado que sea compatible; de lo contrario, prefiere `DEFAULT_OPENAI_REASONING_EFFORT = medium`, después el primer valor compatible, y devuelve null cuando la familia de modelos no tiene ninguna política. `buildOpenAIReasoningConfig` usa esta configuración normalizada para las llamadas de OpenAI y solicita el modo de resumen `detailed`. Por tanto, las ediciones del modelo pueden cambiar silenciosamente un esfuerzo incompatible al valor predeterminado de la política. El comportamiento de razonamiento de Anthropic y Google está fijado en las cargas útiles de transporte y no se puede configurar aquí; consulte [Streaming de proveedores](./provider-streaming.md).

## URL base, plataforma y límites de confianza

`resolveWebApiBaseUrl()` lee `globalThis.process?.env?.EXPO_PUBLIC_API_BASE_URL`, recorta el valor, recurre a `DEFAULT_WEB_API_BASE_URL = ""` y elimina las barras diagonales finales. `buildWebProxyUrl(path)` devuelve una URL absoluta configurada o la ruta relativa sin cambios. La versión web de producción es estática y, deliberadamente, no tiene un valor predeterminado de localhost.

Solo el descubrimiento de modelos, la verificación y los mensajes de Anthropic en el navegador usan este proxy, porque las llamadas directas desde el navegador se enfrentan a CORS. Anthropic nativo llama directamente al proveedor. OpenAI y Google llaman directamente a los proveedores en ambas plataformas. Por tanto, todas las claves de API propiedad del usuario terminan saliendo de la aplicación: las de OpenAI/Google van directamente a los proveedores, la de Anthropic nativo va directamente a Anthropic y la de Anthropic en el navegador va primero al proxy configurado. El proxy recibe la clave en el cuerpo de la solicitud; sus restricciones de despliegue y de seguridad/CORS están documentadas en [Proxy de Anthropic](../services/anthropic-proxy.md).

La URL base es una configuración del entorno de compilación/tiempo de ejecución, no se almacena en `LocalStore` ni se puede editar en la configuración de proveedores. Si no hay ninguna base configurada, Anthropic en el navegador usa la ruta relativa `/chat/providers/anthropic/...`; en un host estático sin esas rutas, falla y muestra `ANTHROPIC_WEB_PROXY_REQUIRED_MESSAGE`.

## Comportamiento ante fallos y confirmaciones parciales

| Situación | Registro guardado | Borrador/estado | Consecuencia para el consumidor |
|---|---|---|---|
| Edición sin guardar | sin cambios | advertencia pendiente | Los consumidores continúan usando los valores guardados anteriores. |
| Respuesta de descubrimiento antigua | sin cambios | se descarta sin tocar opciones ni carga actual | Una clave anterior no puede volver a mostrar modelos autorizados para ella. |
| Fallo del descubrimiento actual | sin cambios | opciones borradas, error de descubrimiento | La edición manual del modelo y el guardado siguen siendo posibles. |
| Fallo o timeout de verificación | sin cambios | borrador fallido conservado, error de desconexión | El proveedor y la clave confirmados anteriormente siguen activos. |
| Modelo de Anthropic con 404 y clave válida | nuevos valores confirmados | conectado con advertencia | Las solicitudes aún pueden fallar con el modelo seleccionado no disponible. |
| Guardado vacío | clave eliminada; modelo/esfuerzo normalizados y guardados | advertencia de desconexión | El resolutor lo omite y puede recurrir a una alternativa. |
| Escritura pendiente interrumpida | se conserva `committed`; `pending` no se activa | al reiniciar aparece la configuración anterior | La recuperación nunca adivina que una escritura parcial terminó. |
| SecureStore/AsyncStorage falla al confirmar | se restaura el commit anterior | error de guardado y borrador reintentable | La IU no publica como activa una configuración que no quedó duradera. |
| Respuesta antigua de verificación | sin cambios | se descarta | Un guardado posterior gana incluso si su red respondió antes. |
| Recarga de la aplicación después de un resultado correcto | valores hidratados/normalizados | el estado vuelve a una advertencia desconocida | El proveedor se puede seguir seleccionando porque el estado no actúa como barrera. |
| Fallo de la solicitud del proveedor seleccionado | sin cambios | el estado de conexión no baja de categoría automáticamente | No hay cambio de proveedor en tiempo de ejecución. |

El repositorio no convierte AsyncStorage y SecureStore en una transacción física, pero sí establece un marcador canónico: escribe `pending`, comprueba que el token siga vigente y solo entonces escribe `committed`. En móvil el registro seguro se escribe al final; si cualquier paso falla o el token queda obsoleto, intenta restaurar el commit anterior. La cola interna serializa guardados concurrentes y los actualizadores funcionales parten siempre de la última configuración confirmada.

## Pruebas y comandos específicos

La superficie tiene tres conjuntos unitarios específicos:

- `providerConfiguration.test.ts`: normalización, razonamiento, proveedor activo, revisiones de guardado/descubrimiento y propiedades con `fast-check`;
- `providerConfigurationPersistence.test.ts`: migración, diario web/nativo, espejo sin secretos, fallo de escritura final, recuperación de `pending`, invalidación y commits concurrentes;
- `providerVerification.test.ts`: éxito, 401, 404 de Anthropic, proxy web, cabeceras sin clave en URL, fixture local y timeout.

`scripts/agent-chat.e2e.mjs` añade el ciclo BYOK completo: rechazo, alta, uso en chat, dos rotaciones solapadas con respuesta antigua tardía, comprobación del commit, reinicio con estado «pendiente de comprobar», reutilización de la clave rotada y borrado sin filtrarla a trazas o cuerpos de chat.

Use comprobaciones específicas estáticas, de tipos y de compilación al modificar esta superficie monolítica de `App.tsx`:

```bash
npm --workspace apps/mobile run test:deterministic
npm --workspace apps/mobile run build:web
npm run test:agent:e2e
npm run check:data-inventory
npm run test:data-inventory
```

Para un cambio de enrutamiento de Anthropic en el navegador, ejecute la aplicación con una URL base explícita y el proxy por separado; no incluya ningún secreto en el comando ni en el repositorio:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm --workspace apps/mobile run web
python apps/anthropic_proxy/cors-proxy.py
```

El segundo comando refleja el punto de entrada del código fuente; instale los requisitos del proxy según [Proxy de Anthropic](../services/anthropic-proxy.md). Ejecute el flujo explícito del agente en el navegador únicamente con las credenciales y el entorno locales adecuados:

```bash
npm run test:agent:e2e
```

## Superficie de cambios para extensiones

### Añadir una regla de familia de modelos

1. Actualice `DEFAULT_MODELS` o las constantes heredadas solo si se pretende realizar una migración.
2. Actualice `normalizeProviderModel` y, para OpenAI, `getSupportedOpenAIReasoningEfforts`/`normalizeOpenAIReasoningEffort`, además de las opciones de configuración.
3. Compruebe que los constructores de solicitudes para el chat ordinario, el chat con herramientas y la estimación de alimentos llamen todos a la normalización.
4. Amplíe `providerConfiguration.test.ts` con la compatibilidad nueva y sus propiedades.

### Añadir o cambiar el comportamiento de configuración de proveedores

1. Amplíe conjuntamente `Provider`, `ProviderConfiguration`, `ProviderDraft`, `PROVIDERS`, `DEFAULT_MODELS`, `PROVIDER_UI_META`, los constructores normalizados y `normalizeStore`.
2. Amplíe el diario de `ProviderConfigurationRepository`, su saneamiento y migración. Decida si el proveedor puede usar de forma segura solicitudes directas desde el navegador.
3. Implemente el análisis del descubrimiento de modelos, el estado del menú desplegable/filtro, la verificación, las ramas de guardado/eliminación/restablecimiento y la IU de selección.
4. Actualice deliberadamente los resolutores del chat, del minichat y del estimador de alimentos; la prioridad de proveedores es una decisión de producto, no una consecuencia incidental del orden de una matriz.
5. Añada todas las cargas útiles de solicitudes y las asignaciones de analizadores/bucles/declaraciones de herramientas de streaming descritas en [Streaming de proveedores](./provider-streaming.md) y [Entorno de ejecución del agente](./runtime.md).
6. Si se requiere un proxy, añada sus rutas/configuración y documente los límites de confianza/despliegue. Mantenga explícitos la precedencia de `EXPO_PUBLIC_API_BASE_URL` y el comportamiento de la web estática.
7. Pruebe la normalización, la migración heredada, el invariante de un único elemento activo, la alternativa del proveedor preferido, el guardado vacío, la verificación fallida/correcta/con advertencia, los guardados superpuestos, el filtrado de descubrimiento, las rutas con SecureStore disponible/no disponible y el enrutamiento tanto web como nativo.

### Lista de comprobación para RQ-01

- Las selecciones de proveedores y consumidores permanecen independientes y normalizadas.
- Las credenciales vacías nunca pasan por los resolutores; el agregado general nunca conserva secretos y el espejo nativo de AsyncStorage está saneado.
- Las ediciones de borradores no pueden convertirse silenciosamente en credenciales no vacías guardadas sin una verificación correcta.
- La advertencia con resultado correcto (modelo de Anthropic no disponible) continúa diferenciándose de un fallo grave.
- Los modelos manuales siguen siendo utilizables cuando falla el descubrimiento.
- Todos los consumidores de proveedores comparten la normalización de modelos y configuraciones de razonamiento compatibles.
- Anthropic en el navegador tiene una base de proxy explícita y ningún valor predeterminado accidental de localhost en producción.
- Los resultados de los fallos de verificación, los fallos de persistencia, las recargas y los fallos de solicitudes en tiempo de ejecución están documentados y probados.
- Ninguna respuesta de verificación o descubrimiento cuya revisión haya caducado puede publicar estado ni persistencia.
