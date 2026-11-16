# Pruebas del agente

La lógica determinista del agente vive en `apps/mobile/agent/`, separada del
runtime de Expo:

- `toolDefinitions.ts`: catálogo y schemas canónicos; de él se derivan los
  formatos de OpenAI, Anthropic y Google.
- `toolExecutor.ts`: despachador y handlers con almacenamiento, IDs y efectos
  externos inyectados.
- `providerToolLoop.ts`: ciclos `tool call → ejecución → resultado → siguiente
  ronda` de los tres proveedores.
- `toolBatch.ts`: ejecución compartida por los tres proveedores y por OpenAI
  compatible; limita las lecturas concurrentes y serializa las escrituras.
- `providerStreamParsers.ts`: parsers de los streams crudos de OpenAI,
  Anthropic y Google usados por la app y por las pruebas de integración.
- `chatSystemPrompt.ts`: validación y selección determinista de prompt remoto,
  caché o snapshot integrado; el adaptador Expo vive en
  `chatSystemPromptRuntime.ts`.
- `healthSafety.ts`: clasificador local, buffer de streaming, permisos de tools,
  respuestas seguras y merge monotónico del overlay remoto; el adaptador Expo
  vive en `healthSafetyRuntime.ts`.
- `personalData.ts`: higiene de forma del almacén de datos personales. Sanea
  cualquier entrada (almacén, argumento de tool, backup importado) preservando la
  clave literal, porque las tools de lectura casan por igualdad exacta.
- `sse.ts`: helpers puros para procesar eventos SSE y reproducir fixtures.

## Comandos

Desde la raíz:

```bash
npm test                                      # suite determinista
npm run check:health-safety                   # puerta sanitaria canónica
npm run test:health-safety                    # contratos, regresiones y propiedades sanitarias
npm run report:health-safety                  # informe de fixtures, authorizing=false
npm run test:deterministic                    # alias explícito de la anterior
npm run test:agent:e2e                        # app web + Playwright + OpenAI falso
npm --workspace apps/mobile exec tsc --noEmit # type-check
npm run test:llm                              # reserva para evals de LangSmith
```

`npm test` no usa red, claves ni modelos y es la única suite que bloquea CI.
Los `.sse` de `apps/mobile/agent/__fixtures__/raw/` reproducen de forma realista
el dialecto crudo de cada proveedor, pero no son capturas de APIs de pago. Las
pruebas recorren stream → parser de producción → tool → resultado → segunda
ronda. Los schemas también se someten a propiedades generativas con `fast-check`.
Cada regresión determinista nueva debe añadirse como fixture o caso unitario.

## Validación de argumentos de Coach

El despachador `createDetailedAgentToolExecutor` comprueba una sola vez los
argumentos contra el `inputSchema` canónico antes de entrar en el handler, también
en lecturas. Un fallo devuelve `invalid_tool_arguments`, una explicación de que
no se ejecutó la herramienta y una lista de campos y motivos. Su estado de efecto
es `no_effect`: no carga datos, resuelve catálogos, crea IDs ni escribe. El bucle
reinyecta ese resultado y permite corregir la llamada dentro del presupuesto de
rondas existente; no aborta el turno ni reintenta automáticamente la escritura.

El validador es propio, sin dependencias nuevas en React Native. Comprueba tipos,
campos requeridos propios del objeto, enums, límites numéricos, enteros, arrays y
objetos anidados. No transforma ni elimina argumentos. `null` no satisface un tipo
no nullable, tampoco en campos opcionales. Los campos extra se admiten si el
schema omite `additionalProperties` y se rechazan si declara `false`, tanto en la
raíz como en objetos anidados. Los nombres heredados como `constructor` nunca se
confunden con propiedades declaradas.

La validación de schema no sustituye las reglas de dominio: fechas civiles,
existencia de referencias, coherencia de series y contenido del JSON que ciertas
tools declaran como string siguen comprobándose en sus contratos. Las mediciones
de Coach deben enviar un objeto con números y las comidas deben coincidir con el
enum; no se convierte el JSON textual de una medición ni se normaliza una comida
antes de validar. Esto no cambia la importación de datos heredados.

