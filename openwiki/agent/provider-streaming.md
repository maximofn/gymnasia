---
okf:
  version: 1
  kind: code-wiki
  status: grounded
  scope: provider stream transports, parsers, and continuation protocols
type: arquitectura de streaming
title: Streaming y continuaciones de proveedores
description: Explica cómo el chat móvil procesa SSE de OpenAI, Anthropic y Google, ejecuta herramientas por rondas y reconstruye las continuaciones sin perder los datos de protocolo.
tags: [agent, streaming, sse, openai, anthropic, google]
related:
  - ./runtime.md
  - ./provider-configuration.md
sources:
  - id: openwiki-source-c2d1a0c89805fc4fc01238e2
    resource: repo://apps/anthropic_proxy/cors-proxy.py
  - id: openwiki-source-dc42304b20e8518ef65b4b63
    resource: repo://apps/mobile/agent/googleContextBudget.ts
  - id: openwiki-source-63dae4a27346d91c6139697b
    resource: repo://apps/mobile/agent/googleInteractions.test.ts
  - id: openwiki-source-df22d5c1fa6f9ff9bb908437
    resource: repo://apps/mobile/agent/googleInteractions.ts
  - id: openwiki-source-f310c5fb576ae69a7753918c
    resource: repo://apps/mobile/agent/googleStreamTransport.ts
  - id: openwiki-source-c65a19b98fa314cba98ace44
    resource: repo://apps/mobile/agent/providerPipeline.test.ts
  - id: openwiki-source-6b9b666faa646a8fd83706ea
    resource: repo://apps/mobile/agent/providerStreamParsers.ts
  - id: openwiki-source-479fc45ac32d23cfffe17d8e
    resource: repo://apps/mobile/agent/providerStreamTransport.ts
  - id: openwiki-source-9de55cc50318c64549e79726
    resource: repo://apps/mobile/agent/providerToolClient.roundLimit.test.ts
  - id: openwiki-source-abc6fea468a7de09acfb0c4f
    resource: repo://apps/mobile/agent/providerToolClient.ts
  - id: openwiki-source-b14a4ecd65e83b5561f88e2a
    resource: repo://apps/mobile/agent/providerToolLoop.ts
  - id: openwiki-source-c5c28138a849ad0b9daed017
    resource: repo://apps/mobile/agent/providerTransport.test.ts
  - id: openwiki-source-cc29928f3ae5e1998f27d57a
    resource: repo://apps/mobile/agent/providerTransport.ts
  - id: openwiki-source-63f2fbe9450b42dc3369441f
    resource: repo://apps/mobile/agent/sse.test.ts
  - id: openwiki-source-42008b636d0a1be0e91188e0
    resource: repo://apps/mobile/agent/sse.ts
  - id: openwiki-source-929e8e1df23628a3f3848ff8
    resource: repo://apps/mobile/App.tsx
generated: { by: "openwiki/0.6.0", at: "2026-09-27T17:43:05.548Z" }
---

# Streaming y continuaciones de proveedores

`requestProviderToolChat` es el orquestador de chat con herramientas de `apps/mobile`. Separa las instrucciones de sistema, selecciona el transporte del proveedor, entrega deltas a la interfaz y delega la ejecución de efectos en el `executeTool` inyectado. El transporte solo convierte una respuesta en un turno estructurado; `providerToolLoop.ts` es quien decide si hay que continuar y construye el siguiente contexto.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Parse error on line 14: ...ls Client->>Loop: run provider c Expecting '+', '-', '()', 'ACTOR', got 'loop' -->
```text
sequenceDiagram
    participant UI as Chat UI
    participant Client as Provider tool client
    participant Transport as Stream transport
    participant Parser as Turn parser
    participant Loop as Tool loop
    participant Executor as Tool executor
    UI->>Client: messages and handlers
    Client->>Transport: request current turn
    Transport->>Parser: incremental SSE text
    Parser-->>UI: content and thinking deltas
    Parser-->>Client: completed turn
    alt turn requests tools
        Client->>Loop: run provider continuation
        Loop->>Executor: calls in provider order
        Executor-->>Loop: results
        Loop->>Transport: next turn with correlated results
    else turn completed
        Client-->>UI: accumulated response
    end
```

