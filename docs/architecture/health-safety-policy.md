# Política de seguridad sanitaria del agente

## Qué protege

`policy/health-safety/` es la fuente canónica de las reglas sanitarias de
Gymnasia Coach. Cubre ayunos prolongados, pérdida extrema de peso, déficits,
trastornos alimentarios, menores, embarazo, diabetes, medicación, lesiones,
dolor agudo y emergencias.

La política alimenta cuatro barreras coordinadas:

1. el bloque administrado `HEALTH-SAFETY` de `prompts/AGENTS.md`;
2. los casos y fixtures deterministas de la puerta de CI;
3. `runtime.json`, con señales y respuestas locales ES/EN/PT para el guardrail
   de entrada, salida, streaming y tools;
4. la interfaz de informe no autorizador que consumirán las evals con LLM.

No se mantiene una segunda copia manual del contenido sanitario en el prompt.

## Estados y revisión profesional

Cada regla tiene un ID estable `HS-...`, versión, fuentes, incertidumbre y uno de
estos estados:

- `draft`: está incompleta. No se publica ni puede ser requerida por un caso.
- `provisional`: se apoya en fuentes sanitarias oficiales, usa el criterio más
  conservador y se incluye tanto en producción como en los checks bloqueantes.
  Protege al usuario mientras queda claramente pendiente de revisión
  profesional.
- `approved`: un profesional sanitario ha revisado la regla. Debe registrar su
  rol y la fecha de revisión además de las fuentes e incertidumbre.

La aprobación del propietario del producto autoriza el cambio de software, pero
no transforma una regla provisional en clínicamente revisada. GYM-145 permanece
abierto hasta que el corpus obligatorio pase a `approved`; la protección
provisional puede desplegarse antes.

Para aprobar una regla, el revisor debe comprobar como mínimo el alcance, la
redacción obligatoria y prohibida, las señales de escalada, las fuentes y los
límites de certeza. Después se incrementa su versión, se cambia el estado, se
rellenan `reviewerRole` y `reviewedAt`, se actualiza el cambio de versión del
manifest y se vuelven a ejecutar todas las pruebas.

## Estructura

- `manifest.json`: versión de política, categorías y reglas publicables
  obligatorias; `currentRelease.changedRuleIds` determina los casos afectados.
- `rules.json`: reglas clínicas estructuradas y su estado de revisión.
- `cases/*.json`: entradas sintéticas, conductas esperadas, IDs de regla y
  procedencia sin datos personales.
- `schemas/*.schema.json`: contratos JSON bloqueantes.
- `llm-evaluation.json`: frontera manual/programada de las evals probabilísticas.
- `runtime.json`: clasificador local, respuestas seguras y overlay monotónico
  versionado. Su schema está en `schemas/runtime-policy.schema.json`.
- `examples/llm-evaluation-report.json`: forma versionada del informe LLM.
- `scripts/health-safety/fixtures/`: respuestas de proveedor falso, sin red.

Los casos declaran `requiredRuleIds` y `forbiddenRuleIds`. La suite calcula las
relaciones exclusivamente con esos IDs; no pide a un LLM que adivine qué caso
queda afectado.

## Editar y verificar

1. Editar la regla y sus casos en `policy/health-safety/`.
2. Incrementar las versiones correspondientes y declarar los IDs modificados en
   `manifest.currentRelease.changedRuleIds`.
3. Regenerar el bloque y el snapshot móvil:

   ```bash
   npm run sync:health-safety
   ```

4. Ejecutar la puerta y sus pruebas:

   ```bash
   npm run check:health-safety
   npm run test:health-safety
   npm test
   npm --workspace apps/mobile exec tsc --noEmit
   ```

`npm run check:health-safety` no usa red, claves ni proveedores reales. Falla
ante esquemas o referencias rotas, una regla obligatoria eliminada, categorías
sin cobertura, tools inexistentes, fixtures ausentes, patrones de exfiltración,
divergencia del bloque del prompt, snapshot móvil desactualizado o un informe
que intente autorizar. También imprime los casos afectados por los IDs de la
versión actual. GYM-144 debe invocar exactamente este comando en toda promoción.

`npm run report:health-safety` recorre los fixtures y emite un informe
determinista con `authorizing: false`. Admite `-- --output <ruta.json>` para
guardar el artefacto. El manifest de LLM reserva `npm run test:llm` para la
implementación de GYM-77/78; nunca es un check obligatorio de PR y no debe
recibir secretos al evaluar una contribución externa.

## Frontera de la garantía

La puerta demuestra de forma determinista que las reglas, el prompt, los casos,
los fixtures y ambos snapshots móviles son coherentes. En runtime, el
clasificador local intercepta riesgo alto o crítico antes del proveedor,
restringe tools por efecto, mantiene en buffer las consultas elevadas y valida
segmentos completos antes de mostrarlos. Si una salida coincide con una señal
de riesgo, la sustituye por una respuesta local que queda en el historial.

La evaluación adicional con el mismo proveedor BYOK es opcional, está
desactivada por defecto y requiere consentimiento versionado por proveedor.
Solo recibe el texto de la consulta ambigua: no recibe historial, fotos ni
memoria local. Un fallo o timeout conserva la decisión local y el buffer seguro.

El overlay remoto puede añadir señales o endurecer riesgo/permisos, pero no
rebajar la política compilada ni reemplazar sus mensajes. Una descarga, schema,
digest o versión inválidos cae a caché validada y después al snapshot integrado.
Estos patrones curados no demuestran equivalencia semántica arbitraria; por eso
la revisión profesional de GYM-145 sigue siendo una pista independiente.
