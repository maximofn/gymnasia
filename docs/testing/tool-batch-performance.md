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

## Binarios Android para la comparación

El 4 de octubre de 2026 se completaron en wallabot el Staging anterior y la
Producción nueva. El workflow de Producción terminó correctamente, publicó
[la release 1.51.0](https://github.com/maximofn/gymnasia/releases/tag/v1.51.0)
y confirmó el envío a Alpha con estado `FINISHED` y `releaseStatus: completed`.

| APK | Fuente | Paquete | versionCode | SHA-256 |
| --- | --- | --- | --- | --- |
| Staging 1.50.4, serie | `97c9c9fd02e133dd9ace4a221ff26d58cb08539b` | `com.maximofn.gymnasia.staging` | 1 | `5c82a37c8670eb67a1208c94ab2a3e7c1e075556d5445a21b429207ee729bd25` |
| Producción 1.51.0, paralelo | `f38755747371e932cd9385234637b908e3156e45` | `com.maximofn.gymnasia` | 86 | `1dce0f56b4e030e7f99f64850e15059fa52b209bb090093d05948363297e0c45` |

Ambos APK pasaron su verificador independiente. Los hashes se contrastaron
después de descargar los binarios; la evidencia de Producción confirma fuente,
versión, firma, permisos y política promocionada. El AAB tiene el mismo
versionCode 86 y el mismo bundle Hermes que el APK. Una comprobación adicional
detecta el marcador del nuevo planificador en ambos binarios de Producción y su
ausencia en Staging; no sustituye las pruebas funcionales. El detalle está en
`benchmarks/tool-batch/android-release-comparison.json` y las evidencias completas
de Producción acompañan a la release.

Los paquetes distintos permiten conservar ambos APK instalados. Cada app tiene
su propio almacenamiento; la comparación necesita datos y consultas equivalentes.
Compilar y verificar los artefactos no añade una medición de rendimiento nativo.

## Medición nativa pendiente

Comparar los APK release Staging anterior y Producción nueva en el mismo
dispositivo, con consultas y datos equivalentes y alternando las variantes.
Separar caché de catálogo fría/caliente y latencia del modelo. Registrar al
menos 30 repeticiones útiles por variante, mediana, p95, errores y resultados.
Una traza Perfetto/Android Studio permite comprobar tiempo ocupado del hilo JS,
CPU, memoria, frames perdidos y actividad de red; batería necesita sesiones
largas repetidas, igual brillo y conexión, sin extrapolar una consulta corta.
El script web no instrumenta el móvil. Las builds anteriores, Staging 1.50.4 y
Producción 1.51.0, no incluyen tiempos de tools en sus trazas; necesitan una
nueva compilación con la instrumentación descrita a continuación.

### Tiempos en las trazas locales

Coach registra eventos con la etiqueta `toolPerformance`, también en Android.
La medición empieza cuando el programa recibe el lote de tools ya preparado
para ejecutarlo y termina cuando todas las llamadas iniciadas han acabado.
No incluye la petición inicial al LLM ni la generación de su respuesta final.
Usa un reloj monotónico (`performance.now`; `Date.now` solo como fallback).

- `batch_started`: identificador local `batchId`, cantidad `toolCount` y límite
  `maxConcurrentReads`. El identificador se genera en la app; no procede del LLM.
- `tool_started`: posición `index` en el lote, nombre canónico `toolName`, efecto
  y `offsetMs` desde el inicio del lote. Una tool desconocida se registra como
  `unknown`, sin copiar el nombre recibido.
- `tool_finished`: misma posición, `offsetMs` de finalización y `durationMs`
  desde el inicio de esa llamada, incluyendo sus esperas de almacenamiento o red.
- `batch_finished`: `durationMs` del lote, `totalToolDurationMs` como suma de
  las duraciones individuales, llamadas iniciadas/devueltas/lanzadas como
  excepción y `peakActiveTools`, el máximo de tools activas a la vez.

Para comparar serie y paralelo usa **`batch_finished.durationMs`**: sumar los
tiempos de tools solapadas no da el tiempo que ha esperado el usuario. Los
offsets y `peakActiveTools` permiten comprobar el solapamiento. `outcome:
returned` significa que la llamada devolvió un resultado, que puede ser un
error recuperable; `threw` indica una excepción que detuvo el lote. El cierre
fatal se registra después de esperar las llamadas que ya estaban activas.
Si hay varias rondas, cada una tiene su propio lote; no se mezclan con la
latencia del modelo entre rondas.

Los eventos pasan al registro local existente, de hasta 1000 entradas, y se
copian desde Ajustes → Trazas → Copiar trazas. No incluyen argumentos,
resultados, IDs del proveedor, textos de errores, conversaciones ni claves.
Los tiempos se toman antes de escribir cada evento y la persistencia del
registro no se espera para continuar la ejecución. Ambas variantes deben
llevar exactamente esta misma instrumentación para que su coste sea comparable.

### Petición idéntica para ambas apps

Usa el mismo teléfono, conexión, proveedor y modelo. En un chat nuevo de cada
app, pega:

```text
Quiero comprobar tres búsquedas independientes del catálogo de ejercicios.
En tu próxima respuesta solicita exactamente tres llamadas a search_exercises,
todas en la misma ronda: una con query "press", otra con query "curl" y otra
con query "sentadilla". Usa únicamente el argumento query. Después resume las
coincidencias de cada búsqueda. No guardes ni modifiques ningún dato y no hagas
otras consultas.
```

El texto pide un solo lote, pero un proveedor real puede elegir dividirlo o
añadir otras tools. Comprueba en las trazas que existe un lote de tres
`search_exercises`; si son tres lotes de una llamada, esa ejecución no compara
el solapamiento y hay que repetirla. Staging para esta comparación usa límite
1; Producción usa límite 4. No se obtiene el tiempo preguntándoselo al modelo:
la medición la hace el programa y aparece en las trazas.

Haz primero una ejecución en cada app y sepárala de las siguientes: una app
puede tener fragmentos del catálogo ya guardados y la otra no. Repite con chats
nuevos, alternando las apps, para comparar también con caché caliente. Borrar
solo las trazas facilita la lectura y no vacía la caché. No borres los datos
personales para hacer esta prueba. Copia las trazas de cada app después de
terminar e identifica cuál es Staging y cuál Producción; la cabecera incluye
el entorno, la versión y la compilación instalada.

Revisión de privacidad según `docs/legal/privacy-change-checklist.md`: se amplía
la descripción de `gymnasia_debug_traces` en el inventario con estos metadatos
técnicos locales. No cambia ninguna categoría personal, destino, permiso,
copia, acción de borrado ni contenido enviado al proveedor. No se modifica el
texto legal ni la declaración de Play.

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