OpenAI Responses recibe `strict: false` explícito en cada función. Si se omite,
el servicio puede normalizar el schema a modo estricto y convertir todos los
campos opcionales en obligatorios. En QA con `gpt-6-luna`, pedir solo un peso
provocó que rellenase las otras medidas con 0,01; el schema devuelto por OpenAI
confirmó `strict: true` y todas las medidas en `required`. El contrato debe
conservar sus campos opcionales y la validación local sigue siendo obligatoria.
La prueba de contrato y el E2E comprueban la configuración enviada por la app.
Referencia: https://developers.openai.com/api/docs/guides/function-calling.

OpenAI Responses y el proveedor compatible con OpenAI devuelven un error
recuperable cuando los argumentos no son un objeto JSON legible. Nunca los
convierten en `{}` para ejecutar una herramienta sin campos requeridos. El
estimador OpenAI comparte ese parser y también devuelve el error sin consultar
una herramienta ante JSON ilegible.

Las pruebas comparan el validador con Ajv (solo en tests), ejercitan argumentos
arbitrarios y comprueban los efectos del ejecutor. Los fixtures
`*-invalid-measurement-tool-call.sse` permiten verificar con los tres proveedores
el ciclo error → corrección → una sola escritura, incluyendo el flujo web E2E.

Revisión de privacidad: el inventario documenta estos errores técnicos enviados
al proveedor. No cambian terceros, categorías de datos, permisos, almacenamiento,
copias ni borrado; la política legal y las declaraciones de Play ya cubren los
resultados de herramientas y no requieren una nueva versión por este cambio.

La suite sanitaria vive en `policy/health-safety/` y
`scripts/health-safety/`. Sus fixtures representan respuestas explícitas de un
proveedor falso y verifican el cableado, los contratos y regresiones curadas;
no pretenden demostrar que cualquier respuesta de un modelo real sea segura.
Las reglas `provisional` ya bloquean CI y se publican en el prompt, aunque el
ticket no se considera clínicamente cerrado hasta su revisión profesional.

El E2E exporta la app web, abre Chromium, intercepta OpenAI, Anthropic y Google
con esos fixtures y verifica el flujo visible completo. También prueba la
selección remota, caché e integrada del system prompt, sus metadatos de traza y
que una emergencia produce una tarjeta local persistida sin una nueva petición
al proveedor ni ejecución de tools.
Es más lento y se ejecuta de forma explícita; no forma parte del CI determinista
que bloquea commits.

## Errores y recuperación de herramientas

GYM-42 (ticket para que Coach reconozca y gestione los errores de sus herramientas)
define un resultado local con `output` e `isError`. La marca nace en el ejecutor,
no del contenido: un campo de memoria puede contener JSON o la palabra «error»
sin cambiar el estado de la ejecución. El adaptador textual
`createAgentToolExecutor` conserva su API para consumidores que solo necesitan
texto; Coach usa `createDetailedAgentToolExecutor` y conserva la marca hasta el
proveedor. El diario de operaciones también conserva la marca de un error
posterior a una escritura confirmada, tanto en memoria como tras reiniciar.

El payload de fallo tiene `kind: tool_error`, versión 1, `is_error: true`,
`error`, `message`, `recovery` y `recoverable`. Los fallos de schema y dominio
permiten `correct_arguments`; una referencia inexistente o una lectura fallida
permiten `choose_alternative`. Una búsqueda vacía, una comida vacía o la
cancelación voluntaria son resultados normales, no excepciones. Los mensajes
de las excepciones, stacks y secretos técnicos nunca se incluyen en el payload.

La app no reintenta las herramientas automáticamente: devuelve el error al
modelo y deja que elija una llamada corregida dentro del presupuesto de diez
rondas. Anthropic recibe `tool_result.is_error: true`; Google Interactions recibe
`function_result.is_error: true`; OpenAI Responses y Chat Completions compatibles
reciben el payload JSON como texto. Los éxitos mantienen sus formatos actuales.

`stop_turn` termina localmente con `ToolTurnError`, antes de ejecutar las
herramientas restantes o pedir otra ronda. La interfaz muestra su mensaje
directamente, sin atribuirlo al proveedor. Un almacén inaccesible o un conflicto
que exige revisar los datos son irrecuperables en ese turno. Una escritura que
lanza fuera del handler o cuyo efecto no puede confirmarse conserva
`ToolOperationIndeterminateError`: la app no vuelve a intentar el turno aunque
el mensaje se parezca a un error de red. Los reintentos de transporte del
proveedor siguen usando el diario idempotente existente.

