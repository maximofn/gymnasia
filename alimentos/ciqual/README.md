# Catálogo de alimentos ANSES-CIQUAL 2025

3.484 fichas locales con 74 componentes por alimento, tomadas de los cinco XML
oficiales del [depósito de ANSES en Zenodo](https://zenodo.org/records/17550133).
Fecha de publicación: 2025-11-19. Cada ficha es un alimento genérico o una
preparación representativa; no identifica un producto comercial por código de
barras ni proporciona una receta con cantidades de ingredientes.

**Fuente: Anses. 2025. Ciqual French food composition table.** Reutilización bajo
*Licence Ouverte / Open Licence*: conservar fuente y versión. Ver
[`../SOURCES.md`](../SOURCES.md) y `manifest.json`.

## Estructura

| Archivo | Contenido |
| --- | --- |
| `foods/ciqual-<código>.json` | Una ficha completa por alimento; el código original permanece estable |
| `index.json` | IDs, nombres oficiales y españoles, categorías y rutas de las fichas; permite buscar y cargar una sola ficha |
| `all.json` | Agregado JSON completo, un alimento por línea; pensado para importaciones y análisis |
| `nutrients.json` | Diccionario de 74 componentes: códigos CIQUAL, etiquetas originales, unidades y códigos INFOODS |
| `groups.json` | 161 categorías con nombres y relación padre/hijo |
| `references.json` | 1.978 referencias bibliográficas originales, resueltas mediante `source_ref` |
| `translations.es.json` | Traducciones españolas versionadas de alimentos, categorías y componentes, vinculadas al texto de origen por SHA-256 |
| `manifest.json` | Versión, atribución, fuente, huellas de entrada/salida, contadores y roles de nutrientes comunes |

Las fichas, índices y diccionarios se generan de forma determinista y no se editan
a mano. `translations.es.json` es la fuente de curación de las traducciones; su
campo `name` se puede corregir y se conserva al reimportar los XML. El formato está
definido en `scripts/catalogs/schemas/ciqual-food.schema.json`; los diccionarios
se obtienen de las tablas de componentes, grupos y fuentes de la misma entrega.

## Fichas y valores

- `names.fr` y `names.en`: nombres oficiales completos, conservados literalmente.
  La preparación (crudo, cocido, escurrido, etc.) se conserva en esos nombres.
- `names.es`: traducción al español de España para alimentos, categorías y
  componentes. No es una etiqueta oficial de ANSES. Esta entrega no infiere
  estados estructurados a partir de palabras.
- `category_ids`: jerarquía CIQUAL, con sus ceros iniciales. Los códigos formados
  solo por ceros significan clasificación ausente y se omiten; por ejemplo,
  `ciqual-24999` conserva una lista vacía.
- `scientific_name`: nombre científico original, o `null` si no existe.
- `source`: conjunto de datos y código original del alimento.
- `nitrogen_to_protein_factor`: factor de Jones original, sin recalcular proteínas.
- `nutrition_profiles[0].basis`: **100 gramos de parte comestible**, también para
  bebidas. No convertir a 100 ml sin una densidad documentada.
- `nutrition_profiles[0].nutrients`: diccionario indexado por ID del componente.
  La unidad está en `nutrients.json`: `g`, `mg`, `ug` (microgramos), `kcal` o `kJ`.

Cada componente conserva `source_value`, el texto original sin espacios de
relleno del XML, y estas interpretaciones:

| Original | `qualifier` | `value` | Otro campo |
| --- | --- | --- | --- |
| `0` | `reported` | `0` | — |
| `12,3` | `reported` | `12.3` | — |
| `< 0,1` | `less_than` | `null` | `limit: 0.1` |
| `traces` | `trace` | `null` | — |
| `-` | `missing` | `null` | — |

Un límite nunca se publica como cantidad exacta. Las trazas y los desconocidos
no se convierten en cero. Para calcular ingestas con esos datos, el consumidor
debe mantener la incertidumbre y definir una política explícita; esta importación
no decide una estimación en su lugar.

Cuando existen, se conservan `minimum`, `maximum` y sus textos originales
`source_minimum` y `source_maximum`. `confidence_code` mantiene la valoración
original A–D de CIQUAL, sin convertirla en una probabilidad. `source_ref` resuelve
una entrada de `references.json`. Una referencia sin texto sigue identificada,
con `citation: null`.

No fusionar componentes por compartir código INFOODS: CIQUAL distingue, por
ejemplo, proteínas calculadas con factor de Jones y con N × 6,25, y energía con
distintos métodos. `manifest.json.nutrient_roles` identifica los componentes
comunes sin borrar esas diferencias. Los carbohidratos `ciqual-31000` son
disponibles y no incluyen fibra.

La etiqueta inglesa del componente `ciqual-51104` contiene la errata de origen
`µg/100mg`. Se conserva literalmente; su unidad normalizada es `ug` por **100 g**,
según la etiqueta francesa y la sección 3.2.1 de la documentación oficial.
La etiqueta española también utiliza correctamente `µg/100 g`.

## Traducciones españolas

El catálogo incluye las 3.484 etiquetas de alimentos, 161 categorías y 74
componentes en español. Las traducciones se elaboraron con asistencia de Google
Gemini, revisión editorial de categorías y componentes, comprobaciones de cifras
y calificadores y correcciones selectivas de alimentos. La procedencia está
documentada en `translations.es.json` y en el manifiesto; no constituye una
revisión profesional exhaustiva de cada denominación alimentaria.

Para desambiguar algunos pescados se contrastó el nombre científico con el
[listado de denominaciones comerciales de la Secretaría General de Pesca](https://www.boe.es/buscar/act.php?id=BOE-A-2026-12598).

Cada entrada de `translations.es.json` contiene `name` y `source_sha256`. La
huella se calcula sobre `JSON.stringify({ fr: names.fr, en: names.en })`, en ese
orden y sin indentación. Vincula la traducción a las dos etiquetas de origen: si
un nombre original cambia, falta una traducción o sobra un ID, la importación y
el check se detienen para exigir una revisión. Los espacios, la puntuación y los
acentos del original forman parte de la huella.

Para corregir una traducción, editar solo su `name` y volver a ejecutar
`npm run import:ciqual -- --source-dir /ruta/a/los/xml` (o `--download`). No cambiar
la huella salvo después de revisar un cambio del texto original. La importación
y las pruebas utilizan el archivo versionado: no llaman a un modelo ni necesitan
claves del proveedor.

Los nombres científicos y las citas bibliográficas conservan su forma original.
Las traducciones no modifican IDs, clasificaciones, unidades, valores, rangos,
códigos de confianza ni referencias nutricionales.

## Reproducir y verificar

Desde la raíz del repositorio, con Node 22 y `npm ci`:

```bash
# Descarga los cinco XML oficiales a .source/ (ignorado por Git), valida sus
# SHA-256 y genera todas las fichas, índices, diccionarios y manifiesto.
npm run import:ciqual -- --download

# Reimporta una copia ya descargada, sin red.
npm run import:ciqual -- --source-dir /ruta/a/los/xml

# Valida fichas, referencias, valores e igualdad exacta de los agregados, sin red.
npm run check:ciqual

# Además, reconstruye desde los XML oficiales y compara TODOS los archivos.
npm run check:ciqual -- --source-dir /ruta/a/los/xml

# Regresiones, propiedades generativas y validación de la entrega completa.
npm run test:catalogs
```

La publicación de origen está fijada en `scripts/catalogs/ciqual-source.json`.
Una descarga alterada, un código duplicado, una referencia rota o una notación
numérica desconocida detienen la importación. Los archivos se sustituyen
atómicamente y el manifiesto se escribe al final. El importador se niega a borrar
fichas inesperadas que encuentre en `foods/`.

La CI de catálogos verifica esta entrega y sus pruebas sin descargar CIQUAL ni
necesitar claves o servicios externos. Los XML originales se pueden recuperar
desde Zenodo y se comprueban por SHA-256 antes de cualquier conversión.

## Alcance de esta primera entrega

El catálogo puede consultarse enteramente desde archivos locales. Su integración
con la app necesita un adaptador al contrato nutricional actual y una estrategia
de búsqueda/carga; `alimentos/all.json` y el baseline móvil siguen perteneciendo
al catálogo curado anterior. Las fichas CIQUAL no se añaden automáticamente al
bundle móvil.

Las raciones domésticas, imágenes, alérgenos y otras
características que CIQUAL no documenta quedan sin completar. Los 100 g son la
base de referencia nutricional, no una ración recomendada.

Revisión de privacidad: el importador descarga exclusivamente datos públicos
durante el mantenimiento del repositorio. Esta entrega no introduce conexiones
de la app, claves de almacenamiento, datos personales, permisos ni envíos a IA;
no requiere cambios del inventario de datos ni de la política publicada.
