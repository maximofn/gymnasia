# Imágenes de alimentos BLS: continuación por tandas

BLS permanece independiente de la app. Sus datos y erratas se fusionaron en la
[PR 455](https://github.com/maximofn/gymnasia/pull/455). La petición posterior
permite generar imágenes con el enfoque visual y editorial de CIQUAL; no integra
BLS en móvil ni publica una versión.

## Estado acumulado (13 de noviembre de 2026)

- Tandas `0001` a `0008`: **800/7.140 imágenes generadas y revisadas**.
- Progreso: **11,20 %; 6.340 pendientes**.
- Última tanda: `0008`, 100 imágenes desde `bls-D6A7000` hasta `bls-D7A4000`.
- Manifiesto y prompts: `alimentos/bls/image-batches/0008/manifest.json`.
- Nueve hojas en `docs/testing/assets/bls-food-images-0008-*.jpg`.
- Casos revisados a tamaño completo: `bls-D701800`, `bls-D720400`, `bls-D720600`, `bls-D735300`, `bls-D740500`, `bls-D750200`, `bls-D771700`, `bls-D7A1000`, `bls-D7A4000`.
- Correcciones: 2. Todas las salidas finales están revisadas.
- La PR 465, séptima tanda, seguía abierta al comenzar la octava, con
  `catalogs` y `prompt-policy` correctos para su SHA actual.
- Consultar GitHub para el estado actual de las PRs. BLS sigue fuera de la app.

## Flujo

- Rama actual: `codex/bls-food-images-0008`, basada en `codex/bls-food-images-0007`
  (PR 465, séptima tanda). Abrir la PR contra esa rama para mostrar solo la tanda
  `0008`. Consultar las PRs antes de continuar; si cambia o se fusiona una base,
  actualizar la base y comprobar diff y checks.
- Tandas de hasta 100 imágenes nuevas, una por
  código pendiente, con PR revisable. Consultar GitHub al empezar; este documento
  no autoriza fusionar una PR. Conservar el trabajo y los archivos del mantenedor.
- Worktree inicial: `/tmp/gymnasia-bls-import-20261111`. Si falta, recuperar la
  rama desde GitHub en un checkout limpio. No cambiar la rama BEDCA ni publicar
  su captura privada para continuar BLS.
- Leer `.claude/skills/generate-food-image/SKILL.md` y la skill `imagegen` de
  Codex. Usar el generador integrado con una llamada independiente por alimento.
  No cambiar a API de pago, claves de proveedor, Hugging Face o Wallabot sin
  autorización específica. No sustituir las imágenes por dibujos de código ni
  reutilizar una imagen para variantes.
- Consultar `npm run check:bls:images` y `npm run next:bls:images -- 100`: son de
  solo lectura. Reanudar una tanda interrumpida desde el plan y los recibos antes
  de generar otra. No descartar ni repetir salidas que ya existen.

## Estilo y preparación

Inspeccionar antes de adjuntar las referencias aprobadas:

- `alimentos/ciqual/image-samples/ciqual-13620.webp`: sólidos sobre el fondo.
- `alimentos/ciqual/image-samples/ciqual-20587.webp`: alimentos en cuenco.

Adjuntar una referencia por llamada, etiquetada `STYLE REFERENCE ONLY`: copiar
estilo, no su manzana, hoja o lentejas. Fotografía gastronómica realista, fondo
carbón opaco `#0D1117`, luz cálida suave, sombra discreta, alimento completo y
centrado, espacio oscuro alrededor y silueta reconocible a 48×48. Sin texto,
envases, marcas, utensilios, manos, decoración o ingredientes ajenos al nombre.

Usar **ambos nombres oficiales DE/EN completos**. Respetar grano, semillas,
crudo/cocinado, seco/hidratado, piel, hueso, tostado y relleno. No traducir ni
corregir las fichas para justificar una representación. En panes, `Toastbrot`
suele designar pan de molde; exigir superficie tostada solo cuando el alemán
indique `getoastet` o la ficha especifique ese estado. Buttermilk/quark se
incorporan a la masa, sin vasos ni coberturas. No representar propiedades
invisibles (gluten, vitaminas, grasa) mediante símbolos.

Son ilustraciones de Gymnasia generadas por IA, no proporcionadas ni validadas
por Max Rubner-Institut. No prueban receta, ingredientes exactos, alérgenos,
composición, propiedades nutricionales ni una ración de 100 g.

## Guardado y recuperación

1. Guardar un plan con IDs pendientes, nombres literales, huella DE/EN, prompt
   exacto y referencia relativa al repositorio.
2. Tras cada llamada, guardar ID, prompt y ruta del PNG original en un recibo
   **antes** de convertir. Conservar los originales de Codex en su ubicación.
3. Normalizar mecánicamente a WebP real opaco 1024×1024, calidad 90, en
   `alimentos/bls/image-batches/NNNN/bls-CODIGO.webp`.
4. Revisar **todos los WebP finales** mediante hojas de unas 12 miniaturas y
   abrir los casos dudosos a tamaño completo. Registrar hashes de los archivos
   revisados; regenerar exige revisar la nueva salida.
5. Crear el manifiesto con nombres exactos, `blsImageNameFingerprint`, hash del
   WebP, prompt enviado, referencia y su hash. `reviewed_ids` incluye todas las
   imágenes en el mismo orden. `status: pending-review`: nuestra revisión no es
   aprobación del mantenedor.

Cada carpeta numerada admite solo WebP y `manifest.json`. Guardar planes,
recibos, notas y hojas de contacto fuera de ella. Los checkpoints de cada
tanda viven en `/tmp/gymnasia-bls-images-NNNN/` (`0001` a `0008`): `plan.json`, un
`bls-CODIGO.receipt.json` por alimento y `review/notes.json`, con hashes revisados.
Los temporales son recuperación opcional; WebP, manifiesto, prompts y vistas
revisables de la PR son los entregables duraderos.

No modificar el catálogo nutricional, agregados, correcciones, fuentes,
traducciones, CIQUAL, `FOOD_PROMPTS` del generador legado ni `apps/mobile/**`.
El importador BLS conserva `image-batches/`; esa carpeta tiene un check propio.

## Validación y entrega

```bash
npm run check:bls:images
npm run test:catalogs  # incluye datos, erratas e imágenes BLS
# Para una verificación centrada solo en BLS: npm run test:bls
npm run check:catalogs
npm run check:bls
npm run check:data-inventory
npm run test:data-inventory
npm run check:legal
git diff --check
```

Revisar el diff, crear un commit en la rama, subirlo y abrir una PR. Dejarla
abierta salvo petición explícita de fusión. Informar de imágenes nuevas generadas
y revisadas, generadas/7.140, pendientes, porcentaje con dos decimales,
validaciones y estado observado de CI. Enlazar manifiesto y vistas revisables.
Las imágenes siguen fuera de la app.

## Límite del visor al recuperar resultados

No acumular muchos PNG originales en una sola respuesta de herramientas. El
visor rechazó una respuesta de unos 95 MB al superar su límite de 64 MiB, aunque
la generación y los recibos siguieron guardándose correctamente. Recoger las
salidas en bloques pequeños (por ejemplo cuatro imágenes), mantener recibos
antes de convertir y usar hojas de contacto para revisar. Si el visor falla,
comprobar archivos y recibos antes de repetir una llamada: un fallo de presentación
no significa que falte la imagen.

## CI observado en la primera tanda

La PR 456 seguía abierta al comenzar la tanda `0002`. Sus comprobaciones
`catalogs` y `board` no completaron la instalación de dependencias de Chromium
por fallos de resolución DNS de los servidores Ubuntu, incluso tras reintentar.
Los checks locales de la primera tanda sí pasaron. Consultar GitHub para el
estado actual; no desactivar comprobaciones ni tratar estos fallos como una
aprobación para fusionar. La segunda tanda tampoco autoriza la fusión.
