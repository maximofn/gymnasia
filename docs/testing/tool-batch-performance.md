# Lecturas concurrentes de Coach

GYM-43 (ticket para ejecutar en paralelo tools independientes) permite solapar
hasta cuatro lecturas consecutivas de un mismo turno. El catálogo canónico ya
declara `effect`; el planificador comparte esa fuente de verdad y trata una tool
desconocida como una barrera. No intenta inferir independencia del texto del
modelo ni añade dependencias o servicios.

## Qué se puede solapar

| Efecto | Tools | Ejecución |
| --- | --- | --- |
| Lectura | `list_personal_data_keys`, `read_field_description`, `read_field_value`, `read_measurement`, `read_meal_foods`, `search_foods`, `search_exercises`, `read_routines` | Grupos consecutivos, hasta cuatro activas |
| Escritura local | `save_personal_data`, `write_measurement`, `add_meal_food`, `create_routine` | Una cada vez, esperando todas las anteriores |
| Escritura externa | `create_feature_issue` | Una cada vez, incluyendo su confirmación |
| Desconocida | Cualquier nombre fuera del catálogo | Barrera; el ejecutor conserva su validación |

La secuencia lectura, lectura, escritura, lectura primero drena las dos
lecturas, después espera la escritura completa y solo entonces inicia la última
lectura. Incluso escrituras sobre recursos distintos se serializan: con el
catálogo actual no compensa introducir un grafo de conflictos. La barrera
conserva el orden de ejecución previo; la frescura de los datos sigue siendo
responsabilidad del handler y de su almacén.

Los adaptadores asignan identificadores y ocurrencias en el orden del proveedor
antes de arrancar el lote. Los resultados se guardan por índice y se devuelven
en ese mismo orden, aunque la tercera lectura termine primero. Se conserva el
historial, las firmas de pensamiento, el diario idempotente y la protección
frente a IDs repetidos. OpenAI Responses, Anthropic, Google Interactions y el
adaptador compatible con OpenAI usan el mismo planificador.

Un error recuperable sigue siendo un resultado marcado y no cancela sus
hermanas. Un error fatal detiene el lanzamiento de nuevas lecturas, espera las
ya activas y termina el turno antes de una escritura posterior o una nueva
petición al proveedor. Si varias lecturas fallan fatalmente, se propaga la
primera por posición original. Las escrituras inciertas siguen sin reintento.

Se mantiene la posibilidad de que el proveedor emita varias llamadas en una
ronda. Desactivarla obligaría a obtener las lecturas mediante más viajes al
modelo y tampoco sustituiría la protección de los efectos en el dispositivo.
El cliente decide qué ejecución puede solapar; no cambian los schemas enviados.

## Qué supone para el móvil

No se crean threads ni workers. JavaScript sigue ejecutando el trabajo síncrono
en su hilo; se solapan esperas de almacenamiento o red. `search_foods` filtra en
memoria, de modo que su cálculo no se reparte entre núcleos. El mayor beneficio
esperable está en lecturas que esperan catálogos sin caché. Cuatro es un límite
conservador de tools activas, pendiente de perfilado nativo: no es una cifra
deducida de una prueba de batería ni limita las peticiones internas de cada
tool. Una sola búsqueda de ejercicios puede descargar varias páginas.

## Comparación reproducible en la app web

El script `apps/mobile/scripts/tool-batch.performance.e2e.mjs` utiliza Coach,
el ejecutor y el catálogo real exportados por Expo. Un proveedor OpenAI falso
emite tres `search_exercises`: press, curl y sentadilla. El transporte de cada
fragmento de búsqueda introduce 200 ms de espera controlada. Se comprueban
resultados no vacíos, tres IDs en su orden original, respuesta visible y cero
excepciones de página.

Se cronometra desde la entrega del primer turno falso hasta la petición de
continuación que contiene los tres resultados. Incluye entrega SSE, ejecución
y preparación de la continuación; excluye la generación del modelo. Tras una
pareja de calentamiento descartada, se miden 30 parejas fría/caliente. «Fría»
borra solo fragmentos de búsqueda; el manifiesto y las páginas de ejercicios
permanecen en caché. «Caliente» conserva todo. La mediana promedia los dos
valores centrales y p95 usa el rango más próximo superior.

Medición del 4 de octubre de 2026, Chromium 145.0.7632.6, viewport 390 × 844:

| Variante | Búsqueda fría: mediana / p95 | Caliente: mediana / p95 | Fragmentos fríos simultáneos |
| --- | --- | --- | --- |
| Serie, código de Staging | 696,00 / 859,86 ms | 57,94 / 160,83 ms | 1 |
| Planificador de este cambio | 263,59 / 278,73 ms | 46,72 / 62,91 ms | 3 |

