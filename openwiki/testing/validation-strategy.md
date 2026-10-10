---
type: estrategia de validación
title: Estrategia de pruebas y matriz mínima de validación
description: Guía para elegir la combinación mínima de suites deterministas, contratos, propiedades, E2E, controles de deriva y gates de release según el cambio y el riesgo que introduce.
tags: [testing, validation, ci, e2e, release]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-29T10:57:35.679Z
sources:
  - id: openwiki-source-338e77d1d6cb373155f08ceb
    resource: repo://.github/workflows/agent-tests.yml
  - id: openwiki-source-0b86c93537ee4ff0031996d7
    resource: repo://.github/workflows/build-apk.yml
  - id: openwiki-source-3c34e9e772c8ec0511019e4d
    resource: repo://.github/workflows/catalog-tests.yml
  - id: openwiki-source-8f8290041af6790179e59245
    resource: repo://.github/workflows/prompt-policy.yml
  - id: openwiki-source-55b47047858a54c7b0672bfd
    resource: repo://apps/feedback-worker/test/fakeDatabase.ts
  - id: openwiki-source-6d7564f0e0aa6f62af1483c2
    resource: repo://apps/feedback-worker/test/fuzz.test.ts
  - id: openwiki-source-3cfa88bf1d888145532ec324
    resource: repo://apps/feedback-worker/test/handler.test.ts
  - id: openwiki-source-4ef97b587acb035394d7eacd
    resource: repo://apps/feedback-worker/vitest.config.mts
  - id: openwiki-source-c65a19b98fa314cba98ace44
    resource: repo://apps/mobile/agent/providerPipeline.test.ts
  - id: openwiki-source-4ba305577af520f09a21664c
    resource: repo://apps/mobile/agent/toolDefinitions.test.ts
  - id: openwiki-source-e86fe7b76c693666bc2cb828
    resource: repo://apps/mobile/package.json
  - id: openwiki-source-229791acb3b83ab8fa63ffe5
    resource: repo://apps/mobile/scripts/agent-chat.e2e.mjs
  - id: openwiki-source-bd210931c947e300164b7a63
    resource: repo://apps/mobile/scripts/catalogs.e2e.mjs
  - id: openwiki-source-ca9d8aba8612e46df10beb95
    resource: repo://apps/mobile/scripts/measurement-performance.e2e.mjs
  - id: openwiki-source-c881f32382e67702056eb523
    resource: repo://apps/mobile/scripts/run-llm-evals.mjs
  - id: openwiki-source-aaa730fe014abc68d7131151
    resource: repo://apps/mobile/training/seriesContract.property.test.ts
  - id: openwiki-source-8899fbcb52b1d704245f96cc
    resource: repo://apps/mobile/vitest.config.mts
  - id: openwiki-source-966a246ce45c6f92539f2480
    resource: repo://docs/testing/agent-testing.md
  - id: openwiki-source-d86bf6a65dea6635c781c3f4
    resource: repo://docs/testing/google-interactions.md
  - id: openwiki-source-f6c7dbf6f9d555fd08b4d438
    resource: repo://docs/testing/measurement-performance.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-869bed5ee1bbd205948cf49e
    resource: repo://scripts/catalogs/catalogs.test.mjs
  - id: openwiki-source-2cc0790639fb245db6d26267
    resource: repo://scripts/catalogs/generate.mjs
  - id: openwiki-source-92ee27e969d35b12e4aae573
    resource: repo://scripts/data-inventory/check.mjs
  - id: openwiki-source-f807c3c379c670c5871c2b49
    resource: repo://scripts/data-inventory/inventory.mjs
  - id: openwiki-source-61e696ba1387a574d3f42c7f
    resource: repo://scripts/health-safety/check.mjs
  - id: openwiki-source-7ed64eca70bf77df500e0252
    resource: repo://scripts/health-safety/policy.test.mjs
  - id: openwiki-source-3a6fcd656a0c5c85a01f8e48
    resource: repo://scripts/mobile-boundaries/check.mjs
  - id: openwiki-source-6f9dc1fe6ee9c17751b010df
    resource: repo://scripts/mobile-boundaries/policy.json
  - id: openwiki-source-24a206e2ad72f4f0a1502c09
    resource: repo://scripts/production-release/production-release.mjs
  - id: openwiki-source-a43fcdd54439cd4258ab69e4
    resource: repo://scripts/production-release/verify-artifact.mjs
  - id: openwiki-source-ccd3d9e4de4c353ab98fedd2
    resource: repo://scripts/production-release/verify-source.mjs
