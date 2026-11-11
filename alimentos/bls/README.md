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

Los XLSX originales y el PDF de erratas de agosto de 2026 se versionan en `source/` para garantizar la reproducción
offline aunque cambie el servidor. Cada fuente se comprueba por SHA-256 antes de
aplicar el plan de correcciones. No se descargan dependencias o datos durante el check ni en CI.

Para recuperar una copia oficial nueva en una carpeta vacía y comprobarla contra
la entrega publicada:

```bash
npm run import:bls -- --download --source-dir /tmp/bls-source --output-dir /tmp/bls-output
npm run check:bls -- --source-dir /tmp/bls-source --output-dir /tmp/bls-output
```

`--download` obtiene un enlace temporal de la página oficial, limita la respuesta
y comprueba el hash del ZIP completo y de sus tres entradas antes de escribir los
dos XLSX. Descarga también el PDF de erratas separado, fijado por su propio hash.
El PDF de documentación incluido en el ZIP se verifica, pero no se copia al catálogo.
No guarda tokens temporales, cookies, credenciales o fechas de ejecución en los
artefactos. Una fuente existente alterada falla sin sustituirla. Si los dos XLSX
y el PDF de erratas ya son válidos, no consulta la red. No hay un flag para aceptar otra publicación:
actualizar versión y hashes exige una revisión explícita del código y los datos.

La fuente está fijada en `scripts/catalogs/bls-source.json`: ZIP, entradas, DOI,
atribución, licencia y huellas de los originales. Los hashes identifican la copia
verificada; no constituyen una firma oficial del editor.

## Archivos y contrato

| Ruta | Contenido |
| --- | --- |
| `source/*.xlsx`, `source/Erratum_BLS_4_0_DE.pdf` | Fuentes oficiales inmutables, verificadas por SHA-256 |
| `foods/bls-<código>.json` | Una ficha completa por alimento |
| `index.json` | IDs, nombres, fila de origen, avisos y ruta de cada ficha |
| `pages.json`, `pages/NNNN.json` | Agregado completo en 72 páginas de hasta 100 fichas |
| `nutrients.json` | 138 componentes, unidades, etiquetas, grupos, fórmulas originales y fórmulas energéticas corregidas |
| `references.json` | 2.164 cadenas originales más la cita del erratum; incluye el marcador `-` con cita nula |
| `known-issues.json` | Índice de afectados y resumen de aplicación del plan |
| `corrections.json` | Diario de 1.841 cambios: original, resultado, método, evidencia y estado |
| `manifest.json` | Fuente, licencia, perfil de erratas, contadores originales/efectivos y hashes de salida |

El agregado se pagina para evitar un único JSON superior al límite de archivos de
GitHub. Recorrer `pages.json` en su orden y concatenar los arrays da las mismas
fichas ordenadas por ID que `foods/`. No se necesita un servidor de paginación.

Las fichas son JSON compactos generados; no se editan manualmente. El contrato de salida es la versión 2 de
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
  permanecen en el diccionario. No se convierten cantidades entre unidades. Las derivaciones
  energéticas se identifican expresamente en el diario. La base es **100 g comestibles**, también para bebidas; no 100 ml.
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

## Erratas aplicadas con originales y trazabilidad

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

El perfil `gymnasia-bls4-errata-202608-v1` aplica las reglas declaradas en
`scripts/catalogs/bls-errata-plan.json`, fijadas por hash en la fuente. Cada ficha
e índice enlaza sus `source_warning_ids`, `correction_ids`, `errata_profile_id` y
`errata_status` (`unaffected`, `corrected`, `partial` o `pending`).

| Tratamiento | Cambios de medición |
| --- | ---: |
| Sustituciones numéricas oficiales de las tablas 1–3 | 8 |
| Límites simbólicos de zinc de la tabla 4 | 6 |
| Marcador de ausencia de zinc, sin inventar cantidades | 53 |
| Energía derivada al retirar el término OLSAC duplicado | 822 |
| Cantidades invalidadas pendientes de sustituto verificable | 950 |

Además se registran dos correcciones de las fórmulas de energía del diccionario:
**1.839 mediciones y dos fórmulas**, con estados `applied` (69, incluidas las dos
fórmulas), `derived` (822) y `pending` (950).

