---
type: observabilidad de runtime
title: Comportamiento en ejecución y oportunidades
description: Complemento operativo para interpretar una instantánea LangSmith del agente móvil sin exponer contenido de runs. Separa los agregados volátiles de la muestra de los límites, rutas y fallos del código que orientan cambios seguros.
tags: [runtime, observability, langsmith, mobile, agent, tools]
sources:
  - id: openwiki-source-0c30fc96b9e7c8b57c35473c
    resource: repo://apps/mobile/agent/agentPolicyRuntime.ts
  - id: openwiki-source-dc42304b20e8518ef65b4b63
    resource: repo://apps/mobile/agent/googleContextBudget.ts
  - id: openwiki-source-f310c5fb576ae69a7753918c
    resource: repo://apps/mobile/agent/googleStreamTransport.ts
  - id: openwiki-source-592c302a01c2b134e66ce8f9
    resource: repo://apps/mobile/agent/providerToolLoop.test.ts
  - id: openwiki-source-b14a4ecd65e83b5561f88e2a
    resource: repo://apps/mobile/agent/providerToolLoop.ts
  - id: openwiki-source-31ab0914f32f6c759ba493a0
    resource: repo://apps/mobile/agent/streamDraftFlusher.ts
  - id: openwiki-source-1ad5b6a5e6488611c8796fe1
    resource: repo://apps/mobile/agent/toolBatch.ts
  - id: openwiki-source-d3be928c369037f29888bc0b
    resource: repo://apps/mobile/agent/toolExecutor.ts
  - id: openwiki-source-d8ad30beb46f5e7dc1ced4cf
    resource: repo://apps/mobile/agent/toolOperationLedger.test.ts
  - id: openwiki-source-9e7ddd51c09caf628a81acad
    resource: repo://apps/mobile/agent/toolOperationLedger.ts
  - id: openwiki-source-929e8e1df23628a3f3848ff8
    resource: repo://apps/mobile/App.tsx