generated: { by: "openwiki/0.6.0", at: "2026-09-29T10:57:35.679Z" }
---

# Estrategia de pruebas y matriz mínima de validación

La validación se organiza por **riesgo**, no por directorio. Un cambio puede necesitar varias capas: una prueba pura para el comportamiento, un contrato para la frontera entre componentes, un check para detectar artefactos generados obsoletos y un E2E para demostrar que la interfaz realmente conecta todo. Ninguna capa sustituye por sí sola a las demás.

Como regla de selección:

1. empieza por la suite determinista más cercana al dato o función modificados;
2. añade un contrato si cambian schemas, formatos persistidos, tools, proveedores o límites entre capas;
3. añade propiedades cuando el espacio de entradas es grande o hay invariantes de normalización, orden, idempotencia o límites;
4. ejecuta el check de generación o privacidad que corresponda si una fuente canónica tiene copias o declaraciones derivadas;
5. añade el E2E visible más estrecho que atraviese el cableado modificado;
6. reserva dispositivo real, servicios reales y evaluación con modelos para lo que los dobles no pueden demostrar.

<!-- openwiki: broken internal link [/openwiki/quickstart.md] file "/openwiki/quickstart.md" does not exist. Fix the href or restore the target, then delete this comment. -->
Véanse también [el bucle del agente](/openwiki/architecture/agent-loop.md), [los contratos de dominio](/openwiki/concepts/domain-contracts.md), [la publicación Android](/openwiki/operations/android-release.md) y [el arranque del repositorio](/openwiki/quickstart.md).

## Capas de evidencia

### 1. Suite determinista de la app

```bash
npm test
npm --workspace apps/mobile exec tsc --noEmit
```

`npm test` encadena la suite Vitest móvil, el guard rail del almacén de desarrollo y las pruebas de límites arquitectónicos. Vitest corre en `node`, restaura mocks entre casos e incluye `agent`, `backup`, `catalogs`, `diet`, `measurements`, `persistence`, `platform`, `shell`, `storage` y `training`. Es la primera opción para reglas de dominio, migraciones, persistencia, parsers, estado y errores reproducibles. El type-check es complementario: detecta desacuerdos estáticos, no comportamiento.

Dentro de esta capa conviven tres técnicas:

- **Casos y regresiones deterministas**: ejemplos concretos, incluidos fallos previamente observados.
- **Contratos**: comprueban que dos lados de una frontera siguen de acuerdo. Por ejemplo, el catálogo canónico de tools debe coincidir exactamente con el ejecutor y proyectarse completo a OpenAI, Anthropic y Google; otros contratos inspeccionan estructura de UI, configuración o artefactos generados.
- **Propiedades con `fast-check`**: exploran entradas arbitrarias y protegen invariantes como «no lanza», idempotencia, unicidad, orden o conservación durante una normalización. Los casos sensibles fijan semilla y número de ejecuciones para que un fallo sea reproducible.

Las propiedades amplían la cobertura de entradas, pero no prueban que la UI invoque la función correcta. Los contratos detectan deriva de forma, pero no sustituyen un escenario de negocio. Un test unitario verde tampoco demuestra el comportamiento de React Native, Android ni un proveedor real.

### 2. Integración determinista del agente

Los tests del agente reproducen el flujo `stream → parser de producción → ejecución de tool → resultado → ronda siguiente` para los tres proveedores. Los ficheros `.sse` de `apps/mobile/agent/__fixtures__/raw/` son **fixtures sintéticos y revisables; no son capturas de APIs de pago**. Se fragmentan con distintos tamaños para ejercitar límites de red y UTF-8 sin red, claves ni coste.

Esta capa es adecuada para:

- lifecycle y truncado de streams;
- correlación de llamadas y resultados;
- argumentos y schemas de tools;
- replays, reintentos e idempotencia de efectos;
- presupuestos de contexto y errores anteriores a abrir la red;
- equivalencia de adaptadores de proveedor.

No demuestra que el proveedor conserve hoy el mismo dialecto, que una clave real funcione ni que el transporte nativo se comporte como Chromium. Una desviación real debe convertirse, una vez anonimizada, en fixture mínimo de regresión.

### 3. Checks de deriva, generación, límites y privacidad

