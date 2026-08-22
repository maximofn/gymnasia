# Pruebas del agente

La lógica determinista del agente vive en `apps/mobile/agent/`, separada del
runtime de Expo:

- `toolDefinitions.ts`: catálogo y schemas canónicos; de él se derivan los
  formatos de OpenAI, Anthropic y Google.
- `toolExecutor.ts`: despachador y handlers con almacenamiento, IDs y efectos
  externos inyectados.
- `providerToolLoop.ts`: ciclos `tool call → ejecución → resultado → siguiente
  ronda` de los tres proveedores.
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
