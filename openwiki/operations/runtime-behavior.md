---
type: observabilidad de runtime
title: Comportamiento en ejecución y oportunidades
description: Complemento operativo para interpretar una instantánea LangSmith del agente móvil sin exponer contenido de runs. Distingue los agregados volátiles de la muestra de los límites, rutas y fallos del código que orientan cambios seguros.
tags: [runtime, observability, langsmith, mobile, agent, tools]
sources:
  - id: openwiki-source-0c30fc96b9e7c8b57c35473c
    resource: repo://apps/mobile/agent/agentPolicyRuntime.ts
  - id: openwiki-source-dc42304b20e8518ef65b4b63
    resource: repo://apps/mobile/agent/googleContextBudget.ts
  - id: openwiki-source-63dae4a27346d91c6139697b
    resource: repo://apps/mobile/agent/googleInteractions.test.ts
  - id: openwiki-source-f310c5fb576ae69a7753918c
    resource: repo://apps/mobile/agent/googleStreamTransport.ts
  - id: openwiki-source-b14a4ecd65e83b5561f88e2a
    resource: repo://apps/mobile/agent/providerToolLoop.ts
  - id: openwiki-source-d3be928c369037f29888bc0b
    resource: repo://apps/mobile/agent/toolExecutor.ts
  - id: openwiki-source-d8ad30beb46f5e7dc1ced4cf
    resource: repo://apps/mobile/agent/toolOperationLedger.test.ts
  - id: openwiki-source-9e7ddd51c09caf628a81acad
    resource: repo://apps/mobile/agent/toolOperationLedger.ts
  - id: openwiki-source-929e8e1df23628a3f3848ff8
    resource: repo://apps/mobile/App.tsx
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T17:43:05.548Z
generated: { by: "openwiki/0.6.0", at: "2026-09-27T17:43:05.548Z" }
---

# Comportamiento en ejecución y oportunidades

Esta página es el complemento operativo del chat de `apps/mobile`: usa una instantánea LangSmith cuando está disponible para decidir qué rutas merecen atención antes de cambiar el agente. No sustituye la especificación de configuración, streaming o herramientas: véanse [Configuración BYOK de proveedores](../agent/provider-configuration.md), [Streaming de proveedores](../agent/provider-streaming.md), [Runtime del agente y herramientas](../agent/runtime.md) y [Entrega de políticas](../architecture/policy-delivery.md).

## Alcance, privacidad y lectura de la muestra

La configuración declara los proyectos LangSmith `gymnasia-app-agent`, `gymnasia-food-agent` y `openwiki` en el endpoint europeo. La extracción de esta actualización no aporta un dump de runs legible en el árbol de trabajo; por ello no se inventan llamadas, latencias, tokens, costes, errores, outliers ni repeticiones. La configuración por sí sola no demuestra tráfico.

Cuando exista una extracción autorizada, registre aquí únicamente agregados: ventana y filtros, conteos de roots y llamadas, ruta o proveedor, mediana de latencia por ruta/tool, tokens de entrada y salida, coste si existe, y repeticiones por `executionId`, tool y ocurrencia. Nunca copie prompts, entradas, salidas, argumentos, resultados de tools, razonamiento ni identificadores que permitan reconstruir el contenido de un run; ese contenido es evidencia no confiable.

Los buckets `error`, `outlier` y `baseline` son una **muestra sesgada**: los dos primeros se seleccionan por anomalía y `baseline` por normalidad reciente. Sus conteos no son tasas de flota ni prueban causalidad. Las medianas de `baseline` son solo una referencia de operación normal de esa muestra. Las métricas de una extracción son volátiles; los mecanismos y límites correlacionados con código permanecen como prosa durable.

### Observado en esta extracción

No hay observaciones cuantitativas publicables: llamadas, latencias, tokens, costes, repeticiones y composición de buckets permanecen no disponibles. En consecuencia, tampoco se atribuyen fallos a un proveedor, una tool o un símbolo.

### Correlacionado con archivo y símbolo

Estos mecanismos no son mediciones de producción; son puntos concretos contra los que contrastar una futura muestra.