Los comandos `check:*` comparan una fuente canónica con sus consumidores o artefactos versionados. Se usan cuando «regenerar» podría ocultar un cambio no revisado: primero se ejecuta el check; después, si el cambio es intencional, se ejecuta el correspondiente `sync:*` o generador `--write`, se revisa el diff y se repite el check.

Controles especialmente relevantes:

| Control | Protege | No prueba |
| --- | --- | --- |
| `npm run check:chat-prompt` | Paridad entre `prompts/AGENTS.md` y el snapshot móvil | Calidad de una respuesta de modelo |
| `npm run check:health-safety` + `npm run test:health-safety` | Schemas, referencias, tools, bloque administrado, snapshots de prompt/runtime, fixtures sanitarios y propiedades de fallo cerrado | Seguridad de toda salida posible de un LLM ni revisión clínica |
| `npm run check:prompt-policy` + `npm run test:prompt-policy` | Artefactos de política y flujo de promoción firmado | Autorización para promover por sí solo |
| `npm run check:catalogs` + `npm run test:catalogs` | Schemas, IDs, imágenes, agregados, paginación y deriva de archivos generados | Consumo visible en la app; para ello está `test:catalogs:e2e` |
| `npm run check:data-inventory` + `npm run test:data-inventory` | Correspondencia entre inventario publicable, claves literales, hosts HTTPS y permisos declarados | Tráfico dinámico construido sin literales ni contenido exacto enviado |
| `npm run check:legal` + `npm run test:legal` | Copia legal generada y sus contratos | Que las páginas sean accesibles y legibles en el bundle; para ello está `test:privacy:e2e` |
| `npm run check:mobile-boundaries` + `npm run test:mobile-boundaries` | Clasificación por capas, dependencias permitidas, entradas públicas, imports externos prohibidos, ciclos y excepciones heredadas obsoletas | Corrección funcional de los módulos |
| `npm run check:android-permissions` / `check:android-native-config` y sus tests | Política de permisos y configuración nativa generada | Manifest fusionado y comportamiento del APK ya compilado |

El inventario de datos escanea TypeScript de producción, excluye tests y comentarios, y falla tanto por elementos no declarados como por declaraciones obsoletas. También cruza el impacto de Data safety con la política de permisos Android. Por eso un cambio de almacenamiento, endpoint o permiso exige revisar juntos inventario, política legal, borrado y recuperación; pasar solo `npm test` no cubre esa deriva.

### 4. E2E web explícitos

Los scripts `apps/mobile/scripts/*.e2e.mjs` exportan la app web, la sirven en loopback y usan Playwright/Chromium. Normalmente siembran almacenamiento y sustituyen red o proveedores con rutas locales. Prueban navegación, wiring, persistencia y resultados visibles con mucha más fidelidad que una unidad, pero **siguen siendo web**.

Los recorridos principales se invocan de forma explícita:

```bash
npm run test:agent:e2e
npm run test:catalogs:e2e
npm run test:storage-recovery:e2e
npm run test:data-deletion:e2e
npm run test:privacy:e2e
npm run test:health-safety:e2e
npm run test:train:e2e
npm run test:measurements:performance:e2e
```

Hay E2E más estrechos para navegación, preferencias, dieta y operaciones o migraciones de series; selecciónalos cuando el cambio toque ese flujo en vez de ejecutar indiscriminadamente todo el directorio. Para depuración visual, varios scripts aceptan una variable `*_HEADLESS=0`; algunos también permiten reutilizar una exportación o URL ya servida.

`test:agent:e2e` recorre por defecto OpenAI, Anthropic y Google con claves y respuestas falsas, intercepta servicios externos y verifica el flujo visible. `test:catalogs:e2e` es excepcionalmente parte del workflow de integridad de catálogos. `test:dev-store:e2e` también se ejecuta en el workflow determinista. Los demás E2E son explícitos durante desarrollo, salvo cuando un gate de release los vuelva a ejecutar: la fuente de Production incluye `test:agent:e2e` y `test:train:e2e`.

Un E2E web no demuestra XHR incremental de React Native, permisos, notificaciones, rendimiento del teléfono, integración del manifest ni disponibilidad de un tercero. Para Google Interactions existe un servidor local de fixtures que puede recorrerse en Android con `adb reverse`; usa una clave ficticia y solo se habilita en Development. Un cambio en transporte nativo no se cierra únicamente con Chromium.

### 5. Worker de feedback

```bash
npm --workspace apps/feedback-worker run test
```

