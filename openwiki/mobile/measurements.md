---
type: concepto
title: Mediciones y métricas corporales
description: Contrato, edición, borrado y persistencia local de las mediciones corporales móviles. Cubre la pantalla, el borrador del plan de dieta, las herramientas del agente, los recibos de operación y el tratamiento privado de fotos.
tags: [mobile, measurements, validation, persistence, diet]
okf:
  version: 1
  kind: code-wiki
  status: grounded
  scope: Flujo de borradores, validación, cálculo y persistencia de mediciones corporales en apps/mobile
summary: Contrato de mediciones, borradores de peso y altura, controladores de pantalla y persistencia local.
related:
  - ./local-state-and-backup.md
  - ./diet-and-food-estimation.md
  - ../agent/runtime.md
sources:
  - id: openwiki-source-404a4ecb653d0577876809d2
    resource: repo://apps/mobile/agent/measurementDeletion.test.ts
  - id: openwiki-source-ce025f2f0f394ccba9235558
    resource: repo://apps/mobile/agent/toolDefinitions.ts
  - id: openwiki-source-d3be928c369037f29888bc0b
    resource: repo://apps/mobile/agent/toolExecutor.ts
  - id: openwiki-source-929e8e1df23628a3f3848ff8
    resource: repo://apps/mobile/App.tsx
  - id: openwiki-source-c13b295e970a1149f0f40cbd
    resource: repo://apps/mobile/backup/measurementMedia.ts
  - id: openwiki-source-38706b8a9c8db94990f38e34
    resource: repo://apps/mobile/controllers/measurementsController.ts
  - id: openwiki-source-f4cb42639b722f40aa5d0429
    resource: repo://apps/mobile/controllers/settingsController.ts
  - id: openwiki-source-48c9220b786189d88056ced7
    resource: repo://apps/mobile/measurements/bodyMetricsDraft.test.ts
  - id: openwiki-source-d6830ce6b989de4f82a65ed4
    resource: repo://apps/mobile/measurements/bodyMetricsDraft.ts
  - id: openwiki-source-7008ede2c23cd79f4d2e7f43
    resource: repo://apps/mobile/measurements/measurementContract.ts
  - id: openwiki-source-2738c54d099fb7a1c8c82e19
    resource: repo://apps/mobile/measurements/measurementSummary.test.ts
  - id: openwiki-source-5d5e12ead8a32eca07439b03
    resource: repo://apps/mobile/screens/SettingsScreen.tsx
verified:
  - by: openwiki/0.6.0
    at: 2026-11-26T17:57:31.517Z
generated: { by: "openwiki/0.6.0", at: "2026-11-26T17:57:31.517Z" }
---

# Mediciones y métricas corporales

`apps/mobile/measurements/measurementContract.ts` es el límite de dominio del historial. Centraliza la forma almacenada, normalización, mutaciones y proyecciones derivadas; la pantalla Medidas, los ajustes, el borrador del plan de dieta y las herramientas del agente deben pasar por él. Peso y altura no tienen una segunda copia persistida en `dietSettings`.

## Registro e invariantes

Una `Measurement` contiene `id`, el día de calendario `measured_on`, el instante técnico `measured_at`, `photo_uri` opcional y diez métricas opcionales: peso, porcentaje de grasa, siete contornos y altura. Al normalizar datos heredados puede derivar el día desde un `measured_at` válido; si debe crear el instante para un día, usa el mediodía local, lo que evita desplazar el día por zona horaria.

| Invariante | Consecuencia práctica |
|---|---|
| Fecha | Debe ser una fecha real `AAAA-MM-DD` y no futura. |
| Métrica | Debe ser finita y positiva, se redondea a dos decimales, y `body_fat_pct` no puede superar 100. Las cadenas con coma o punto decimal se admiten solo en rutas de entrada que lo piden expresamente. |
| Contenido | Una medición debe conservar una métrica o una foto. Para retirar el último contenido hay que borrar el registro por `id`; no existe una medición vacía. |
| Orden y capacidad | La colección queda en orden descendente por día, `measured_at` e `id`, y conserva como máximo 1.826 registros. La mutación informa los registros desplazados por ese límite. |
| Día duplicado | Los duplicados heredados se detectan para su reparación. No se puede hacer `upsert` sobre un día ambiguo ni mover una edición a una fecha ya ocupada. |

`upsertMeasurementByDate` aplica un parche a la única medición existente del día: conserva las métricas y la foto omitidas. `replaceMeasurementById`, usado al editar desde el historial, sustituye todos los valores del formulario y solo puede cambiar de día si no introduce un conflicto. Ambas rutas vuelven a validar, exigir contenido, ordenar y limitar la colección.

