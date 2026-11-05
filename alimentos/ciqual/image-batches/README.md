# Imágenes CIQUAL por tandas

El mantenedor aprobó el estilo de las tres muestras el 5 de noviembre de 2026 y
autorizó continuar por tandas en la misma rama `codex/ciqual-food-image-samples`,
con PRs sucesivas. Las muestras se conservan sin regenerar.

Cada carpeta `0001/`, `0002/`, etc. contiene sus WebP y un `manifest.json` con
`batch_id`, estado de revisión, nombres originales y españoles, huella de origen,
prompt exacto, referencia de estilo y hash del WebP. Las imágenes son de Gymnasia,
generadas con la herramienta integrada de Codex, no proporcionadas por ANSES.
La preparación y variedad de cada ficha se respetan; no se reutiliza una imagen
para otras variantes por compartir el nombre principal.

## Primera tanda (`0001`)

| ID | Alimento |
| --- | --- |
| `ciqual-13005` | [Plátano, pulpa sin piel, crudo](0001/ciqual-13005.webp) |
| `ciqual-13034` | [Naranja, pulpa sin piel, sin pepitas, cruda](0001/ciqual-13034.webp) |
| `ciqual-13037` | [Pera, pulpa y piel, cruda](0001/ciqual-13037.webp) |
| `ciqual-20009` | [Zanahoria, cruda](0001/ciqual-20009.webp) |
| `ciqual-20057` | [Brócoli, crudo](0001/ciqual-20057.webp) |
| `ciqual-20172` | [Tomate cherry, crudo](0001/ciqual-20172.webp) |
| `ciqual-4008` | [Patata, sin piel, cruda](0001/ciqual-4008.webp) |
| `ciqual-22010` | [Huevo duro](0001/ciqual-22010.webp) |
| `ciqual-13014` | [Fresa, cruda](0001/ciqual-13014.webp) |
| `ciqual-13010` | [Membrillo, crudo](0001/ciqual-13010.webp) |

## Reanudar sin repetir imágenes

```bash
# Comprueba muestras y todas las tandas, incluyendo hashes y decodificación.
npm run check:ciqual:images

# Lista diez IDs pendientes y sus nombres, sin generar ni escribir nada.
npm run next:ciqual:images -- 10

npm run test:catalogs
```

El recuento distingue imágenes registradas de pendientes; no representa
disponibilidad en la app. La lista de pendientes conserva el orden del catálogo
fuente. Puede elegirse otro grupo de alimentos pendientes, como en esta primera
tanda de alimentos cotidianos, dejando sus IDs explícitos en el manifiesto.

Para una nueva tanda, seleccionar IDs no registrados, inspeccionar referencias
de las muestras aprobadas y emitir una llamada integrada por alimento. Convertir
las salidas a WebP real opaco de 1024 × 1024, conservar prompts y huellas en el
manifiesto e inspeccionar visualmente todos los archivos finales. Validar antes
de subir la misma rama y abrir la PR de la tanda. Nunca sobrescribir una imagen
existente como parte de la reanudación ni saltar a API de pago sin autorización.

Cada tanda puede revisarse y fusionarse por separado. Son archivos editoriales:
no alteran nutrientes, raciones, traducciones ni la proyección móvil. Añadirlos
aquí no cambia la app ni dispara una compilación Android. Integrar las imágenes
en el catálogo móvil es un trabajo posterior.