*Flujo de una solicitud con streaming y, cuando procede, rondas de herramientas.*

## Encuadre, parsers y acumulación

El encuadre común `splitSSEEvents` normaliza CRLF, emite únicamente registros terminados por una línea vacía y conserva el resto incompleto. `parseSSEEvent` descarta comentarios, usa `message` por defecto y concatena las líneas `data:`. Por ello Fetch y XHR pueden entregar cortes arbitrarios sin que el transporte tenga que conocer fronteras JSON o SSE.

Cada solicitud de turno crea un parser. Los parsers de OpenAI y Anthropic ensamblan elementos por índice, publican deltas de contenido y razonamiento, y devuelven un indicador `truncated` si falta su evento terminal. OpenAI mantiene `responseId`, elementos de salida y fragmentos de argumentos; Anthropic reúne bloques `text`, `thinking` —incluida la firma— y `tool_use`, convirtiendo el JSON parcial de la herramienta al cerrar el bloque. El cliente mantiene acumuladores alrededor de todas las rondas para que el resultado y los callbacks no queden limitados al último turno.

El parser de Google Interactions es intencionadamente más estricto: exige la creación de interacción, índices de paso ordenados, el ciclo `step.start`/`step.delta`/`step.stop`, pasos cerrados y una finalización coherente con `completed` o `requires_action`. Rechaza antes del bucle los eventos, JSON, argumentos, firmas, IDs, orden o cierre inválidos. Repetir la apertura o el cierre del mismo paso no reinicia el contenido ya reunido.

## Transporte y errores de red

| Proveedor | Web | Nativo | Cierre y error relevante |
|---|---|---|---|
| OpenAI | `Fetch` con `TextDecoder` incremental | `XMLHttpRequest` con progreso | 120 s; el bucle rechaza un turno truncado antes de ejecutar tools. |
| Anthropic | `XMLHttpRequest` con progreso | `XMLHttpRequest` con progreso | 120 s; un HTTP 2xx sin `message_stop` se rechaza. |
| Google | `Fetch` con `TextDecoder` incremental | `XMLHttpRequest` con progreso | 120 s; si falla la ruta incremental nativa antes de un delta visible, repite una vez con XHR bufferizado. |

En XHR se pasa al parser exclusivamente el sufijo de `responseText` posterior a `lastOffset`; Fetch decodifica bytes en modo streaming y hace lo mismo. Los códigos no exitosos, errores de red, timeout y errores de parser rechazan la petición. El fallback de Google no se permite una vez que se notificó contenido o razonamiento, para no duplicar texto visible.

## Continuaciones y límites

### OpenAI y Anthropic

Para OpenAI, el bucle requiere `responseId` si el turno contiene `function_call`, ejecuta las llamadas secuencialmente y continúa con `function_call_output` correlacionado mediante `call_id`. Los argumentos vacíos, no JSON, arrays o valores que no sean objeto se degradan a `{}` para el ejecutor. Para Anthropic, la continuación añade los bloques completos del asistente y un mensaje de usuario con cada `tool_result` vinculado por `tool_use_id`; así se conservan bloques de pensamiento y datos de protocolo, no solo el texto mostrado.

Los tres bucles tienen `MAX_TOOL_ROUNDS = 10`. Si queda una llamada pendiente, no la ejecutan: incorporan un resultado sintético y piden un único turno de cierre con las tools prohibidas. Si ese cierre falla, llega truncado o vuelve a solicitar una herramienta, se entrega `ToolRoundLimitError` en lugar de presentar una respuesta intermedia como final. La ejecución sigue siendo secuencial; un error posterior no revierte un efecto ya hecho, y el sobre de llamada incluye proveedor, ID remoto y ocurrencia para el coordinador de operaciones.

La configuración de razonamiento de Anthropic usa `enabled` con presupuesto para Claude 3 y 4.5, y `adaptive` con `display: "summarized"` para el resto, incluso modelos desconocidos.

### Google Interactions y presupuesto local

