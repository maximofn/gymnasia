# Fuentes del catálogo de alimentos

## MRI-BLS 4.0 (2025)

La entrega [`bls/`](bls/README.md) procede del Max Rubner-Institut:
**Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 —
Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0.**

Datos bajo [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), declarada en
la [página oficial de descarga](https://www.blsdb.de/download). Ver
[`bls/LICENSE.md`](bls/LICENSE.md). Las contribuciones de reorganización de datos
de Gymnasia se comparten bajo la misma licencia, conservando la atribución del
MRI y sin implicar su respaldo. Los XLSX originales y sus hashes se conservan.

La transformación a JSON organiza las fichas, añade IDs estables, índices,
páginas y calificadores explícitos. Aplica las sustituciones y marcadores del
[erratum oficial de agosto de 2026](https://www.blsdb.de/assets/uploads/Erratum_BLS_4_0_DE.pdf),
deriva la energía retirando el término OLSAC duplicado de los valores publicados
e invalida cantidades afectadas sin sustituto verificable. Los originales y la
trazabilidad de cada cambio se conservan en `bls/corrections.json`, junto a su
método, estado y evidencia. Son transformaciones de Gymnasia sobre BLS 4.0; no
constituyen BLS 4.1 oficial. Hay 950 cantidades pendientes y dos ámbitos de
revisión sin objetivos enumerados; véase el README. No se traduce ni se integra
todavía en la app. Los datos se ofrecen sin garantías.

## ANSES-CIQUAL 2025

La importación de la tabla oficial de composición de alimentos se conserva en
[`ciqual/`](ciqual/README.md). Procede del depósito publicado por ANSES el
19 de noviembre de 2025, DOI
[`10.5281/zenodo.17550133`](https://doi.org/10.5281/zenodo.17550133).

Atribución de los datos: **Anses. 2025. Ciqual French food composition table.**

La sección 1 de la documentación oficial permite la reutilización bajo
[*Licence Ouverte / Open Licence*](https://www.etalab.gouv.fr/licence-ouverte-open-licence/),
con identificación de la fuente y de la fecha de la versión, sin desnaturalizar
su contenido. El manifiesto de la importación incorpora esta atribución, los
enlaces oficiales y las huellas SHA-256 de los cinco XML originales. La licencia
de los datos es independiente de la del código del importador.

Se conservan los códigos, nombres oficiales en francés e inglés, clasificación,
factor de Jones, 74 componentes nutricionales, valores originales, límites,
trazas, ausencias, rangos, códigos de confianza y referencias bibliográficas.
La transformación a JSON no calcula ni completa datos nutricionales ausentes.

Las fichas antiguas de `alimentos/*.json` tienen su propio formato y no deben
atribuirse automáticamente a CIQUAL. La correspondencia y revisión de esas
fichas y los recursos visuales son trabajos de curación posteriores.

Las etiquetas españolas de `ciqual/translations.es.json` son traducciones de
Gymnasia, asistidas por Google Gemini y con revisión editorial específica. No son
traducciones oficiales de ANSES. Conservan las etiquetas oficiales francesas e
inglesas, y cada traducción se vincula a su texto de origen por SHA-256 para
detectarla como obsoleta si cambia la fuente. Los nombres científicos y las
referencias bibliográficas no se traducen.
