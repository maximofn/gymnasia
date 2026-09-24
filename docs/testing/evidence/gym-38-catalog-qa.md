# GYM-38 (ticket para probar y documentar el despachador de tools): consulta de alimentos

Fecha: 2026-09-24. La captura recibida del dispositivo tras la entrega de la
versión 1.46.2 muestra que Coach seguía respondiendo que no encontraba arroz
blanco. No se confirmó desde la captura la versión instalada ni el proveedor;
la causa concreta de esa respuesta anterior no se puede atribuir a una llamada
de tool, pues las tools de lectura no dejaban una traza de invocación.

El agregado publicado de alimentos contiene `arroz-blanco`, nombre «Arroz blanco
(cocido)», con 130 kcal por 100 g. Sus 39 entradas cumplen el esquema de la app.

## Verificación de la corrección propuesta

- Una copia generada del agregado se incluye en el bundle y el runtime la utiliza
  al arrancar sin caché ni red; una descarga válida la sustituye.
- La consulta literal «Busca arroz blanco en el catálogo y dime sus calorías por
  100 g» devuelve 130 kcal por 100 g desde el dispositivo. En el E2E se
  intercepta OpenAI y se comprueba que esa respuesta no necesita una petición
  al proveedor. [Captura web del E2E](../screenshots/gym-38-catalog-calories.png).
- Las consultas que incluyen otra acción, por ejemplo añadir el alimento a una
  comida, siguen el flujo del proveedor y las tools.
- `npm test`: 103 ficheros, 818 pruebas deterministas correctas.
- `npm run test:catalogs`, `npm run test:catalogs:e2e`,
  `npm run test:agent:e2e`, `npm run test:privacy:e2e`,
  `npm run check:catalogs`, `npm run check:legal`, `npm run test:legal`,
  `npm run check:data-inventory`, `npm run test:data-inventory` y
  `npm --workspace apps/mobile exec tsc --noEmit`: correctos.
- `APP_ENV=production npm --workspace apps/mobile exec -- expo export --platform android --dev`:
  bundle Android generado correctamente.

## QA web real con OpenAI

El 24 de septiembre de 2026 se probó la web pública en Brave con una clave BYOK
de OpenAI configurada por el mantenedor. La primera consulta al proveedor quedó
bloqueada porque la exportación de Vercel no incluía el snapshot firmado de
Production. Se corrigió y publicó con la [PR #271](https://github.com/maximofn/gymnasia/pull/271).

Una vez activado Coach, la consulta de macronutrientes reprodujo el fallo: OpenAI
llamó a `search_foods` con «arroz blanco» y después con «arroz», pero envió `0`
en todos los máximos opcionales. El ejecutor trataba cada cero como límite y
devolvía `results: []`. Se corrigió en la [PR #272](https://github.com/maximofn/gymnasia/pull/272),
con una regresión que usa los argumentos observados. La versión corregida se
publicó en `https://gymnasia.maximofn.com/` mediante el despliegue de Vercel
`dpl_353LJAanGo6uzeMoJe6J3soTRbnq`.

- La consulta «Busca arroz blanco en el catálogo y dime cuántos gramos de
  proteínas, carbohidratos y grasas tiene por 100 g» invocó `search_foods`.
  La tool devolvió «Arroz blanco (cocido)» con disponibilidad `fresh`, 2,7 g de
  proteínas, 28 g de carbohidratos y 0,3 g de grasas por 100 g. Coach mostró
  esos mismos valores.
- Ante «Quiero añadir 150 g ...; antes de guardar nada, espera mi confirmación»,
  Coach invocó `search_foods`, propuso 195 kcal, 4,05 g de proteínas, 42 g de
  carbohidratos y 0,45 g de grasas, y pidió confirmación. No invocó
  `add_meal_food`.
- Al responder «No, cancela la propuesta. No guardes nada», Coach confirmó la
  cancelación y no invocó ninguna tool. No se modificó el registro de dieta.

Esta QA verifica el flujo real de lectura y la espera/cancelación de una
propuesta de escritura en web. No ejecuta una escritura confirmada ni sustituye
la comprobación de instalación limpia y funcionamiento sin red en Android.

## QA nativa pendiente

En un APK de Producción que incluya la corrección, comprobar en Dieta que
«arroz blanco» aparece sin conexión tras una instalación limpia. En Coach,
repetir la consulta literal y comprobar la respuesta de 130 kcal por 100 g.
Probar después una petición compuesta («… y añádelo a mi comida») para
confirmar que se conserva el flujo de herramientas y su confirmación antes de
escribir.