`buildGoogleInteractionRequest` envía `stream: true`, `store: false` y el historial local en `input`; no depende de `previous_interaction_id`. El bucle añade un `function_result` con el mismo `call_id` a cada llamada y vuelve a preparar el historial en cada ronda. Conserva pasos y campos opacos —en especial firmas—, evita ejecutar de nuevo una interacción repetida identificada y rechaza una identidad contradictoria o IDs de herramienta reutilizados entre rondas. Como `store: false` permite un ID vacío, ese valor no identifica replays.

El historial persistible de un asistente Google es `GoogleConversationTurn`: guarda los pasos e interacciones del turno completo. Al reconstruirlo, un turno validado aporta sus pasos técnicos; un mensaje sin ese metadato se representa como texto. La validación de restauración rechaza llamadas pendientes, firmas de pensamiento ausentes y correlaciones de resultados inválidas, por lo que hidratar un chat no ejecuta herramientas.

Antes de red, `prepareGoogleInteractionRequest` limita el candidato a diez intercambios, 512 KiB de JSON sin imagen y 19 000 000 bytes del cuerpo completo. Un intercambio comienza en `user_input` y nunca se divide. El preparador elimina imágenes inline de intercambios anteriores —conserva texto o añade un marcador cuando la entrada era solo imagen— y, si sigue excedido, elimina intercambios completos desde el más antiguo. Si el intercambio activo no cabe, lanza `GoogleContextBudgetError`; no muta el historial local.

## Acceso web a Anthropic

En web, Anthropic se llama directamente por defecto y añade `anthropic-dangerous-direct-browser-access`. El proxy solo se usa si se configura expresamente `EXPO_PUBLIC_API_BASE_URL`; el valor predeterminado es vacío para que el despliegue estático no intente llegar al localhost de un desarrollador. El proxy incluido acepta únicamente clientes loopback y se declara herramienta de desarrollo local, no backend de producción. Al usarlo, las credenciales llegan en el cuerpo del proxy y este las convierte en cabeceras hacia Anthropic.

## Contraste de runtime y producción

- **Observado.** El repositorio implementa rutas de streaming para los tres proveedores, la protección de truncamiento y el fallback XHR de Google descritos arriba. También contiene pruebas deterministas con fixtures SSE y pruebas de fragmentación; no son una observación de tráfico de producción.
- **Correlacionado.** La configuración web opt-in del proxy, su cerrojo loopback y los transportes de cliente son coherentes con un despliegue web estático BYOK que llama directamente a los proveedores. La traza de contexto se entrega opcionalmente mediante `onGoogleContextReport`; este flujo no demuestra que exista telemetría desplegada ni que se haya recibido un evento real.
- **Hipótesis.** Si se incorporan métricas operativas, conviene registrar solo estados y contadores allowlistados —proveedor, transporte, timeout, truncamiento, rondas y reporte de presupuesto— y no mensajes, argumentos, firmas ni resultados de tools. Debe validarse por separado contra la política de privacidad y el destino de observabilidad.

## Pruebas focalizadas y cambios seguros

`providerPipeline.test.ts` reproduce fixtures SSE de los tres dialectos con trozos repetidos y con particiones arbitrarias. Cubre el recorrido parser → herramienta → continuación, la correlación de llamadas múltiples, argumentos inválidos, errores del proveedor y truncamiento. `providerToolClient.roundLimit.test.ts` cubre la llamada de cierre tras el límite. Las pruebas de Google cubren la máquina de estados, replays, restauración del historial, presupuesto y paridad entre Fetch/XHR; `sse.test.ts` protege el encuadre común.

Al modificar un dialecto, actualice conjuntamente el parser, el contrato de continuación del bucle y los transportes aplicables. No elimine IDs de llamada, firmas o bloques de razonamiento al persistir o continuar: son datos de protocolo. Añada fixtures que separen eventos y JSON en fronteras distintas, además del caso de stream completo.

```bash
npm exec -- vitest run --config apps/mobile/vitest.config.mts apps/mobile/agent/sse.test.ts apps/mobile/agent/providerPipeline.test.ts apps/mobile/agent/providerToolClient.roundLimit.test.ts apps/mobile/agent/googleInteractions.test.ts
```
