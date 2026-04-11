# Generate Food Images

Genera imágenes de alimentos usando Hugging Face Spaces.

## Backends disponibles

El script soporta 3 backends de generación de imagen (en orden de preferencia):

| Backend | Space | Requiere | Calidad |
|---------|-------|----------|---------|
| `nano-banana` (default) | `multimodalart/nano-banana` | HF PRO | Alta |
| `z-image-turbo` | `mrfakename/Z-Image-Turbo` | Nada | Media-Alta |
| `flux2-dev` | `black-forest-labs/FLUX.2-dev` | Nada | Alta (lento) |

**Fallback automático**: sin `--backend`, el script prueba cada uno en orden hasta conectar.

**Si Nano Banana no está disponible**: informar al usuario de que el backend principal no responde y generar la imagen con los dos backends alternativos (`z-image-turbo` y `flux2-dev`) para que el usuario elija la que prefiera. Ejemplo:

```bash
# Generar con z-image-turbo
.claude/skills/generate-food-image/scripts/generate.sh --backend z-image-turbo --id <id>

# Generar con flux2-dev
.claude/skills/generate-food-image/scripts/generate.sh --backend flux2-dev --id <id>
```

Guardar las imágenes con sufijo temporal (`<id>-z.webp`, `<id>-flux.webp`), mostrarlas al usuario, y renombrar la elegida a `<id>.webp` eliminando la otra.

## Requisitos

- Token de HF PRO en `.env` (raíz del proyecto): `HF_TOKEN=hf_xxx`
  - Solo requerido para `nano-banana`. Los otros backends funcionan sin token PRO.

## Estructura

```
.env                        # HF_TOKEN (no se sube a git)
image-generation/
├── generate_images.py      # Script unificado de generación
alimentos/
├── arroz-blanco.json       # Un JSON por alimento
├── images/
│   └── arroz-blanco.webp
```

## JSON de alimento

Cada alimento tiene su propio archivo JSON:

```json
{
  "id": "arroz-blanco",
  "name": "Arroz blanco (cocido)",
  "category": "carbohidrato",
  "calories_per_100g": 130,
  "protein_per_100g": 2.7,
  "carbs_per_100g": 28,
  "fat_per_100g": 0.3,
  "fiber_per_100g": 0.4,
  "serving_size_g": 150,
  "serving_description": "1 ración (150g cocido)",
  "image": "arroz-blanco.webp"
}
```

## Añadir un nuevo alimento

1. Crear el JSON en `alimentos/<id>.json` siguiendo la estructura anterior
2. Añadir la entrada en `FOOD_PROMPTS` dentro de `image-generation/generate_images.py`:

```python
FOOD_PROMPTS = {
    "arroz-blanco": "a small bowl of cooked white rice, fluffy grains",
    "pechuga-pollo": "a grilled chicken breast fillet, golden sear marks",
    "nuevo-alimento": "english description of the food, key visual details",
}
```

La descripción debe ser en inglés, concisa y visualmente específica.
Incluir detalles que hagan el alimento reconocible a tamaño pequeño (color, forma, textura, presentación típica).

3. Documentar el prompt en `alimentos/prompts.md` siguiendo el formato existente (nombre, ID, Food description).

4. Ejecutar el script helper de la skill:

```bash
# Generar solo un alimento (auto-fallback)
.claude/skills/generate-food-image/scripts/generate.sh --id <id>

# Generar con backend específico
.claude/skills/generate-food-image/scripts/generate.sh --backend z-image-turbo --id <id>

# Generar todos los que falten
.claude/skills/generate-food-image/scripts/generate.sh
```

El script se encarga de hacer `cd` a `image-generation/`, desactivar conda y ejecutar `uv run`.

El script salta imágenes que ya existen. Para regenerar, borrar primero la imagen en `alimentos/images/`.

## Prompt template

Todas las imágenes usan el mismo template para mantener consistencia visual:

```
{food_description}.
Centered on a dark charcoal background (#0D1117).
Clean studio food photography style, single subject, no plate clutter.
Soft top-down warm lighting with subtle shadow.
Vibrant, appetizing colors, high contrast against dark background.
No text, no watermark, no hands, no utensils.
Minimal composition, plenty of negative space.
Optimized for small thumbnail display: bold shapes, clear silhouette, easily recognizable at 48x48px.
Square 1:1 aspect ratio.
```

### Por qué este prompt

Las imágenes se muestran como thumbnails pequeños (~48x48px) en las tarjetas de comida del móvil.
Por eso el prompt prioriza:

- **Sujeto centrado y único**: sin distracciones, se reconoce al instante.
- **Fondo oscuro uniforme (#0D1117)**: encaja con el theme de la app y crea contraste.
- **Formas claras y silueta definida**: legible incluso a tamaño muy reducido.
- **Colores vibrantes**: el alimento destaca sobre el fondo oscuro.
- **Sin texto/marcas/manos**: limpieza total para UI.
- **1:1 cuadrado**: encaja en thumbnails circulares o cuadrados sin recorte.

## Detalles técnicos

- **nano-banana**: Nano Banana 2 (via `multimodalart/nano-banana` en HF). El endpoint de Gradio es privado (`api_visibility: private`), el script fuerza `is_valid = True` y pasa el token en el campo manual del Space. Resolución: 1K, Aspect Ratio: 1:1.
- **z-image-turbo**: Z-Image-Turbo (via `mrfakename/Z-Image-Turbo`). Gratuito, rápido (9 inference steps). Resolución: 1024x1024.
- **flux2-dev**: FLUX.2-dev (via `black-forest-labs/FLUX.2-dev`). Gratuito, alta calidad pero más lento (30 inference steps). Resolución: 1024x1024. Incluye prompt upsampling.
- Se genera 1 imagen por alimento: `<id>.webp`