## Borrador de peso y altura del plan de dieta

El plan mantiene únicamente texto efímero en `BodyMetricsDraft` (`weightInput` y `heightInput`). `resolveBodyMetricsDraft` analiza ambos con `validateMeasurementMetric`, admite coma decimal y produce a la vez:

- valores efectivos para cálculo: un valor válido del borrador o, si está vacío, el último valor medido;
- un mensaje por campo y `hasIssues` si el texto no es un número positivo válido;
- un `MeasurementPatch` solo con valores válidos, no vacíos y diferentes del último registro.

Un campo vacío no borra una medición. Un valor inválido queda efectivo como `null`, se señala como problema y no entra en el parche; así no se sustituye silenciosamente por el dato anterior. El guardado del plan se bloquea si hay errores. Antes de escribir, el runtime previsualiza el `upsert`; si falla, no cambia nada. Si pasa, actualiza `dietSettings` y la medición de hoy en el mismo mutador del almacén. El ID se crea antes del mutador para que una repetición de este no produzca IDs distintos.

```mermaid
flowchart TD
    Draft["Texto de peso y altura"] --> Resolve["Resolver borrador"]
    Resolve --> Issues{"Hay errores"}
    Issues -->|"Sí"| Block["No calcular ni guardar"]
    Issues -->|"No"| Calculate["Calcular con valores efectivos"]
    Calculate --> Preview["Previsualizar upsert de hoy"]
    Preview --> Result{"Contrato válido"}
    Result -->|"No"| Report["Mostrar incidencias"]
    Result -->|"Sí"| Commit["Guardar dietSettings y mediciones"]
```

*El borrador decide el valor efectivo y el parche; el contrato decide si la medición de hoy puede persistirse.*

## Edición, borrado y fotos desde la interfaz

`useMeasurementsRuntime` adapta `LocalStoreRuntime`, los servicios de plataforma, preferencias y el generador de IDs a la pantalla. Prepara una vez el historial por cambio de `store.measurements`; de ahí toma últimos peso y altura y el resumen. Cuando aún no hay altura medida, usa como alternativa un `height_cm` positivo de los ajustes de dieta para presentación y cálculos, sin convertirlo en una medición.

La entrada manual conserva localmente fecha, textos, foto, estado de edición, carga y overlays. Al guardar:

1. convierte cada texto con `parseOptionalPositiveMetricInput` y rechaza el primer campo inválido;
2. exige una métrica o una foto;
3. normaliza una foto nueva en almacenamiento de medios propio antes del commit;
4. para una alta hace `upsertMeasurementByDate`; para una edición, `replaceMeasurementById`;
5. ejecuta la mutación con `localStore.commit` y solo cierra el formulario tras el commit exitoso.

En Ajustes, cada registro tiene acciones directas **Editar** y **Eliminar**. El borrado de UI pasa el `id` al runtime, que ejecuta `deleteMeasurementById` dentro de `localStore.commit`. Un resultado de contrato inválido o un fallo del commit deja la colección sin cambio y muestra un error; no hay una confirmación intermedia en ese recorrido. Tras un commit de borrado correcto se intenta liberar la foto eliminada solo si es propia y ninguna medición restante referencia la misma URI.

Las fotos son datos sensibles y no se deben tratar como una URI durable de galería o cámara. En nativo, una foto nueva se renderiza como JPEG —máximo 2048 px de lado, calidad 0,8—, se le quitan metadatos, se limita a 5 MiB y se guarda en el directorio privado de medios con nombre SHA-256. La misma URI ya propia se vuelve a validar. En web el resultado no es propio, por lo que no ofrece esa garantía de persistencia. Tras hidratar, el runtime intenta migrar URI heredadas al almacén propio; en web avisa que se debe exportar una copia. La limpieza de reemplazos, borrados y huérfanos nunca borra una URI aún referenciada; los fallos de limpieza se dejan para una pasada posterior y no revierten un cambio de medición ya durable.

## Lecturas derivadas y visualización

Los selectores trabajan sobre un historial preparado y ordenado. Para cada métrica el resumen toma el primer valor finito de cada día: los duplicados heredados no hacen que tarjetas, último peso o gráficas dependan del orden de entrada. Las gráficas filtran un intervalo inclusivo de días de calendario y devuelven los puntos en orden cronológico.

El porcentaje de grasa explícito tiene prioridad. Si falta, se estima con cintura, cuello y altura; para `female` también requiere cadera. La estimación devuelve `null` cuando faltan prerrequisitos o las relaciones son inválidas, y acota su resultado a 3–60 con un decimal. Las preferencias de métrica y periodo de gráfico se actualizan fuera de la colección de mediciones.

