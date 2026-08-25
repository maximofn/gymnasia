---
type: instantánea de comportamiento en ejecución
title: Evidencia de ejecución de la automatización OpenWiki
description: Complemento de tiempo de ejecución, basado en una muestra LangSmith sesgada por anomalías, para priorizar cambios seguros en la automatización privada de OpenWiki.
tags: [runtime, langsmith, openwiki, observability, operations]
timestamp: 2026-08-25T11:34:50.802Z
openwiki:
  roles: [operations, testing, workflow]
  change_kinds: [observability, reliability]
  source_paths: [ops/openwiki-automation-template/.github/workflows/openwiki-update.yml, ops/openwiki-automation-template/scripts/classify-openwiki-error.mjs]
  symbols: [classifyOpenWikiError]
  test_paths: [ops/openwiki-automation-template/tests/classify-openwiki-error.test.mjs]
  invariants: [Las trazas no son tasas de población; los fallos de proveedor se clasifican sin exponer contenido de logs.]
  validation_commands: [npm --workspace ops/openwiki-automation-template test]
---

# Evidencia de ejecución de la automatización OpenWiki

Esta página complementa [Automatización privada de OpenWiki](openwiki-automation.md) con una instantánea de ejecución, no sustituye el código ni es un informe de rendimiento. Procede del último dump LangSmith disponible, obtenido el `2026-08-25T11:34:50.802Z`, para el proyecto `openwiki`. El muestreo es deliberadamente sesgado por anomalías: contiene 3 raíces `error`, 0 `outlier` y 1 `baseline`. Sus conteos **no** son tasas de error ni de latencia de la flota; la única referencia de operación normal es la mediana exclusiva de baseline.

Por privacidad, esta página no contiene entradas ni salidas de runs. Las URLs de traza se han omitido: no cambian una decisión de ingeniería y el dump es evidencia no confiable.

## Qué comprobar antes de interpretar trazas

1. El workflow `openwiki-update.yml` activa trazado para `LANGCHAIN_PROJECT: openwiki` y oculta inputs, outputs y metadata. Esto confirma la procedencia operativa, pero no permite inferir contenido de solicitudes.
2. El workflow clasifica el fallo del comando, no el de cada subrun. `classifyOpenWikiError` reconoce familias como OAuth y rate limit y las pruebas verifican que nunca imprima contenido de log.
3. La muestra registra una raíz `LangGraph`, capas `before_agent`, `model_request`, `ChatOpenAI` y, en la única baseline, herramientas de filesystem/conectores. No se usa esa forma para redescribir el montaje que ya está en el código; solo para contrastar límites y costes reales.

## Hallazgos y oportunidades de ejecución

1. **Prioridad máxima: el modelo bloqueó tres raíces antes de cualquier trabajo de herramientas.**
   - **Observado:** los 3 runs del bucket `error` terminaron en `ChatOpenAI`/`model_request`, con 0 tokens registrados. Dos llevan la firma `401` de token de autenticación expirado y uno `429` por límite de uso. Sus raíces duraron 734–1.515 ms; por ser el bucket de errores, esto no estima frecuencia poblacional.
   - **Correlacionado:** `openwiki-update.yml` restaura un estado OAuth cifrado antes de llamar a OpenWiki, y después clasifica `oauth` y `rate-limit` como categorías separadas. El modelo se invoca con `OPENWIKI_PROVIDER: openai-chatgpt`; el workflow ya detiene/marca una renovación OAuth fallida.
   - **Implicación para cambios:** antes de tocar herramientas, prompts, índices o rendimiento del agente, valide la cadena de restauración/renovación OAuth y el presupuesto del proveedor. Un cambio en clasificación debe conservar la distinción 401/OAuth frente a 429/cuota, porque su respuesta operativa es diferente.
   - **Hipótesis a verificar:** añadir telemetría saneada de la fuente de restauración (`artifact`, semilla o recuperación) y de la categoría final podría reducir el tiempo de diagnóstico sin revelar el error ni el token. Requiere revisar el contrato del informe y sus pruebas de no filtración.

