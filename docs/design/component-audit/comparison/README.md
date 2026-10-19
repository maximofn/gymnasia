# Comparación de la extracción

Las parejas `*-before.png` y `*-after.png` muestran el mismo recorrido en dos
exportaciones locales: código anterior y código refactorizado, con almacenes
vacíos independientes, sin credenciales. Se revisaron Inicio, Medidas, formulario
de medidas, planificación de dieta, notificaciones y diálogo de copia cifrada.

Se contrastaron composición, orden, tamaños y texto. Las sesiones del navegador
usan distinta densidad física al rasterizar texto; las capturas no constituyen
una prueba de igualdad de píxeles. El viewport CSS de ambas es 390 × 844.

La comparación inicial detectó que el botón Registrar crecía de 44 a 46 píxeles:
se corrigió la precedencia del tamaño en `Button` y la E2E del shell comprueba
ahora sus 44 píxeles tanto en móvil como en escritorio. Las capturas `after`
conservan la corrección. La pareja del formulario conserva el aspecto de los
campos extraídos a `TextField`.
