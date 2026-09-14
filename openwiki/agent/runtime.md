---
okf:
  version: 1
  kind: code-wiki
  status: grounded
  scope: apps/mobile/agent and chat orchestration in apps/mobile/App.tsx
type: entorno de ejecución
title: Runtime del agente y herramientas
description: Guía para interpretar una muestra de ejecución LangSmith del agente móvil sin convertirla en una tasa poblacional. Relaciona llamadas, repeticiones, latencia y tokens con los límites efectivos del loop, la política y los efectos locales.
summary: Diagnóstico de rutas, reintentos, límites, costes e idempotencia del agente móvil.
tags: [agent, runtime, tools, mobile, policy, idempotency, langsmith]
related:
  - ./provider-streaming.md
  - ./provider-configuration.md
  - ../architecture/policy-delivery.md
  - ../mobile/diet-and-food-estimation.md
  - ../operations/runtime-behavior.md
sources:
  - id: openwiki-source-192849a5973afd8b6e55db2c
    resource: repo://apps/mobile/agent/agentPolicyRuntime.test.ts
  - id: openwiki-source-0c30fc96b9e7c8b57c35473c
    resource: repo://apps/mobile/agent/agentPolicyRuntime.ts
  - id: openwiki-source-c8058179f2f675901a8caa09
    resource: repo://apps/mobile/agent/healthSafety.ts
  - id: openwiki-source-1120d27174dc5514893a227c
    resource: repo://apps/mobile/agent/personalData.contract.test.ts
  - id: openwiki-source-f0c2a422cec47f5791d6713d
    resource: repo://apps/mobile/agent/personalData.ts
  - id: openwiki-source-c65a19b98fa314cba98ace44
    resource: repo://apps/mobile/agent/providerPipeline.test.ts
  - id: openwiki-source-b14a4ecd65e83b5561f88e2a
    resource: repo://apps/mobile/agent/providerToolLoop.ts
  - id: openwiki-source-ce025f2f0f394ccba9235558
    resource: repo://apps/mobile/agent/toolDefinitions.ts
  - id: openwiki-source-165cffcff462003cd11223e2
    resource: repo://apps/mobile/agent/toolExecutor.test.ts
  - id: openwiki-source-d3be928c369037f29888bc0b
    resource: repo://apps/mobile/agent/toolExecutor.ts
  - id: openwiki-source-d8ad30beb46f5e7dc1ced4cf
    resource: repo://apps/mobile/agent/toolOperationLedger.test.ts
  - id: openwiki-source-9e7ddd51c09caf628a81acad
    resource: repo://apps/mobile/agent/toolOperationLedger.ts
  - id: openwiki-source-929e8e1df23628a3f3848ff8
    resource: repo://apps/mobile/App.tsx
verified:
  - by: openwiki/0.5.0
    at: 2026-09-13T12:53:55.207Z
generated: { by: "openwiki/0.5.0", at: "2026-09-13T12:53:55.207Z" }
---

# Runtime del agente y herramientas

Esta página sirve para decidir **qué comprobar antes de alterar el loop móvil** a partir de una muestra de LangSmith. No describe el ensamblaje normal de middleware ni sustituye el contrato operativo de [Comportamiento en ejecución de la automatización OpenWiki](../operations/runtime-behavior.md): aquella página trata el runner privado que genera la wiki; esta trata el chat de `apps/mobile` y sus efectos locales. A la inversa, una señal del runner o de OpenWiki no debe atribuirse al agente móvil sin una traza de este proyecto.

## Cómo leer la evidencia

### Observado

No hay un dump LangSmith legible mediante las fuentes de trabajo disponibles en esta actualización. Por tanto, esta revisión **no publica conteos de llamadas, latencias, tokens, costes ni repeticiones**, ni deduce una causa de fallo. No confunda la presencia de configuración de trazado con evidencia de tráfico o métricas.

Cuando esté disponible el dump ya ingerido, registre únicamente agregados de la muestra: número de runs, llamadas por herramienta, latencia por herramienta, tokens de entrada/salida cuando estén presentes, y repeticiones por `executionId` y operación. Indique siempre ventana, filtros y denominador. Una muestra de trazas es sesgada por proveedor, entorno, usuarios, errores y muestreo; no es una tasa poblacional ni prueba causal.

### Correlacionado: límites que explican qué inspeccionar

Los siguientes hechos provienen de símbolos de código, no de LangSmith. Son el mapa para convertir una señal observada en una hipótesis comprobable:

