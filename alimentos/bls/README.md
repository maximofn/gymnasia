# Bundeslebensmittelschlüssel (BLS) 4.0

Catálogo independiente del Max Rubner-Institut: **7.140 alimentos, 138 componentes
y 985.320 valores**, procedentes de la entrega alemana de diciembre de 2025.
No identifica productos por código de barras ni aporta cantidades de ingredientes
para reconstruir recetas. Los preparados de la fuente siguen siendo fichas de
composición por 100 g de parte comestible.

**Fuente:** Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS),
Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe.
DOI: [10.25826/Data20251217-134202-0](https://doi.org/10.25826/Data20251217-134202-0).

Datos bajo **CC BY 4.0**, con fuente, licencia y transformaciones identificadas en
[`LICENSE.md`](LICENSE.md), `manifest.json` y [`../SOURCES.md`](../SOURCES.md).
La [página oficial de descarga](https://www.blsdb.de/download) declara la licencia
expresamente. Esta entrega no reutiliza el régimen de licencias de BLS 3.x.

## Reproducir sin conexión

Desde la raíz, con Node 22 y `npm ci`:

```bash
npm run import:bls   # reconstruye desde los dos XLSX oficiales versionados
npm run check:bls    # reconstruye en memoria y compara cada archivo byte a byte
npm run test:bls     # contratos, regresiones, propiedades y entrega completa
```

No hacen falta Python, Excel, proveedor de IA, claves, base de datos ni backend.
El importador usa `fflate` 0.8.3 para leer ZIP y SAX estricto para OOXML, sin
ejecutar las fórmulas de Excel o del diccionario ni abrir enlaces de las citas.

Los XLSX originales se versionan en `source/` para garantizar la reproducción
offline aunque cambie el servidor. Cada uno se comprueba por SHA-256 antes de
parsearlo. No se descargan dependencias o datos durante el check ni en CI.

Para recuperar una copia oficial nueva en una carpeta vacía y comprobarla contra
la entrega publicada:

```bash
npm run import:bls -- --download --source-dir /tmp/bls-source --output-dir /tmp/bls-output
npm run check:bls -- --source-dir /tmp/bls-source --output-dir /tmp/bls-output
```

`--download` obtiene un enlace temporal de la página oficial, limita la respuesta
y comprueba el hash del ZIP completo y de sus tres entradas antes de escribir los
dos XLSX. El PDF incluido en el ZIP se verifica, pero no se copia al catálogo.
No guarda tokens temporales, cookies, credenciales o fechas de ejecución en los
artefactos. Una fuente existente alterada falla sin sustituirla. Si los dos XLSX
ya son válidos, no consulta la red. No hay un flag para aceptar otra publicación:
actualizar versión y hashes exige una revisión explícita del código y los datos.

La fuente está fijada en `scripts/catalogs/bls-source.json`: ZIP, entradas, DOI,
atribución, licencia y huellas de los originales. Los hashes identifican la copia
verificada; no constituyen una firma oficial del editor.

## Archivos y contrato

| Ruta | Contenido |
| --- | --- |
| `source/*.xlsx` | Los dos libros originales, sin modificaciones |
| `foods/bls-<código>.json` | Una ficha completa por alimento |
| `index.json` | IDs, nombres, fila de origen, avisos y ruta de cada ficha |
| `pages.json`, `pages/NNNN.json` | Agregado completo en 72 páginas de hasta 100 fichas |
| `nutrients.json` | 138 componentes, unidades, etiquetas, grupos y fórmulas originales |
| `references.json` | 2.164 cadenas distintas de referencia; incluye el marcador `-` con cita nula |
| `known-issues.json` | Índice editorial de las erratas oficiales, sin aplicar correcciones |
| `manifest.json` | Fuente, licencia, transformaciones, contadores, roles y hashes de salida |

El agregado se pagina para evitar un único JSON superior al límite de archivos de
GitHub. Recorrer `pages.json` en su orden y concatenar los arrays da las mismas
fichas ordenadas por ID que `foods/`. No se necesita un servidor de paginación.

Las fichas son JSON compactos generados; no se editan manualmente. El esquema es
`scripts/catalogs/schemas/bls-food.schema.json`. El check también verifica que no
falten ni sobren archivos de salida. El writer prepara cada archivo temporal y
lo renombra; escribe el manifiesto al final. Una interrupción puede dejar una
entrega parcial, que el check rechaza y que se recupera reejecutando el importador.
Se niega a borrar archivos ajenos y a seguir symlinks de salida.

## Fidelidad de los datos

- IDs `bls-<código>`: el código es texto, incluidos los alfanuméricos como los de
  ciertas leches. No se enlazan ni fusionan alimentos con CIQUAL o el catálogo curado.
- `names.de` y `names.en` son oficiales y literales. No se han generado nombres
  españoles, traducciones, imágenes, raciones, densidades ni categorías inferidas.
- `source.worksheet_row` identifica la fila del Excel principal; `source_note`
  conserva la columna `Hinweis` cuando existe.
- Cada componente conserva las nueve columnas del diccionario en `source_fields`
  y las tres cabeceras correspondientes del Excel principal en `source_columns`.
  No se ejecutan las fórmulas documentadas ni se deducen códigos por traducción.
- Cada medición conserva `source_value` (léxico de la celda, incluidos sus ceros
  decimales), `source_type`, `source_origin` y `source_ref`. Las referencias se
  conservan completas, incluso las que agrupan varias citas con `#`. Una celda
  ausente no se confunde con `-` o con cadena vacía. Los bytes originales de ambos
  libros permiten recuperar además estilos y demás representación OOXML.
- La única normalización de unidad es `µg` a `ug`; la etiqueta y unidad originales
  permanecen en el diccionario. No se convierten cantidades, no se redondean ni se
  recalculan kcal. La base es **100 g comestibles**, también para bebidas; no 100 ml.
- `PROT625` es proteína calculada con N × 6,25; `CHO` son hidratos disponibles. Los
  roles del manifiesto no los equiparan automáticamente con proteínas Jones u
  otros métodos de otras bases de datos.

| Dato de origen | Interpretación |
| --- | --- |
| Número ordinario | `reported`, número con su origen analizado/calculado/etc. intacto |
| Número cero y origen `Logische Null` | `logical_zero`, cero lógico |
| `TR`, o cantidad numérica con origen `Spuren` | `trace`, cantidad nula |
| `-`, cadena vacía o celda ausente | `missing`, cantidad nula; original conservado |
| `<LOD` | `below_detection`, sin umbral numérico inventado |
| `<LOQ` | `below_quantification`, sin umbral numérico inventado |
| `<LOD or <LOQ` | `below_detection_or_quantification`, ambigüedad conservada |
| `< número` | `less_than`, cantidad nula y `limit` separado |
| Origen de cero lógico con cantidad incompatible | `inconsistent_origin`, cantidad nula |

Se conservan las 13 categorías de procedencia del MRI y el marcador `-`; un
origen o una notación desconocidos detienen la importación. `reported` no significa
«medido en laboratorio»: en esta copia hay muchas mediciones obtenidas mediante
recetas, fórmulas u otros procedimientos, identificados en `source_origin`.

## Erratas: original 4.0, sin correcciones silenciosas

El [erratum oficial de agosto de 2026](https://www.blsdb.de/assets/uploads/Erratum_BLS_4_0_DE.pdf)
documenta correcciones que el editor prevé incorporar a BLS 4.1. Incluye vitaminas
y yodo de leches, calcio de almendras, doble cómputo energético de oligosacáridos,
celdas vacías de zinc, ceros aparentes de fenilalanina y grasa/energía de anchoa y
derivados. El PDF está fijado por SHA-256 en el manifiesto de fuente.

`scripts/catalogs/bls-known-issues.json` conserva los códigos, componentes y
secciones afectados: ocho avisos y **747 alimentos distintos**, con posibles
solapamientos. Se transcribieron las listas de los anexos 7.1–7.7 y la tabla 4;
los contadores de cada lista coinciden con el documento. Es un índice editorial
de Gymnasia, no una nueva tabla oficial de composición.

Cada ficha e índice enlaza sus `source_warning_ids`. `corrections_applied` es
`false`: los valores de los XLSX siguen intactos. Por ejemplo, los seis límites
de zinc que el erratum describe siguen ausentes en el Excel original, y se
señalan como tales con el aviso específico. Los 53 vacíos de zinc restantes se
señalan por separado. No se inventan cifras, no se interpreta un cero aparente de
fenilalanina como certeza de ausencia ni se recalculan recetas afectadas.

**Esta es una reproducción de BLS 4.0 con avisos, no un catálogo corregido.** Antes
de integrarlo en los cálculos de la app se debe acordar y verificar cómo aplicar
las erratas o actualizar a una entrega oficial que las incorpore.

## Alcance y pruebas

Esta entrega no modifica archivos, bundle, búsquedas, dieta, tools o índices
móviles. El catálogo curado y CIQUAL conservan sus artefactos. No se importan
datos de BEDCA ni se cambia su restricción de publicación.

Las pruebas usan OOXML sintético para ejercitar el mismo lector, corrupción de
fuente/salida, XML truncado y DTD, fórmulas de Excel rechazadas, integridad de
ZIP, unidades, referencias, errores HTTP, reutilización sin red, calificadores,
propiedades numéricas y protección de archivos ajenos. Una prueba adicional
reconstruye la entrega completa desde los XLSX versionados y compara todas las
salidas. CI ejecuta `check:bls` y `test:catalogs` sin red ni claves para estos checks.

Revisión de privacidad: solo se descargan datos públicos durante mantenimiento.
No se leen claves ni datos de usuarios, no hay llamadas a IA y la app no se
conecta a blsdb.de. No se crean permisos, almacenamiento, destinos de red,
proveedores o cambios de copias/borrado móviles. Se documenta en el inventario;
no cambia la política publicada ni las declaraciones de Google Play.
