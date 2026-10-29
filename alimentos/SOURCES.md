# Fuentes del catálogo de alimentos

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
