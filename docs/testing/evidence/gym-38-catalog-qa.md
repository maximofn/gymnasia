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

## QA nativa pendiente

En el APK de Producción 1.46.3, comprobar en Dieta que «arroz blanco» aparece
sin conexión tras una instalación limpia. En Coach, repetir la consulta literal
y comprobar la respuesta de 130 kcal por 100 g. Probar después una petición
compuesta («… y añádelo a mi comida») para confirmar que se conserva el flujo
de herramientas y su confirmación antes de escribir.