## Herramientas del agente: privacidad, commit y recibos

`read_measurement` valida la fecha y rechaza días duplicados antes de responder. Solo serializa `measured_on` y las métricas: elimina `id`, `photo_uri` y `measured_at`, por lo que el agente no recibe identidad interna, URI de fotografía ni timestamp técnico.

`write_measurement` está declarado como `local_write`. Recibe `data` estructurado y `clear_fields`: campos omitidos conservan el valor existente y los solicitados para borrar pasan a `null`. El parser rechaza campos desconocidos, un parche vacío, tipos inválidos y actualizar/borrar el mismo campo en la operación. Después delega el `upsert` al contrato, por lo que mantiene los límites de fecha, métrica, contenido y duplicados de la UI.

La escritura exige `context.commitStore`; `App.tsx` lo adapta a `localStoreRuntime.commit`. No se llama a `markEffectCommitted` ni se comunica éxito hasta que ese commit resuelve. Una excepción de persistencia se transforma en estado indeterminado, mientras que un rechazo del contrato dentro del mutador retorna `measurement_conflict` sin modificar la colección. Con `operationId`, el ID de medición se deriva de la operación y el mismo commit añade un recibo `write_measurement`; la reconciliación inspecciona los recibos del almacén local para reconocer una operación ya confirmada.

`delete_measurement` también es `local_write`, pero borra el registro completo por fecha únicamente cuando el usuario lo pidió expresamente. Primero valida la fecha y, dentro del commit, exige exactamente una medición para ese día: una fecha ausente o ambigua no borra nada. Un recibo previo de la misma `operationId` devuelve `already_applied`; un borrado nuevo elimina el registro y añade el recibo `delete_measurement` en la misma mutación durable. Solo después marca el efecto como confirmado e intenta liberar la foto con la misma política de referencias que la UI. Su salida no expone `id`, URI ni timestamp: informa fecha, métricas eliminadas y si tenía foto.

```mermaid
sequenceDiagram
    participant Agent as Agente
    participant Exec as Tool executor
    participant Contract as Measurement contract
    participant Store as LocalStoreRuntime
    Agent->>Exec: write_measurement date data clear_fields
    Exec->>Exec: validar fecha y parche
    Exec->>Store: commitStore updater
    Store->>Contract: upsertMeasurementByDate
    alt contrato rechaza
        Contract-->>Store: errores y estado previo
        Store-->>Exec: commit resuelto
        Exec-->>Agent: measurement_conflict
    else commit durable
        Contract-->>Store: colección y recibo
        Store-->>Exec: commit resuelto
        Exec-->>Agent: éxito confirmado
    end
```

*La herramienta solo confirma una escritura después del commit durable; una excepción de persistencia no se presenta como éxito.*

Al añadir una métrica, actualice de forma coordinada `MEASUREMENT_METRIC_KEYS`, el esquema de `write_measurement`, sus `clear_fields` y las proyecciones de pantalla. De otro modo el contrato, el agente y la UI aceptarían superficies distintas.

## Pruebas focalizadas

- `bodyMetricsDraft.test.ts` cubre coma/punto decimal, vacío como ausencia, valores no finitos o no positivos, valores efectivos, parche mínimo y preservación de otras métricas al aplicarlo hoy. Incluye propiedades sobre cadenas arbitrarias y números positivos formateados.
- `measurementContract.test.ts` cubre calendario y futuro, redondeo y máximo de grasa, migración heredada, parches del agente, duplicados, reemplazo, borrado, límite, resumen, gráficas y estimación.
- `measurementSummary.test.ts` compara resumen y gráficas con una referencia, permuta historiales y exige una sola ordenación más recorridos lineales del historial preparado. Los contadores de rendimiento no contienen valores de medición.
- `agent/toolExecutor.test.ts` verifica escritura estructurada, preservación de campos omitidos, borrado explícito, rechazo sin persistir ante dato inválido o día duplicado y resultado indeterminado si falla el almacenamiento.
- `agent/measurementDeletion.test.ts` cubre el recibo y resultado del borrado, protección ante fecha inexistente, inválida o ambigua, reintento idempotente, liberación de foto y la secuencia para corregir una fecha equivocada.

Para cambios de contrato, borrador o herramienta, ejecute:

```bash
npx vitest run --config apps/mobile/vitest.config.mts apps/mobile/measurements/bodyMetricsDraft.test.ts apps/mobile/measurements/measurementContract.test.ts apps/mobile/measurements/measurementSummary.test.ts apps/mobile/agent/toolExecutor.test.ts apps/mobile/agent/measurementDeletion.test.ts
npx tsc --noEmit -p apps/mobile/tsconfig.json
```
