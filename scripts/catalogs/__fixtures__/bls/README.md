# Fixtures BLS sintéticas

`synthetic.mjs` genera OOXML mínimo dentro de ZIP con alimentos y cifras
inventados. Ejercita el mismo lector de la fuente real, incluyendo números como
texto OOXML, cadenas, espacios de relleno, notas y valores ausentes.

No usa Excel ni Python durante las pruebas. No ejecuta las fórmulas que puedan
aparecer como texto en un diccionario y rechaza las celdas con fórmulas Excel.
La prueba de entrega completa, aparte, lee los dos XLSX oficiales versionados.