La suite del Worker ejecuta Vitest en Node, reemplaza `fetch` y usa un doble en memoria de D1 que reconoce las consultas esperadas. Cubre el esquema cerrado, saneado y redacción de secretos, CORS, rutas y métodos, idempotencia por clave y contenido, estados `pending`/`created`, fallo del upstream, rate limiting con HMAC, interruptor de disponibilidad y retención programada. Las propiedades verifican que validación y saneado no lancen ante entradas arbitrarias, respeten límites y sean idempotentes.

El doble de D1 falla de forma ruidosa ante SQL no reconocido, lo que protege la coordinación entre almacenamiento y handler. Sin embargo, esta suite no valida migraciones contra D1 real, límites de Cloudflare, secretos desplegados, cron efectivo ni permisos reales sobre GitHub. Un cambio de infraestructura necesita además migración local/remota controlada, smoke de `/health` y una operación reversible en el entorno correspondiente.

### 6. Evals con coste y LangSmith

```bash
npm run test:llm
```

Este entrypoint está reservado para la integración de evals de LangSmith. Las evals con un modelo real miden comportamiento no determinista que no puede fijarse como fixture —por ejemplo calidad o robustez semántica— y deben reportarse separadas de la suite sin red.

Tres límites son invariantes:

- una eval de LangSmith **no autoriza** una PR, una promoción ni un artefacto;
- todo informe sanitario LLM conserva `authorizing: false`;
- la app móvil de Producción **no lleva instrumentación ni API key de LangSmith**: la ejecución pertenece a procesos locales o CI.

Por tanto, una eval cara aporta evidencia informativa. Si revela un caso determinista, ese caso debe bajar a contrato, fixture o regresión reproducible.

### 7. QA manual y dispositivo real

La QA manual se usa para observables que las capas anteriores no representan: tacto y fluidez, teclado y safe areas, permisos del sistema, notificaciones, lifecycle en segundo plano, transporte nativo, integración con archivos/fotos, accesibilidad y comportamiento de una build instalada.

Registra siempre fecha, commit, versión/build, plataforma/dispositivo, configuración de proveedor, datos iniciales, pasos y resultado. Como mínimo recorre flujo feliz, error/cancelación, persistencia tras reinicio, efectos de escritura esperados y no esperados, y un flujo vecino. Un hallazgo reproducible se convierte en test; uno dependiente del modelo pasa al dataset de evals.

No presentes un benchmark sintético de Node o Chromium como medida del teléfono. La regresión de medidas, por ejemplo, combina contadores E2E sobre 1.826 fechas con validación cualitativa en APK; el test automático detecta recálculos, mientras que el dispositivo confirma la fluidez percibida.

## Qué bloquea y cuándo

### CI bloqueante de PR/main

No existe un único comando que describa todos los workflows. El bloqueo depende de las rutas y de las reglas remotas:

- `agent-tests.yml` ejecuta checks de prompt y salud, `npm test`, límites móviles, `test:dev-store:e2e`, Worker, automatización OpenWiki, pruebas de release, type-check, controladores Android y proxy;
- `catalog-tests.yml` ejecuta `check:catalogs`, `test:catalogs` y `test:catalogs:e2e` cuando cambian fuentes o consumidores del catálogo;
- `prompt-policy.yml` vuelve a comprobar versión, políticas y artefactos generados, permisos/configuración Android, salud, inventario, legal, suite determinista y TypeScript.

Que un workflow no se dispare para una ruta no convierte el cambio en seguro: la matriz siguiente es la obligación del autor y evita depender solo de filtros de paths.

### E2E explícitos

Son los Playwright seleccionados por flujo. Pueden ser requeridos por el cambio aunque no aparezcan en el workflow de PR. Conserva el comando y el resultado en el ticket o PR; usa modo headed para investigar, no como sustituto de una aserción estable.

### Evals con coste

Se ejecutan conscientemente, con credenciales y presupuesto fuera de la suite determinista. Son informativas y no autorizadoras.

### QA manual

Es evidencia humana sobre build y dispositivo concretos. No debe compensar tests deterministas rojos, pérdida/corrupción de datos, una tool de escritura equivocada, un fallo de privacidad/seguridad o un flujo crítico imposible.

## Matriz mínima cambio → comandos → riesgo cubierto

La tabla indica el **mínimo de partida**; añade filas vecinas cuando el cambio atraviese más de una frontera.