En las mediciones, `value`, `qualifier` y `limit` representan el resultado efectivo.
Los campos `source_value`, `source_type`, `source_origin` y `source_ref` conservan
**exactamente el original**, incluso cuando difiere del valor efectivo. Una
medición corregida añade `effective_source_value`, `effective_origin`,
`effective_ref` y `correction_id`. La referencia efectiva enlaza el erratum;
`corrections.json` conserva también la bibliografía específica de la sustitución.
El diario guarda la medición original completa, resultado, unidad, método, estado,
sección, tabla cuando existe, páginas PDF (numeración desde 1), páginas impresas,
URL y SHA-256 del documento. El calcio original de las almendras es 84,864 mg en
Excel; el PDF lo muestra redondeado a 84,9. Se conservan ambos en el diario.

Las fórmulas originales permanecen en `source_fields`; `effective_formula` y
`formula_correction_id` identifican la corrección. No se ejecutan cadenas de
fórmula. Para los 411 alimentos afectados se calcula por separado:

- kJ efectivos = kJ publicados − 8 × OLSAC publicados en g.
- kcal efectivas = kcal publicadas − 2 × OLSAC publicados en g.

Es una **derivación algebraica de Gymnasia sobre cifras ya publicadas y
redondeadas**, marcada `recomputed`, no el recálculo oficial de BLS 4.1 con insumos
sin redondear. Se usa aritmética decimal sobre la representación decimal canónica
de los números interpretados, conservando aparte el léxico OOXML original. No se
redondea otra vez ni se imputan ceros a otros macronutrientes desconocidos. El
diario identifica todos los insumos, coeficientes, resultado decimal y esta
limitación de precisión. Una entrada energética o de OLSAC desconocida impediría
la derivación.

El PDF no publica cantidades suficientes para resolver numéricamente:

- 169 mediciones de recetas dependientes de las leches o almendras, sin pesos de
  ingredientes, rendimientos y factores de retención reproducibles.
- 118 ceros aparentes de fenilalanina, sin correspondencia individual con cifra,
  traza o ausencia.
- 663 mediciones de anchoa y 16 derivados: grasa, las dos energías y los 36
  componentes del grupo oficial de ácidos grasos. El editor anuncia revisar todo
  ese perfil y sigue investigando el valor final de grasa. El mapeo de esa
  revisión al grupo `Fatty acids` del diccionario es una selección editorial
  explícita; el PDF no enumera los componentes uno por uno.

Estas 950 cantidades quedan como `value: null`, `qualifier:
invalidated_by_erratum`, con motivo pendiente y original recuperable. No se
estiman proporciones de recetas, fenilalanina desde proteína, un punto medio de
grasa ni un perfil graso escalado. El intervalo orientativo 2,3–6,3 g de grasa
solo se documenta para T104100; no sustituye una cantidad ni se propaga como
intervalo a las recetas.

`remaining_scope` conserva dos revisiones anunciadas sin listado completo de
objetivos: recetas adicionales dependientes del zinc y otros aminoácidos. No se
declaran resueltas ni se asignan valores a alimentos no enumerados.

**Es BLS 4.0 con una proyección explícita de erratas de Gymnasia, no una entrega
oficial BLS 4.1 ni una resolución numérica completa de las erratas.**
Los contadores `counts.qualifiers` son efectivos; `original_counts` reconstruye
los contadores originales. `counts.origins` sigue describiendo `source_origin`,
no los orígenes efectivos. La validación restaura desde el diario y vuelve a
aplicar el plan: rechaza alteraciones y evita aplicar dos veces la resta energética.

## Alcance y pruebas

Esta entrega no modifica archivos, bundle, búsquedas, dieta, tools o índices
móviles. El catálogo curado y CIQUAL conservan sus artefactos. No se importan
datos de BEDCA ni se cambia su restricción de publicación.

Las pruebas usan OOXML sintético para ejercitar el mismo lector, corrupción de
fuente/salida, XML truncado y DTD, fórmulas de Excel rechazadas, integridad de
ZIP, unidades, referencias, errores HTTP, reutilización sin red, calificadores,
propiedades numéricas y protección de archivos ajenos. Una prueba adicional
reconstruye la entrega completa desde los XLSX versionados y compara todas las
salidas. Comprueba las 985.320 mediciones contra la conversión original,
la conservación de fuentes y referencias, las ocho familias de erratas, límites,
invalidaciones, aritmética decimal, idempotencia y manipulación del diario.
CI ejecuta `check:bls` y `test:catalogs` sin red ni claves para estos checks.

Revisión de privacidad: solo se descargan datos públicos durante mantenimiento.
No se leen claves ni datos de usuarios, no hay llamadas a IA y la app no se
conecta a blsdb.de. No se crean permisos, almacenamiento, destinos de red,
proveedores o cambios de copias/borrado móviles. Se documenta en el inventario;
no cambia la política publicada ni las declaraciones de Google Play.
