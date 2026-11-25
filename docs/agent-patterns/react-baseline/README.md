# Línea base ReAct de Coach

Resultados de la batería de tareas de referencia de GYM-26 (ticket para estudiar el
patrón ReAct de planificación paso a paso). Coach ya es un agente ReAct: piensa,
llama a una tool, lee el resultado y decide el siguiente paso, sin un plan previo.
Estas cifras son la referencia contra la que se compararán los demás patrones de
GYM-25 (ticket que agrupa los patrones de planificación de agentes).

## Cómo se midió

- **Dónde:** la web publicada (<https://gymnasia.maximofn.com>, versión 1.64.0), con
  el código real y la clave BYOK del mantenedor. 25 de noviembre de 2026.
- **Modelo:** `gpt-6-luna` (OpenAI), razonamiento por defecto, todas las tools de Coach.
- **Datos:** inventados y siempre los mismos. `make-seed.ts` los genera y los valida
  con el normalizador de la app: 3 rutinas, 12 entrenos en 4 semanas, 7 días de dieta
  más el desayuno de hoy y 6 pesajes. Antes de cada intento se restauraban esos datos,
  se vaciaba el registro de operaciones y los datos personales, y se recargaba la app.
  Cada intento empieza en una conversación nueva.
- **Tareas:** las 12 de `tasks.json`, 3 repeticiones cada una (36 conversaciones).
- **Métricas:** las trazas `toolLoop` de la app (vueltas, tokens, tamaño del contexto,
  tiempos, resultado de cada llamada; ver `docs/testing/tool-loop-metrics.md`).
- **Argumentos:** capturados desde el navegador leyendo las peticiones al proveedor,
  solo para esta batería. La app no los guarda.
- **Corrección:** se comprobó el estado guardado tras cada intento, no solo el texto,
  y las cifras de las respuestas contra los datos inventados.

`results.json` tiene cada intento con sus métricas, sus llamadas y sus argumentos.

## Resultados

| Tarea | Correctas | Vueltas | Llamadas | Tokens entrada | Tokens salida | Contexto final (car.) | Tiempo (s) |
|---|---|---|---|---|---|---|---|
| T01 rutina de empuje | 3/3 | 2.0 | 1.0 | 23.483 | 105 | 10.735 | 4.2 |
| T02 progreso en press banca | 0/3 | 2.7 | 1.7 | 31.150 | 310 | 12.236 | 4.7 |
| T03 cambiar un ejercicio | 3/3 | 4.3 | 4.0 | 59.838 | 440 | 24.752 | 10.6 |
| T04 crear rutina de tirón | 3/3 | 5.0 | 6.7 | 65.381 | 867 | 26.481 | 13.3 |
| T05 calorías y proteína de la semana | 3/3 | 2.0 | 1.0 | 21.383 | 138 | 2.799 | 5.1 |
| T06 añadir tres alimentos | 3/3 | 4.0 | 5.0 | 56.382 | 382 | 26.544 | 6.5 |
| T07 corregir el desayuno | 3/3 | 3.0 | 3.0 | 32.380 | 205 | 5.285 | 4.9 |
| T08 copiar la comida de ayer | 2/3 | 1.7 | 0.7 | 17.826 | 188 | 3.029 | 3.2 |
| T09 registrar peso y cintura | 3/3 | 2.3 | 1.3 | 24.635 | 122 | 2.877 | 3.1 |
| T10 tendencia del peso | 3/3 | 2.0 | 1.0 | 21.493 | 125 | 3.190 | 3.2 |
| T11 proteína según el peso (mixta) | 3/3 | 4.3 | 5.7 | 52.897 | 1.311 | 25.437 | 13.4 |
| T12 resumen semanal y pesaje (mixta) | 3/3 | 3.3 | 5.3 | 37.452 | 692 | 11.022 | 8.4 |
| **Media de los 36 intentos** | **32/36** | **3.1** | **3.0** | **37.025** | **407** | **12.866** | **6.7** |

Valores medios de las 3 repeticiones. «Vueltas» cuenta las peticiones al modelo,
incluida la que da la respuesta final.

- **109 llamadas a tools, ninguna fallida.** Ningún argumento inválido, ninguna tool
  inventada, ninguna consulta repetida bloqueada.
- **Nunca se acercó al tope.** Máximo 5 vueltas de las 10 permitidas; ninguna
  respuesta terminó por límite.
- Las 4 respuestas «incorrectas» no son fallos del bucle: 3 son una limitación de una
  tool (T02) y 1 es una pregunta de aclaración razonable (T08).

## Qué se aprende

1. **El coste lo marca el prefijo fijo, no el razonamiento.** Cada vuelta reenvía las
   instrucciones y el catálogo de tools: unos 10.500 tokens de entrada antes de que
   haya conversación. En una tarea de 5 vueltas, unos 52.000 de los ~65.000 tokens de
   entrada son ese prefijo repetido. La salida es pequeña (media de 407 tokens). Un
   patrón que reduzca vueltas ahorra sobre todo prefijo; la caché de prompts del
   proveedor ataca el mismo coste sin cambiar de patrón.
2. **El modelo ya agrupa llamadas.** Lanza varias tools independientes en la misma
   vuelta: 4 búsquedas de ejercicios a la vez (T04), las tres lecturas de T11, o leer y
   escribir en una sola vuelta (T12). Es un plan implícito: lo que Plan-and-Execute o
   ReWOO harían explícito, aquí ya ocurre en parte.
3. **Las vueltas extra vienen de observaciones que obligan a replanificar.** En T04 y
   T06 la vuelta adicional aparece cuando una búsqueda no devuelve nada (`face pull`,
   `pájaros`) o devuelve algo dudoso (`arroz blanco cocido`) y el modelo reformula. Es
   justo la ventaja de ReAct: un plan cerrado de antemano habría fallado ahí.
4. **Variación entre repeticiones.** La misma tarea cambia de 3 a 5 vueltas según si el
   modelo agrupa o no (T03: lectura y búsqueda juntas o por separado), y T08 pidió
   aclaración en 1 de 3 intentos.
5. **Llamadas innecesarias.** `list_personal_data_keys` aparece en 6 intentos, casi
   siempre sin que la tarea lo necesite, y `save_personal_data` guarda en 3 intentos un dato que nadie pidió
   guardar (T11 y T12). No rompen nada, pero son escrituras sin petición del usuario.

## Problemas encontrados en las tools

- **El historial no expone el peso por ejercicio.** `read_workout_history` devuelve
  volumen y repeticiones por sesión, aunque la app guarda la prescripción completa de
  cada entreno. Coach no puede responder «¿cuánto he subido en press banca?» y lo
  reconoce en los 3 intentos.
- **El objetivo de proteína configurado no se usa.** Los datos tienen un objetivo de
  2 g/kg (unos 158 g al día con 78,9 kg). En T11 Coach no lo consultó y usó una
  referencia propia de 1,2–1,6 g/kg. Añadió el yogur, que era lo correcto con cualquiera
  de las dos referencias, pero la explicación no refleja el objetivo del usuario.
- **Argumento doblemente codificado.** En T11 el modelo pasó `data` de `add_meal_food`
  como texto JSON dentro de un texto. La app lo aceptó y escribió bien.

## Reproducir

```bash
node_modules/.bin/tsx docs/agent-patterns/react-baseline/make-seed.ts 2026-11-25 > seed.json
```

Las fechas de los datos son relativas al día que se pasa. Para comparar otro patrón,
usar las mismas tareas, los mismos datos y el mismo modelo, y medir con las mismas
trazas `toolLoop`.