- **Política congelada por turno — `acquireAgentPolicyLease`.** `sendMessage` adquiere el lease antes de clasificar el input y de construir el prompt. El lease se congela profundamente e incluye prompt, política sanitaria, contexto y estado. En canal firmado, una política sanitaria que no puede fusionarse con el contrato móvil aborta antes de ser usada. No combine datos de leases distintos al cambiar el envío o la telemetría de un turno.
- **Bloqueo antes de red y antes de efectos — `callProviderChatAPIWithTools`.** Un riesgo sanitario bloqueante evita la llamada al proveedor. Para cada solicitud de tool, la función reclasifica nombre y argumentos, rechaza tools desconocidas o incompatibles y devuelve un resultado bloqueado en vez de delegar al ejecutor. Esto separa un eventual error de proveedor de un bloqueo local al analizar un bucket `error`.
- **Reintento visible no equivale a efecto repetido — `sendMessage`.** La ruta conversacional hace hasta tres intentos únicamente ante firmas de transporte/sobrecarga reconocidas, con esperas de 2 y 4 segundos; reinicia el borrador entre intentos y agrupa su actualización visible a 40 ms. Una muestra con más de una llamada por mensaje debe separar estos intentos de las continuaciones de tools y de una mutación local.
- **Rondas de tools — `runOpenAIToolLoop`, `runAnthropicToolLoop` y `runGoogleToolLoop`.** Las calls de una ronda se esperan secuencialmente y el valor predeterminado es diez rondas. Si quedan calls, los tres loops las responden como no ejecutadas y solicitan un turno final con tools prohibidas; si ese cierre falla, se corta o vuelve a pedir tools, lanzan `ToolRoundLimitError`. OpenAI exige `responseId` para continuar; Google también rechaza un `function_call` ID reutilizado entre rondas. Mida continuaciones y cierres antes de atribuir una latencia alta a un handler individual.
- **Presupuesto efectivo de contexto Google — `prepareGoogleInteractionRequest`.** Aunque `App` entrega a Google el historial reconstruido completo, el preparador conserva como máximo los diez intercambios más recientes, elimina bytes de imágenes antiguas y descarta intercambios completos adicionales hasta respetar 512 KiB no-imagen y 19 MB de petición. Si incluso el último intercambio excede el presupuesto, rechaza antes de abrir la red; el reporte agregado contiene contadores y razones, no contenido. `requestGoogleInteraction` emite ese reporte sin dejar que la instrumentación bloquee la petición.
- **Semántica de commit — `createDetailedAgentToolExecutor`.** Un handler solo produce `committed` si llama a `markEffectCommitted`; una excepción se transforma en resultado para el loop y conserva `committed` solo si ya se marcó. Los estados `no_effect` y `failed_before_commit` no se memorizan como escritura.
- **Idempotencia y recuperación — `ToolOperationCoordinator`.** Para una tool con efecto, su identidad incluye versión, `executionId`, proveedor, nombre, argumentos JSON canónicos y ocurrencia, pero no `providerCallId`. El coordinador une trabajo simultáneo, reproduce commits desde memoria o ledger y prepara el ledger antes de ejecutar. Tras un fallo de escritura del commit intenta reconciliar el recibo de dominio; si no puede establecer el resultado, persiste o devuelve `indeterminate` para evitar una repetición insegura. Al hidratar la aplicación también reconcilia entradas no resueltas. El ledger conserva commits siete días y acota el conjunto a 256 entradas, sin descartar entradas no resueltas para cumplir el límite.

### Hipótesis de diagnóstico

1. **Coste, tokens o latencia altos:** primero agrupar por proveedor, tamaño de historial efectivo, número de rondas y turno de cierre. Para Google, incluir las razones y contadores de `GoogleContextReport`; no asumir que el historial local completo fue enviado.
2. **Múltiples requests para un mensaje:** separar reintento de transporte, evaluación sanitaria consentida, continuación de tools y fallback de streaming Google antes de modificar deduplicación o UX.
3. **Tool repetida con un solo efecto:** contrastar `executionId`, nombre, argumentos canónicos y ocurrencia; determinar si fue unión `inFlight`, replay, reconciliación o una segunda operación intencional.
4. **Error después de una escritura:** comprobar el estado del recibo de dominio y la reconciliación. Un `indeterminate` es una protección contra duplicación, no evidencia de rollback.

## Hallazgos y oportunidades de runtime

1. **Prioridad alta — instrumentar y revisar los límites de contexto Google antes de elevar presupuestos.** **Observado:** no hay muestra que indique cuántas peticiones se recortan o rechazan. **Correlacionado:** `prepareGoogleInteractionRequest` ya produce `GoogleContextReport` con contadores y razones y `recordGoogleContextReport` lo traza sin contenido. **Hipótesis:** una futura concentración de `exchange_limit`, `non_image_bytes` o `request_bytes` señalará pérdida de contexto o fricción con imágenes, no necesariamente lentitud del proveedor. **Consecuencia operativa:** al cambiar historial, tools o adjuntos, preserve esos agregados y pruebe rechazo previo a red; no aumente 19 MB o 512 KiB basándose solo en una traza lenta.

2. **Prioridad media — no tratar una repetición remota como permiso para repetir un efecto.** **Observado:** no hay repetición medida en esta extracción. **Correlacionado:** `ToolOperationCoordinator.execute` deduplica efectos, prepara persistentemente y reconcilia incertidumbre; `sendMessage` puede reintentar transporte. **Hipótesis:** una repetición de llamada remota con igual identidad debería acabar como unión, replay o resultado indeterminado. **Consecuencia operativa:** al añadir una tool de escritura, implemente su reconciliador/recibo de dominio y marque el commit inmediatamente tras el efecto irreversible; no use `providerCallId` como identidad.

## Cambios seguros y validación focalizada

1. Mantenga un único `AgentPolicyLease` inmutable por turno: no mezcle prompt, guardrail y `PolicyContext` de selecciones diferentes.
2. Al añadir una tool, mantenga validación previa al efecto, `markEffectCommitted` justo después de la mutación irreversible y una estrategia de reconciliación para sus entradas `prepared` o `indeterminate`.
3. No elimine `occurrence` ni introduzca `providerCallId` en la identidad: la ocurrencia distingue calls iguales intencionales y el ID remoto puede cambiar en un reintento.
4. Para Google, trate `GoogleContextReport` como instrumentación segura de presupuesto: almacene solo sus contadores y razones. Conserve la preservación del último intercambio y pares de tool completos.
5. Instrumente agregados de proveedor, ruta, estado, duración, rondas, cierre y estado de commit, nunca contenido sensible ni razonamiento.

Ejecute desde la raíz:

```bash
npx vitest run --config apps/mobile/vitest.config.mts apps/mobile/agent/agentPolicyRuntime.test.ts apps/mobile/agent/googleInteractions.test.ts apps/mobile/agent/providerToolClient.test.ts apps/mobile/agent/providerToolLoop.test.ts apps/mobile/agent/providerPipeline.test.ts apps/mobile/agent/toolExecutor.test.ts apps/mobile/agent/toolOperationLedger.test.ts
```

Estas pruebas verifican límites, contratos de continuación, semántica de commit, reconciliación e idempotencia local; no establecen disponibilidad, coste ni latencia de proveedores remotos. Para cambios del recorrido visible, añada `npm run test:agent:e2e` como indica el [Inicio rápido](../quickstart.md).