generated: { by: "openwiki/0.6.0", at: "2026-10-10T14:02:47.335Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-10-10T14:02:47.335Z
---

# Comportamiento en ejecución y oportunidades

Esta página complementa operacionalmente el chat de `apps/mobile`. Conecta una instantánea autorizada de LangSmith con los límites y rutas que realmente gobiernan el agente, pero no reemplaza [Configuración BYOK de proveedores](../agent/provider-configuration.md), [Streaming de proveedores](../agent/provider-streaming.md), [Runtime del agente y herramientas](../agent/runtime.md) ni [Entrega de políticas](../architecture/policy-delivery.md).

## Alcance, privacidad y lectura de la muestra

La configuración apunta los proyectos LangSmith `gymnasia-app-agent`, `gymnasia-food-agent` y `openwiki` al endpoint europeo. En el entorno de esta actualización no está disponible la extracción legible mediante el conector de evidencia; por tanto no se publican conteos, latencias, tokens, costes, errores, outliers ni repeticiones. La configuración no prueba tráfico.

Cuando la extracción esté disponible, registre exclusivamente agregados: ventana y filtros; conteos de roots, llamadas y buckets; proveedor/ruta/tool; medianas de latencia; tokens de entrada/salida; coste si existe; y repeticiones por `executionId`, tool y ocurrencia. Nunca copie prompts, entradas, salidas, argumentos, resultados de tools, razonamiento ni identificadores que permitan reconstruir un run.

Los buckets `error`, `outlier` y `baseline` son una **muestra sesgada**, no tasas de flota: los dos primeros se seleccionan por anomalía y `baseline` por normalidad reciente. Las medianas `baseline` solo son una referencia normal de esa extracción, y no prueban causalidad. Los números pertenecen a la extracción; los mecanismos correlacionados abajo son el contexto durable para interpretarlos.

### Observado en esta extracción

No hay métricas publicables de esta extracción: llamadas, latencias, tokens, costes, repeticiones y composición de buckets no están disponibles. En consecuencia, no se atribuyen fallos, coste ni lentitud a proveedor, tool o símbolo alguno.

### Correlacionado con archivo y símbolo

Lo siguiente es código inspeccionado, no una medición de producción.

- **Política congelada por turno — `acquireAgentPolicyLease`.** `sendMessage` adquiere el lease antes de clasificar el input y construir el prompt. No mezcle prompt, guardrail y `PolicyContext` de leases distintos al alterar el envío o su telemetría.
- **Bloqueo local antes de red y efectos — `callProviderChatAPIWithTools`.** Un riesgo sanitario bloqueante evita la llamada al proveedor. Cada tool se reclasifica por nombre y argumentos; una tool desconocida o no permitida devuelve un resultado bloqueado antes del coordinador y del ejecutor. Al investigar un `error`, diferencie este bloqueo local de un fallo remoto.
- **Reintento y renderizado — `sendMessage` y `createStreamDraftFlusher`.** El envío intenta como máximo tres veces solo ante firmas reconocidas de transporte/sobrecarga; entre reintentos espera 2 y 4 segundos y reinicia el borrador. Los deltas visibles se coalescen como máximo una vez por ventana de 40 ms. Más de una petición por mensaje puede ser un reintento, no una mutación repetida.
- **Rondas de tools — `runOpenAIToolLoop`, `runAnthropicToolLoop`, `runGoogleToolLoop` y `executeToolBatch`.** El límite por defecto es diez rondas. Dentro de una ronda, escrituras y tools desconocidas son barreras secuenciales; una secuencia contigua de lecturas conocidas puede solaparse hasta cuatro a la vez, conservando el orden de resultados. Al quedar calls pendientes, los loops las devuelven como no ejecutadas y solicitan un cierre con tools prohibidas; si el cierre falla, se corta o vuelve a pedir tools, lanzan `ToolRoundLimitError`. OpenAI reconstruye la continuación a partir del historial local incluso sin `responseId`; Google rechaza IDs de `function_call` reutilizados entre rondas.
- **Presupuesto efectivo Google — `prepareGoogleInteractionRequest`.** Aunque `App` entrega el historial reconstruido, el preparador conserva como máximo los diez intercambios más recientes, quita datos de imágenes antiguas y descarta intercambios completos adicionales hasta respetar 512 KiB no-imagen y 19 MB de petición. Si el último intercambio aún excede el presupuesto, rechaza antes de abrir la red. El `GoogleContextReport` solo contiene contadores y razones; el callback de transporte no debe bloquear la solicitud.
- **Commit y recuperación de efectos — `createDetailedAgentToolExecutor` y `ToolOperationCoordinator`.** Un handler solo queda `committed` si invoca `markEffectCommitted`; una excepción conserva ese estado únicamente si ya se marcó y se vuelve `indeterminate` si así se señaló. Para tools con efecto, la identidad deriva de versión, `executionId`, proveedor, nombre, argumentos canónicos y ocurrencia, no de `providerCallId`. El coordinador une trabajo simultáneo, reproduce commits desde memoria o ledger, persiste `prepared` antes del efecto y reconcilia un fallo al registrar el commit; si no puede demostrar el resultado, devuelve/persiste `indeterminate` para evitar una repetición insegura. Los commits duran siete días y el ledger limita a 256 entradas sin expulsar las no resueltas.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Parse error on line 9: ...utionId Guard->>Loop: request provid Expecting '+', '-', '()', 'ACTOR', got 'loop' -->
```text
sequenceDiagram
    participant Chat as sendMessage
    participant Guard as callProviderChatAPIWithTools
    participant Loop as provider tool loop
    participant Batch as executeToolBatch
    participant Coord as ToolOperationCoordinator
    participant Store as ledger and domain
    Chat->>Guard: request with executionId
    Guard->>Loop: request provider unless health block
    Loop->>Batch: calls in one round
    Batch->>Coord: writes in order and read batches
    Coord->>Store: prepare before effect
    Store-->>Coord: outcome or reconciliation
    Coord-->>Loop: committed or indeterminate
    Loop-->>Chat: final response or round limit error
```

El diagrama muestra el recorrido de una ronda con tools; las lecturas contiguas pueden ejecutarse en paralelo dentro de `Batch`, mientras las escrituras conservan la barrera de orden.

### Hipótesis de diagnóstico

1. **Coste, tokens o latencia altos:** agrupe primero por proveedor, tamaño de historial efectivo, número de rondas, cierre y mezcla lectura/escritura. Para Google, incluya únicamente razones y contadores de `GoogleContextReport`; no suponga que se envió todo el historial local.
2. **Múltiples requests para un mensaje:** separe reintento de transporte, evaluación sanitaria consentida, continuación de tools y fallback de streaming Google antes de cambiar UX o deduplicación.
3. **Tool repetida con un solo efecto:** compare `executionId`, nombre, argumentos canónicos y ocurrencia; determine si fue unión `inFlight`, replay de memoria/ledger, reconciliación o una segunda operación intencional. No infiera serialidad solo por el orden: las lecturas contiguas pueden solaparse.
4. **Error después de una escritura:** revise recibo de dominio, estado `prepared`/`indeterminate` y reconciliación. `indeterminate` protege contra duplicación; no demuestra rollback.

## Hallazgos y oportunidades de runtime

1. **Prioridad alta — instrumentar el presupuesto Google antes de elevarlo.** **Observado:** no hay muestra que muestre recortes o rechazos. **Correlacionado:** `prepareGoogleInteractionRequest` genera el reporte agregado con razones `exchange_limit`, `non_image_bytes`, `request_bytes` y `stale_images`, y rechaza el contexto imprescindible previo a red. **Hipótesis:** una concentración futura de esas razones indicará pérdida de contexto o fricción con adjuntos, no lentitud del proveedor. **Consecuencia:** conserve esos agregados sin contenido y pruebe el rechazo previo a red antes de tocar 19 MB o 512 KiB.

2. **Prioridad alta — preservar identidad y reconciliación al añadir una escritura.** **Observado:** no hay repetición medida. **Correlacionado:** `ToolOperationCoordinator.execute` prepara persistentemente, une trabajo simultáneo y no repite una operación no reconciliable. **Hipótesis:** una repetición remota con la misma identidad debe resolverse como unión, replay o `indeterminate`. **Consecuencia:** implemente recibo/reconciliador de dominio y marque el commit inmediatamente después del efecto irreversible; no use `providerCallId` como identidad.

3. **Prioridad media — medir la forma de batches antes de optimizar tools.** **Observado:** la muestra no permite afirmar que una tool sea un hotspot. **Correlacionado:** hasta cuatro lecturas contiguas pueden solaparse, pero una escritura o tool desconocida corta el batch y espera. **Hipótesis:** latencia de rondas con varias lecturas podría aproximarse al máximo de las lecturas, mientras una escritura intercalada resta paralelismo. **Consecuencia:** añada o preserve telemetría agregada de fase, tamaño de batch y duración; no convierta escrituras en paralelas para reducir una latencia sin confirmar.

## Cambios seguros y validación focalizada

1. Mantenga un único `AgentPolicyLease` inmutable por turno.
2. Al añadir una tool de escritura, valide antes del efecto, llame `markEffectCommitted` tras la mutación irreversible y proporcione reconciliación para entradas `prepared` e `indeterminate`.
3. No elimine `occurrence` ni introduzca `providerCallId` en la identidad: la primera distingue calls iguales intencionales y el segundo puede cambiar en un reintento.
4. Para Google, almacene solo contadores y razones de `GoogleContextReport`; mantenga la preservación del último intercambio y los pares completos de tool.
5. Instrumente agregados de proveedor, ruta, estado, duración, rondas, tamaño de batch, cierre y estado de commit; nunca contenido sensible ni razonamiento.

Ejecute desde la raíz:

```bash
npx vitest run --config apps/mobile/vitest.config.mts apps/mobile/agent/agentPolicyRuntime.test.ts apps/mobile/agent/googleInteractions.test.ts apps/mobile/agent/providerToolClient.test.ts apps/mobile/agent/providerToolLoop.test.ts apps/mobile/agent/providerPipeline.test.ts apps/mobile/agent/toolBatch.test.ts apps/mobile/agent/toolExecutor.test.ts apps/mobile/agent/toolOperationLedger.test.ts
```

Estas pruebas verifican límites, batching, contratos de continuación, semántica de commit, reconciliación e idempotencia local; no prueban disponibilidad, coste ni latencia de proveedores remotos. Para el recorrido visible, añada `npm run test:agent:e2e` como indica el [Inicio rápido](../quickstart.md).
