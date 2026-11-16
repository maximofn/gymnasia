# Licencia y atribución de los datos BLS 4.0

**Fuente:** Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS),
Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe.
DOI: [10.25826/Data20251217-134202-0](https://doi.org/10.25826/Data20251217-134202-0).

© Max Rubner-Institut. Los datos se reutilizan bajo
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/),
según la [declaración del editor en la página de descarga](https://www.blsdb.de/download),
verificada el 11 de noviembre de 2026.
[Texto legal completo](https://creativecommons.org/licenses/by/4.0/legalcode).

CC BY 4.0 permite compartir y adaptar los datos, incluso comercialmente, con
atribución, enlace a la licencia e identificación de los cambios. Conservar este
aviso y la procedencia al redistribuir la copia o sus derivados. No imponer
restricciones que impidan los usos autorizados por esa licencia.

**Cambios de Gymnasia:** organización determinista de los XLSX en JSON, IDs con
prefijo `bls-`, índices y páginas, unidades de microgramos representadas como `ug`,
interpretación explícita de ausencias/trazas/límites y aplicación trazable de las
erratas oficiales de agosto de 2026. Se sustituyen los valores y marcadores
publicados, se retira el término energético OLSAC duplicado sobre los valores ya
redondeados y se invalidan cantidades afectadas sin sustituto verificable. Las
cantidades efectivas pueden diferir del Excel; los originales completos se
conservan en los XLSX y en el diario `corrections.json`. Las fórmulas originales
se conservan junto a las corregidas. No es una publicación oficial de BLS 4.1 ni
implica respaldo del MRI a Gymnasia. Véanse el README, el perfil de erratas y las
limitaciones pendientes antes de usar estos datos para cálculos.

Los datos se suministran tal como están, sin garantías de exactitud, integridad
o adecuación para una finalidad concreta, conforme a la sección 5 de CC BY 4.0.
El editor ha publicado erratas: ver `known-issues.json` y el README antes de usar
los valores para cálculos. Las marcas y logotipos del MRI no se incluyen.

Esta licencia describe los datos originales y su reorganización; no atribuye al
MRI las demás fichas, imágenes o el código del repositorio.

Las imágenes editoriales de `image-batches/` son ilustraciones generadas por IA
para Gymnasia, no proporcionadas ni validadas por Max Rubner-Institut. Su
atribución, referencias y prompts se registran por tanda; este aviso de licencia
de los datos no atribuye al MRI esas imágenes ni las presenta como oficiales.