2. **La ejecución normal muestreada contradice la suposición práctica de “una llamada de modelo por actualización”.**
   - **Observado:** la única raíz baseline correcta duró 286.767 ms (4 min 46,767 s), la mediana baseline de esta muestra. Registró varias llamadas exitosas `ChatOpenAI` de aproximadamente 6,6–7,1 s y rondas de herramientas; los tokens de raíz y de LLM aparecen como 0, por lo que esta muestra no permite atribuir coste de tokens ni calcular ratios. No hubo outliers no erróneos en el dump.
   - **Correlacionado:** el workflow da al job hasta 120 minutos y ejecuta un agente OpenWiki, no una única petición directa. Las herramientas observadas incluyen listados/lecturas de archivos y del conector, coherentes con una actualización que inspecciona evidencia antes de escribir.
   - **Implicación para cambios:** trate cualquier ajuste de agente, middleware, herramientas de filesystem o conectores como una modificación potencialmente multiplicativa de turnos, no como un coste fijo de una llamada. Mantenga el descubrimiento dirigido y las lecturas pequeñas; no justifique una optimización por tokens con este dump, porque la telemetría de tokens es cero.
   - **Hipótesis a verificar:** instrumentar conteos saneados por tipo de herramienta y número de llamadas de modelo por raíz permitiría detectar regresiones de exploración sin capturar contenido. Debe ser opcional y no sustituir las protecciones `LANGSMITH_HIDE_*`.

3. **No hay evidencia de que el middleware previo sea el cuello de botella de esta muestra.**
   - **Observado:** las capas previas al agente visibles en las tres raíces de error completaron en milisegundos antes del fallo de modelo; en baseline también precedieron al trabajo de modelo. No se observaron fallos de middleware, de herramientas ni reintentos de una herramienta tras una llamada inválida.
   - **Correlacionado:** el workflow puede desactivar LangSmith para un diagnóstico, pero no contiene un mecanismo de fallback de modelo. El clasificador de fallos sirve para una notificación segura, no para recuperar el run.
   - **Implicación para cambios:** no invierta primero en reordenar middleware o reescribir descripciones de herramientas basándose en esta muestra. Si se modifica la gestión de errores del modelo, pruebe que la salida sigue siendo una categoría saneada y que un fallo no abre un canal de logs.

## Coste y latencia observados en esta extracción

- **Baseline:** 1 raíz correcta; mediana de latencia de raíz 286.767 ms; mediana de tokens 0 (telemetría ausente/no registrada, no consumo nulo).
- **Errores:** 3 raíces, todas con 0 tokens registrados; 2 firmas de autenticación expirada y 1 de límite de uso. No hubo `outlier` no erróneo.
- **Herramientas:** solo se observaron en la baseline; la mayor parte del tiempo de esa raíz no puede atribuirse a una sola herramienta porque las llamadas de herramienta visibles fueron de decenas de milisegundos y hubo varias rondas de modelo.

Estos números son volátiles y deben refrescarse sin sobrescribir las conclusiones estructurales salvo que una muestra posterior las contradiga con evidencia suficiente.

## Validación y alcance

Para cambiar la automatización o el clasificador, ejecute primero:

```bash
npm --workspace ops/openwiki-automation-template test
```

Ejecutar el workflow remoto o publicar una PR es condicional: procede cuando se cambian credenciales/configuración de Actions, restauración OAuth, trazado, notificaciones o el comando de OpenWiki. El test local demuestra la clasificación y su privacidad; no demuestra que OAuth o cuota del proveedor estén disponibles. Consulte [Automatización privada de OpenWiki](openwiki-automation.md) para el ciclo de secretos/artefactos y [Compilación, publicación y pruebas](build-release-and-testing.md) para validaciones de la aplicación, que no quedan cubiertas por estas trazas.