`providerToolErrors.test.ts` comprueba el contrato y las rutas de recuperación
en los tres proveedores, excepciones sin filtración de su texto, detención antes
de una segunda herramienta, JSON inválido de `write_measurement` corregido con
una sola escritura y contenido de usuario parecido al contrato. Las propiedades
generativas comprueban texto y JSON arbitrarios. El proveedor compatible con
OpenAI tiene integración equivalente en `customOpenAIChat.test.ts` y el diario
tiene una regresión de recuperación de la marca tras reiniciar.

El E2E web comprueba las marcas enviadas realmente por la app en la recuperación
de argumentos inválidos, el estado sin escritura antes de corregir y la medición
persistida después. Estos cambios no añaden controles ni estilos a la interfaz.

Revisión según `docs/legal/privacy-change-checklist.md`: se actualiza el
inventario para describir el contrato enviado a IA y la marca del diario. No
cambian destinos, categorías, permisos, copias ni borrado; los resultados de
herramientas ya están cubiertos por la política y las declaraciones de Play.
Los errores inesperados tienen menos detalle enviado que antes, por lo que no
se cambia ni republica el texto legal.

Referencias del contrato de proveedor:
[Anthropic](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls),
[Google Interactions](https://ai.google.dev/api/interactions-api#FunctionResultStep),
[OpenAI](https://developers.openai.com/api/docs/guides/function-calling#formatting-results).

## LangSmith

Se adopta el alcance A del ticket GYM-34: LangSmith se usará solo desde procesos
locales o CI para implementaciones y evals. La app móvil de producción no se
instrumenta y no contiene una API key de LangSmith, manteniendo el producto
local-first y sin backend.

Cuando se implemente la épica de observabilidad:

- los datasets de evals se crearán directamente en LangSmith, no como JSONs en
  el repositorio;
- las trazas reales se anonimizarán antes de convertirlas en fixtures
  deterministas;
- las evals usarán la integración de LangSmith con el runner, no un runner
  propio;
- sus tasas de acierto se informarán por separado y nunca convertirán
  `npm test` en una suite con red o coste.

La interfaz sanitaria para esos resultados está en
`policy/health-safety/llm-evaluation.json`. Todo informe LLM cumple el schema
versionado y conserva `authorizing: false`: puede aportar evidencia, pero nunca
aprobar una PR, fusionar o promover un artefacto.

## Plantilla de QA por ticket

Copiar esta lista al ticket y concretar los escenarios que apliquen:

```markdown
### QA manual
- [ ] Flujo feliz: [entrada, acción esperada y estado final]
- [ ] Cancelación/error: [fallo o acción del usuario y recuperación esperada]
- [ ] Persistencia: [qué debe mantenerse tras cambiar de pantalla o reiniciar]
- [ ] Tools: [tools esperadas, orden y tools que no deben llamarse]
- [ ] Proveedores: [OpenAI / Anthropic / Google que deben probarse]
- [ ] UX: respuesta comprensible, una sola confirmación y estados de carga claros
- [ ] Regresión: [bug o flujo vecino que no debe romperse]
```

Una sesión exploratoria debe anotar fecha, build/commit, proveedor/modelo,
escenarios recorridos y hallazgos. Cada hallazgo determinista se convierte en
test de regresión; si depende del comportamiento del modelo pasa al dataset de
evals.

Bloquean el cierre: suite determinista o type-check en rojo, pérdida/corrupción
de datos, tool equivocada con efecto de escritura, error no controlado, flujo
crítico imposible o incumplimiento de seguridad/privacidad. Un problema menor
de texto o una variación no determinista del modelo puede registrarse como
deuda con ticket y evidencia, siempre que el flujo siga siendo seguro y útil.

## Plan de pruebas obligatorio en Linear

Todo ticket nuevo debe evaluar estas seis categorías en su descripción, aunque
la conclusión sea `No aplica: <motivo>`: unitarios, E2E, integración con
proveedor falso, contrato, regresión y fuzzing / property-based. El comando
`linear.py create` valida la sección `## Plan de pruebas` antes de llamar a la
API para evitar que esta decisión dependa de la memoria de quien crea el ticket.