La espera fría del lote baja aproximadamente un 62 % en este escenario
controlado. Las cifras calientes reflejan principalmente trabajo local y ruido
de ejecución; no justifican una promesa general de mejora. No son tiempos de
un teléfono ni de un modelo real. Las muestras y hashes de los bundles usados
están en `docs/testing/benchmarks/tool-batch/`. La variante paralela se midió
con una copia de la implementación antes de aplicarla al checkout; no implica
que Producción ya esté publicada.

Para repetir, exportar ambas revisiones a directorios distintos con
`APP_ENV=development DEV_PROVIDER_MODE=byok npm exec -- expo export --platform web
--clear --output-dir /ruta/absoluta`, desde `apps/mobile`. Después, desde la raíz:

```bash
TOOL_BATCH_BENCH_DIST=/ruta/absoluta \
TOOL_BATCH_BENCH_LABEL=serie \
TOOL_BATCH_BENCH_SOURCE_COMMIT=<sha-de-la-revision-exportada> \
npm run test:tools:performance:e2e
```

Cada informe registra el bundle realmente enlazado desde `index.html`, su
SHA-256 y las muestras. Si se usa un checkout sucio, dejar constancia al archivar
el informe. El script usa un origen local desechable y una clave ficticia; no
lee sesiones BYOK ni datos personales del navegador habitual. No se añade una
puerta de CI basada en tiempos de pared.

## QA con proveedor real tras la fusión

El 4 de octubre de 2026 se publicó la web 1.51.0 desde
`f38755747371e932cd9385234637b908e3156e45`. Brave con OpenAI Responses y
`gpt-6-luna` confirmó tres `search_exercises` en un mismo turno: press, curl y
sentadilla. Las tres respuestas del catálogo conservaron sus `call_id` y el
orden original al volver al proveedor; Coach mostró coincidencias reales.

Otro lote combinó dos `read_measurement` y una búsqueda de curl. La fecha
ficticia ausente, 2020-01-02, devolvió `not_found`; la lectura de 2020-01-01
conservó 76 kg ficticios y la búsqueda devolvió 15 coincidencias. El error no
canceló las otras lecturas ni produjo datos inventados en la respuesta.

La persistencia se comprobó guardando primero 75 kg y después 76 kg ficticios
para 2020-01-01, tras confirmar la propuesta, y leyendo nuevamente después de
recargar la app. El modelo eligió turnos separados para las dos escrituras:
esta QA demuestra persistencia; la exclusión de escrituras dentro de un mismo
lote se acredita con las pruebas deterministas de los cuatro dialectos.

La evidencia saneada está en `benchmarks/tool-batch/real-provider-qa.json`.
Solo recoge llamadas y resultados de estas pruebas ficticias, sin cabeceras de
autenticación ni claves. El bundle publicado fue
`index-7eb3e229140d0142e10a82626319231a.js`, SHA-256
`27d370f9846b153135fda11f16c49493b7e2feffc128c830be6d975141a75444`.
Estas comprobaciones no añaden una medición de rendimiento nativo ni convierten
la latencia del proveedor real en una comparación controlada.

## Verificación nativa pendiente

Comparar los APK release Staging anterior y Producción nueva en el mismo
dispositivo, con consultas y datos equivalentes y alternando las variantes.
Separar caché de catálogo fría/caliente y latencia del modelo. Registrar al
menos 30 repeticiones útiles por variante, mediana, p95, errores y resultados.
Una traza Perfetto/Android Studio permite comprobar tiempo ocupado del hilo JS,
CPU, memoria, frames perdidos y actividad de red; batería necesita sesiones
largas repetidas, igual brillo y conexión, sin extrapolar una consulta corta.
El script web no instrumenta el móvil. No se añaden trazas de producción ni
exportaciones de datos para esta medición.

## Cobertura y privacidad

`toolBatch.test.ts` comprueba límite, orden, barreras, drenaje fatal, latencia con
reloj falso y 100 secuencias generadas. `providerToolBatch.test.ts` recorre los
cuatro dialectos, errores recuperables/fatales, ocurrencias repetidas y dos
escrituras reales sobre la misma fecha seguidas de lectura del estado final.
La suite de app web con proveedor falso verifica los flujos vecinos de Coach,
confirmaciones, errores y persistencia.

Revisión de `docs/legal/privacy-change-checklist.md`: mismo contenido de
peticiones y resultados, mismos destinos, permisos, claves de almacenamiento,
copias y borrado. No se añade telemetría al producto. No hay una nueva categoría
de datos que inventariar ni se necesita regenerar la política legal. El límite
solo modifica cuándo empiezan las lecturas dentro de un turno.
