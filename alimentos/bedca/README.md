# BEDCA: captura e importación local, redistribución pendiente

Se prepara el catálogo público de la Base de Datos Española de Composición de
Alimentos a partir de la [interfaz oficial](https://www.bedca.net/bdpub/).
**Los XML, los documentos descargados y los JSON derivados permanecen locales.**
Este directorio solo versiona este README y `.gitignore`.

Las [condiciones de uso de AESAN/BEDCA](https://www.bedca.net/bdpub/UsoBD.pdf)
requieren atribución y preservar el significado original; contemplan autorización
expresa para usos fuera del ámbito personal, educativo o no comercial. Queda
pendiente aclarar cómo encajan la redistribución en un repositorio público y la
inclusión en Gymnasia. El bloqueo de publicación de esta entrega responde a esa
decisión del mantenedor: no sustituye una interpretación jurídica de las condiciones.
No hay un flag para saltarlo ni se ha solicitado permiso a terceros.

## Código público y datos locales

- `scripts/catalogs/bedca-source.json`: fuente, versión declarada v1.0 (2010),
  condiciones y límites de descarga. No contiene alimentos ni valores reales.
- `scripts/catalogs/bedca-source.mjs`: consultas exclusivamente de lectura,
  descarga secuencial, reanudación, consultas/respuestas originales y recibos.
- `scripts/catalogs/bedca.mjs`: importación determinista, integridad y guardia
  contra publicar datos bajo este directorio.
- `scripts/catalogs/schemas/bedca-food.schema.json`: contrato de las fichas.
- `scripts/catalogs/__fixtures__/bedca/`: datos íntegramente inventados para QA,
  separados de cualquier captura real de BEDCA.

La captura por defecto vive en `alimentos/bedca/.local/source/` y el catálogo
derivado en `alimentos/bedca/.local/catalog/`. Todo queda ignorado por Git,
incluidos los manifiestos con IDs y hashes individuales. No se integra en la app,
no modifica CIQUAL, no genera imágenes y no requiere backend ni claves.

## Descargar, reanudar y reproducir

Desde la raíz del repositorio, con Node 22 y `npm ci`:

```bash
# Descarga oficial completa o reanudación de la misma captura. Una petición
# cada 2,5 segundos como mínimo entre respuestas; sin paralelizar alimentos.
npm run import:bedca -- --download

# Reconstruye la copia local sin descargar nada.
npm run import:bedca

# Reconstruye en memoria desde los originales, comprueba sus hashes y compara
# cada archivo del catálogo byte a byte. No escribe ni usa red.
npm run check:bedca

# Solo código y fixtures inventadas. No requiere disponer de los datos reales.
npm run test:bedca
npm run check:bedca:publication
```

El CLI imprime `snapshot_sha256` y `catalog_manifest_sha256`. Para fijar la
captura que se pretende reproducir, conservar esas huellas junto a la copia y
pasar la primera mediante `--snapshot-sha256 <SHA-256>`. Un hash distinto impide
generar o dar por válido el catálogo. Compartir o subir la copia sigue bloqueado.

Se puede indicar `--workspace-dir <carpeta>` para una captura nueva o cambiar
`--source-dir` y `--output-dir` por separado. Dentro del repositorio solo se
permiten destinos bajo `alimentos/bedca/.local/`; también se admiten directorios
locales externos. La salida no puede estar dentro del origen ni contenerlo.
No apuntar a carpetas compartidas, sincronizadas públicamente o de despliegue.

La captura conserva el índice inicial, las seis tablas auxiliares (componentes,
grupos de alimentos, grupos de componentes, tipos de valor, expresiones y
unidades), una consulta y respuesta por alimento, y los documentos públicos de
condiciones, JavaScript y XSL que describían la interfaz. No ejecuta el JavaScript
descargado ni sigue las URLs de fotos, métodos o citas.

El índice se consulta de nuevo al terminar: si cambia, la captura no se declara
completa. Esto **no** garantiza que todos los nutrientes procedan de un único
instante del servidor. Es una secuencia de respuestas obtenidas entre
`started_at` y `completed_at`; después queda congelada por sus hashes locales.
No hay checksum oficial publicado con el que autenticar toda la captura.

Una respuesta HTTP 200 que no sea XML válido no se acepta como dato. Se reintentan
fallos de red, 429 y errores 5xx de forma acotada, con espera. Los archivos ya
registrados se comprueban y reutilizan, no se descargan otra vez. Una alteración
local falla sin sustituir el archivo. Se recupera una ficha escrita antes de
actualizar su recibo sin volver a pedirla al servidor.

Solo puede haber una descarga por directorio: `.download.lock` evita una segunda.
SIGINT/SIGTERM conservan la captura parcial y liberan la reserva. Tras un cierre
forzado del proceso, verificar que el PID del lock terminó antes de retirar
únicamente ese lock y reanudar. No borrar la captura para resolver una interrupción.

## Fichas y fidelidad

Cada entrada mantiene un ID estable `bedca-<f_id>`. `names.es` es el nombre
español de la fuente; `names.en`, el inglés, si existe. No se traducen ni se
fusionan alimentos con CIQUAL por coincidencia de nombre. Se conserva también
el origen declarado por cada registro: la consulta pública puede devolver tanto
BEDCA como BEDCA2.

`source_index`, `source_fields` y los campos originales de cada medición conservan
las cadenas XML decodificadas sin recortar espacios, redondear, normalizar nombres
o convertir unidades. El XML original conserva, además, su representación exacta
en bytes. Se mantienen códigos LanguaL/FoodEx, nombres científicos y metadatos
de categorías, descripciones, fracción comestible, método, referencia, cita,
desviación, mínimo, máximo y número de observaciones cuando la respuesta los incluye.
Es el conjunto de campos de la consulta pública documentada en el XSL, no un
volcado del SQL ni de tablas internas del servidor.

La fracción comestible es una proporción entre 0 y 1; no es una ración. Los
perfiles se agrupan por método de expresión. Solo el código `W` concordante en
los dos campos de la respuesta se identifica como 100 g de parte comestible.
Las otras bases se mantienen sin inferir (`basis: null`). Cada medición conserva
su unidad propia: compartir componente no autoriza a mezclar g, mg, kJ o kcal.
No se recalculan kcal a partir de macros, no se imputa grasa y no se convierten
bebidas a 100 ml sin una base documentada.

Las mediciones se guardan en arrays con su posición de origen para no perder
componentes repetidos, distintas unidades o métodos. El tipo de valor original
conserva la diferencia entre media, mediana, estimación y otros métodos:

| Caso de origen | Interpretación local |
| --- | --- |
| Número ordinario | `reported`, cantidad numérica y cadena original |
| `TR` | `trace`, cantidad `null`, incluso si el texto contiene cero |
| `LT` o `<` | `less_than`, cantidad `null` y límite separado |
| `MT` o `>` | `greater_than`, cantidad `null` y límite separado |
| `BL` | `below_detection`, cantidad `null`, límite si está documentado |
| `LZ` / `RZ` | Cero lógico / regulador, conservados como calificadores propios |
| `UD` | `undecidable`, cantidad `null` |
| `X` con número | `unknown_type`, número con tipo de valor desconocido explícito |
| Cadena vacía o `-` | `missing`, cantidad `null` |

Una notación numérica desconocida, un componente sin definición, un tipo de valor
no documentado o una discrepancia entre índice y ficha detienen la importación.
Los negativos presentes en la fuente se conservan y señalan en diagnósticos;
no se corrigen silenciosamente. Los códigos de unidad o expresión no encontrados
en los diccionarios se conservan con diagnóstico, sin inventar una equivalencia.

Una respuesta `<food/>` permanece en el índice como `availability: "empty"`,
sin nutrientes inventados. Las referencias con diferentes textos para un mismo
ID conservan todas sus variantes.

## Artefactos locales y controles

La salida incluye `foods/`, `all.json`, `index.json`, `nutrients.json`,
`references.json`, los seis diccionarios, `diagnostics.json` y `manifest.json`.
El manifiesto registra atribución, bloqueo de redistribución, captura de origen,
contadores, tamaños y SHA-256 de cada archivo generado.

La generación prepara un directorio temporal, lo verifica y cambia la carpeta
completa. La copia anterior se restaura si falla el cambio. Nunca se limpia una
carpeta que tenga archivos ajenos o no cumpla su manifiesto. El check de
reproducción compara todos los archivos con una reconstrucción desde el snapshot.

CI ejecuta las pruebas sin red y rechaza cualquier archivo de datos versionado
bajo `alimentos/bedca/`, aunque se haya añadido forzando `.gitignore`. Solo permite
este documento y `.gitignore`. No se suben capturas reales como fixtures ni se
adjuntan los datos a la PR, artifacts, releases o logs.

Revisión de privacidad: las consultas solo descargan datos públicos durante el
mantenimiento. No leen datos personales ni claves, no llaman a IA y no añaden
destinos de red, almacenamiento, permisos o campos a la app. Se documenta este
alcance en el inventario, sin cambiar la política publicada ni las declaraciones
de Google Play.