| Cambio | Comandos mínimos | Riesgo cubierto / ampliación necesaria |
| --- | --- | --- |
| Regla pura de dominio, normalización o migración móvil | `npm test`; `npm --workspace apps/mobile exec tsc --noEmit` | Resultado, regresiones, propiedades y tipos. Añade el E2E del flujo si cambia persistencia o presentación. |
| Tool, schema, parser, bucle o transporte del agente | `npm test`; `npm --workspace apps/mobile exec tsc --noEmit`; `npm run test:agent:e2e` | Paridad schema↔ejecutor↔proveedores, streams, efectos y wiring visible. Añade Android con fixture para transporte nativo y eval solo si la pregunta es semántica. |
| Prompt o política sanitaria | `npm run check:health-safety`; `npm run test:health-safety`; `npm run check:chat-prompt`; `npm test` | Deriva de snapshots, referencias, tools, fixtures y fallo cerrado. Requiere revisión profesional para afirmar aprobación clínica; una eval no autoriza. |
| Almacenamiento, backup, recuperación o borrado | `npm test`; `npm run check:data-inventory`; `npm run test:data-inventory`; `npm run test:storage-recovery:e2e`; `npm run test:data-deletion:e2e` | Compatibilidad, recuperación, eliminación efectiva e inventario. Añade `check:legal`/`test:privacy:e2e` si cambia lo declarado al usuario. |
| Endpoint, tercero, dato enviado o permiso | `npm run check:data-inventory`; `npm run test:data-inventory`; `npm run check:legal`; `npm run test:legal`; `npm run test:privacy:e2e` | Deriva de privacidad/Data safety y publicación legible. Para permisos añade checks Android y verifica el artefacto fusionado. |
| Catálogo, imagen o consumidor de catálogo | `npm run check:catalogs`; `npm run test:catalogs`; `npm run test:catalogs:e2e` | Schema, IDs, MIME/ratio, huérfanos, generación estable y consumo sin servicios externos. |
| Capas, imports o nuevo módulo móvil | `npm run check:mobile-boundaries`; `npm run test:mobile-boundaries`; `npm --workspace apps/mobile exec tsc --noEmit` | Dependencias, entradas públicas, ciclos e imports de plataforma. No cubre comportamiento: añade la suite del dominio. |
| Worker de feedback, contrato HTTP, saneado o SQL | `npm --workspace apps/feedback-worker run test`; `npm run test:agent:e2e` si cambia el cliente móvil | Handler, D1 simulado, redacción, deduplicación, límites y fallos. Añade migración/smoke del entorno para D1, cron o GitHub reales. |
| Entrenamiento o formato de series | `npm test`; el E2E de entrenamiento más próximo (`test:train:e2e`, migración, operaciones, compuesto o historial) | Invariantes del contrato y recorrido visible. Ejecuta varios solo si se comparte persistencia o transacción. |
| Rendimiento de medidas o render raíz | `npm test`; `npm run test:measurements:performance:e2e`; QA en APK | Equivalencia del cálculo y ausencia de recálculos ante interacciones vecinas; el APK cubre fluidez real. |
| Configuración Android, permisos o release | checks/tests de permisos y configuración; `npm run test:production-release` | Política y controlador. La publicación debe pasar `verify:production-source`, compilación aislada y `verify:production-artifact`; termina con smoke/QA de la build. |

## Gate de Production

La publicación Android no confía únicamente en los resultados anteriores. `verify:production-source` valida el SHA exacto, procedencia y controles remotos, ejecuta secuencialmente todos los `PRODUCTION_GATES` y falla si cualquier gate modifica el checkout. Esa lista incluye políticas, permisos, configuración nativa, salud, inventario, legal, snapshot, `npm test`, TypeScript, export Android y los E2E de agente y entrenamiento.

La compilación usa el SHA validado y entradas de política inmutables. El APK resultante se descarga a cuarentena y `verify:production-artifact` inspecciona manifest, firma/certificado, paquete, versiones, SDK, permisos, sonidos, tamaño, hash, MIME, configuración embebida, snapshot de política y progresión respecto al APK anterior. Solo después se adjuntan el binario y la cadena de evidencias y se publica el draft. Un fallo conserva la transacción para un reintento manual motivado; no convierte un artefacto parcial en release.

Estos gates prueban identidad e integridad de fuente y artefacto, no experiencia física en todos los dispositivos. La autorización operativa, el entorno Production y la QA final siguen siendo límites separados.