- **Límite de rondas y coste de proveedor.** `MAX_TOOL_ROUNDS` vale 10. Cada loop ejecuta las calls de una ronda de forma secuencial y solicita otra respuesta al proveedor si quedan llamadas. Una secuencia que alcance diez rondas debe revisarse como límite del loop y como posible multiplicador de latencia/tokens, no como evidencia de que una herramienta concreta sea lenta. OpenAI también falla si necesita continuar una llamada sin `responseId`; Google rechaza IDs de llamada repetidos entre rondas. Véanse `runOpenAIToolLoop`, `runAnthropicToolLoop` y `runGoogleToolLoop`.
- **Reintentos de turno.** `sendMessage` intenta como máximo tres veces errores de transporte que coincidan con su patrón, esperando 2 y 4 segundos antes de los intentos posteriores y reiniciando el borrador. Una misma interacción de usuario puede por ello tener varias solicitudes de proveedor sin que sea una repetición de escritura; para correlacionarlas, el `executionId` transmitido al loop es el ID del mensaje de usuario.
- **Rutas que evitan o amplían tráfico.** El riesgo sanitario bloqueante evita el proveedor. Para riesgo `elevated`, el evaluador remoto solo se consulta si hay consentimiento para el proveedor; tiene un timeout de 10 s y, si falla, se conserva la decisión base. Separar esas llamadas de clasificación de las llamadas principales evita sumar su latencia o tokens al turno conversacional.
- **Historial y streaming.** OpenAI y Anthropic reciben como máximo 20 mensajes de historial, Google recibe el historial completo de interacción. El cliente acumula deltas y el borrador se actualiza con una cadencia mínima de 40 ms. Así, la latencia visible no equivale necesariamente a la latencia de una herramienta ni a un único request remoto.
- **Efectos y repetición segura.** El guard bloquea tools desconocidas y las incompatibles con la decisión sanitaria antes del ejecutor. Las tools de lectura no se deduplican. Para una escritura, la identidad usa versión, `executionId`, proveedor, nombre, argumentos JSON canónicos y ocurrencia; excluye `providerCallId`. El coordinador comparte ejecuciones simultáneas y reproduce una escritura ya comprometida desde memoria o ledger. Por ello, varias calls observadas con igual operación no implican varias mutaciones locales.
- **Punto de commit.** El ejecutor solamente clasifica un resultado como `committed` si el manejador invoca `markEffectCommitted`; los errores o validaciones previos quedan fuera del ledger y pueden volver a intentarse. El ledger persiste únicamente resultados comprometidos, conserva hasta 256 entradas durante siete días y bloquea la ejecución si no puede leerse. Un fallo al escribir el ledger ocurre después del efecto: debe investigarse como riesgo de deduplicación tras reinicio, no presentarse como rollback.

### Hipótesis que una muestra puede priorizar

1. **Latencia elevada con muchas rondas:** comprobar `MAX_TOOL_ROUNDS`, el número de continuaciones del proveedor y la secuencialidad de las calls antes de optimizar un handler.
2. **Más de un request por mensaje:** distinguir el reintento de transporte, el evaluador sanitario consentido y las continuaciones de tools. No etiquetarlo como duplicación hasta contrastar `executionId`, proveedor, ocurrencia y `operationId`.
3. **Coste de entrada creciente:** contrastar proveedor e historial efectivo; Google no comparte el recorte a 20 mensajes de OpenAI/Anthropic.
4. **Una tool repetida con una única mutación:** verificar si el resultado fue replay del ledger o unión `inFlight`. Si fue `no_effect` o `failed_before_commit`, la repetición sí puede ejecutar de nuevo porque aún no hubo commit.
5. **Fallo de escritura sin respuesta normal:** revisar primero lectura del ledger, validación del handler y persistencia local. Una colisión o una lectura de ledger fallida están diseñadas para impedir el efecto.

Estas son hipótesis de diagnóstico, no explicaciones de una observación inexistente o de una muestra aislada.

## Invariantes para cambiar el loop

- Mantenga un único `AgentPolicyLease` inmutable por turno: une prompt, política sanitaria, contexto y estado de política. En canal `Local` procede del bundle y fuera de él una política sanitaria firmada incompatible se rechaza. No mezcle datos personales locales en el prompt: la memoria se expone mediante tools específicas.
- Al añadir una tool, declare su esquema y efecto en `AGENT_TOOL_DEFINITIONS`, mantenga el handler registrado y decida si es lectura, escritura local o externa. La clasificación de seguridad se aplica también a `nombre + argumentos`, no solo al texto inicial.
- Para una escritura, valide antes de mutar, use el almacenamiento durable apropiado y marque el commit inmediatamente después del efecto irreversible. Propague `operationId` a IDs durables cuando la entidad creada necesite resistencia adicional a duplicados.
- No cambie la composición de identidad para incluir `providerCallId`: los reintentos del proveedor cambiarían de identidad. Tampoco elimine `occurrence`, pues dos calls idénticas dentro del mismo turno deben poder distinguirse.
- Al instrumentar, no incluya contenido de prompt, argumentos personales, resultados crudos ni razonamiento. Los agregados deben permitir separar proveedor, ruta, tool y estado de commit sin convertir la observabilidad en otra superficie de datos sensibles.

## Validación focalizada

```bash
npx vitest run --config apps/mobile/vitest.config.mts apps/mobile/agent/agentPolicyRuntime.test.ts apps/mobile/agent/providerToolClient.test.ts apps/mobile/agent/providerToolLoop.test.ts apps/mobile/agent/toolDefinitions.test.ts apps/mobile/agent/toolExecutor.test.ts apps/mobile/agent/toolOperationLedger.test.ts
```

Las pruebas del loop fijan la correlación nativa de resultados y el requisito de `responseId` de OpenAI. Las del ledger cubren canonicalización, replay tras reinicio, unión concurrente, colisión, indisponibilidad de lectura, TTL/límite y borrado durante una operación. Úselas junto con la muestra de trazas: prueban el contrato local, pero no miden disponibilidad, latencia ni coste de proveedores remotos.
