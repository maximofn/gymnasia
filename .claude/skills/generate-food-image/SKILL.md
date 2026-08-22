---
name: generate-food-image
description: Generar o regenerar imágenes de alimentos del repositorio Gymnasia, manteniendo su estilo visual y usando por prioridad la herramienta de imágenes integrada de Codex, Nano Banana, Z-Image-Turbo y FLUX.2-dev. Usar al añadir alimentos, completar imágenes ausentes o corregir imágenes existentes.
---

# Generate Food Images

Generar una imagen por alimento con el estilo visual de Gymnasia. En una sesión interactiva, usar primero la herramienta de generación de imágenes integrada de Codex; recurrir a Hugging Face solo cuando esa ruta no esté disponible.

## Orden de preferencia

La skill admite cuatro rutas, en este orden:

| Prioridad | Ruta | Ejecución | Requiere |
|-----------|------|-----------|----------|
| 1 | Generador integrado de Codex | Herramienta de imágenes de la sesión | Disponibilidad en la sesión/suscripción de Codex |
| 2 | `nano-banana` | `generate_images.py` mediante Hugging Face | HF PRO |
| 3 | `z-image-turbo` | `generate_images.py` mediante Hugging Face | Nada |
| 4 | `flux2-dev` | `generate_images.py` mediante Hugging Face | Nada |

La herramienta integrada de Codex **no es un backend del script**. `generate_images.py` y `generate.sh` solo soportan los tres backends de Hugging Face y no pueden reutilizar la suscripción de Codex/ChatGPT como una clave de API. No usar `OPENAI_API_KEY` ni facturación de API salvo que el usuario solicite expresamente esa ruta.

Para la ruta integrada, emitir una llamada independiente por cada alimento. Copiar el resultado final desde el directorio de imágenes generadas de Codex a `alimentos/images/<id>.webp` y normalizarlo como WebP real de 1024×1024.

## Fallback y avisos

1. Intentar primero el generador integrado de Codex.
2. Si la herramienta no existe en la sesión, está bloqueada por límites/permisos o falla repetidamente, intentar `nano-banana` mediante el script.
3. Si tampoco se puede usar `nano-banana`, informar al usuario de que **no están disponibles ni el generador integrado de Codex ni Nano Banana** antes de continuar con los fallbacks restantes.
4. Generar entonces alternativas con `z-image-turbo` y `flux2-dev` para que el usuario elija.

Sin `--backend`, el script aplica su propio fallback interno: `nano-banana` → `z-image-turbo` → `flux2-dev`. Ese fallback no incluye la herramienta integrada de Codex.

Ejemplo para comparar los dos últimos backends:

```bash
# Generar con z-image-turbo
.claude/skills/generate-food-image/scripts/generate.sh --backend z-image-turbo --id <id>

# Generar con flux2-dev
.claude/skills/generate-food-image/scripts/generate.sh --backend flux2-dev --id <id>
```

Guardar las imágenes con sufijo temporal (`<id>-z.webp`, `<id>-flux.webp`), mostrarlas al usuario, y cuando el usuario elija una:

1. Renombrar la imagen elegida a `<id>.webp` (quitar el sufijo `-z` o `-flux`)
2. Eliminar la imagen descartada
3. Añadir o actualizar el campo `"image": "<id>.webp"` en `alimentos/<id>.json`
4. Regenerar `alimentos/all.json` ejecutando el script (saltará la imagen ya existente pero reconstruirá los JSON)
5. Crear un commit en una rama temática, subirla y abrir un pull request; no hacer push directo a `main`

## Requisitos

- Sesión de Codex con la herramienta integrada de imágenes disponible para la ruta preferida. No requiere `OPENAI_API_KEY`.
- Token de HF PRO en `.env` (raíz del proyecto): `HF_TOKEN=hf_xxx`
  - Solo requerido para `nano-banana`. Los otros backends funcionan sin token PRO.
- Entorno uv ya configurado en `image-generation/`

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

4. Intentar generar primero `<id>` con la herramienta integrada de Codex, usando una llamada para el alimento y las imágenes aprobadas del repositorio solo como referencias de estilo.
5. Copiar la salida seleccionada a `alimentos/images/<id>.webp`; convertirla a WebP real de 1024×1024 y revisar que el alimento sea reconocible, que el fondo, la iluminación y el encuadre coincidan con el estilo, y que no haya texto, marcas, manos ni utensilios.
6. Si la ruta integrada no está disponible, ejecutar el helper de Hugging Face:

```bash
# Generar solo un alimento (auto-fallback)
.claude/skills/generate-food-image/scripts/generate.sh --id <id>

# Generar con backend específico
.claude/skills/generate-food-image/scripts/generate.sh --backend z-image-turbo --id <id>

# Generar todos los que falten
.claude/skills/generate-food-image/scripts/generate.sh
```

El script se encarga de hacer `cd` a `image-generation/`, desactivar conda y ejecutar `uv run`. No intenta acceder a la suscripción de Codex.

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

- **Generador integrado de Codex**: ruta interactiva preferida. Usar el último modelo disponible en la herramienta de imágenes de la sesión. No requiere `OPENAI_API_KEY`; su disponibilidad y límites dependen de la sesión/suscripción. Guardar siempre el resultado final dentro del repositorio, no únicamente en el directorio de imágenes generadas de Codex.
- **nano-banana**: Nano Banana 2 (via `multimodalart/nano-banana` en HF). El endpoint de Gradio es privado (`api_visibility: private`), el script fuerza `is_valid = True` y pasa el token en el campo manual del Space. Resolución: 1K, Aspect Ratio: 1:1.
- **z-image-turbo**: Z-Image-Turbo (via `mrfakename/Z-Image-Turbo`). Gratuito, rápido (9 inference steps). Resolución: 1024x1024.
- **flux2-dev**: FLUX.2-dev (via `black-forest-labs/FLUX.2-dev`). Gratuito, alta calidad pero más lento (30 inference steps). Resolución: 1024x1024. Incluye prompt upsampling.
- Se genera 1 imagen por alimento: `<id>.webp`
