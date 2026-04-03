# Generate Exercise Images

Genera imágenes de ejercicios (hombre y mujer) usando Nano Banana 2 en Hugging Face.

## Requisitos

- Token de HF PRO en `.env` (raíz del proyecto): `HF_TOKEN=hf_xxx`
- Entorno uv ya configurado en `image-generation/`

## Estructura

```
.env                        # HF_TOKEN (no se sube a git)
image-generation/
├── generate_images.py      # Script unificado de generación
ejercicios/
├── press-banca.json        # Un JSON por ejercicio
├── images/
│   ├── press-banca-male.webp
│   └── press-banca-female.webp
```

## JSON de ejercicio

Cada ejercicio tiene su propio archivo JSON:

```json
{
  "id": "press-banca",
  "name": "Press de banca",
  "image_male": "press-banca-male.webp",
  "image_female": "press-banca-female.webp",
  "muscle_group": "pecho",
  "secondary_muscles": ["tríceps", "hombro anterior"],
  "equipment": "barra",
  "difficulty": "intermediate",
  "instructions": "Descripción del ejercicio..."
}
```

## Añadir un nuevo ejercicio

1. Crear el JSON en `ejercicios/<id>.json` siguiendo la estructura anterior
2. Añadir la entrada en `EXERCISE_PROMPTS` dentro de `image-generation/generate_images.py`:

```python
EXERCISE_PROMPTS = {
    "press-banca": ("a barbell bench press lying on a flat bench", "side view"),
    "nuevo-ejercicio": ("english description of the exercise", "side view"),
}
```

La descripción debe ser en inglés y lo más específica posible sobre la posición del cuerpo.
El view puede ser: `"side view"`, `"front view"`, `"3/4 diagonal view"`.

3. Ejecutar el script helper de la skill:

```bash
# Generar solo un ejercicio
.claude/skills/generate-exercise-image/scripts/generate.sh --id <id>

# Generar todos los que falten
.claude/skills/generate-exercise-image/scripts/generate.sh
```

El script se encarga de hacer `cd` a `image-generation/`, desactivar conda y ejecutar `uv run`.

El script salta imágenes que ya existen. Para regenerar, borrar primero las imágenes en `ejercicios/images/`.

## Prompt template

Todas las imágenes usan el mismo template para mantener consistencia visual:

```
Minimal flat illustration of a {man/woman} performing {exercise}, {view}.
Silhouette style with clean lines, dark charcoal background (#0D1117).
The figure is outlined in soft lime green (#CBFF1A) with subtle glow effect.
No face details, athletic body proportions.
Simple gym environment, no text, no watermark.
Modern fitness app aesthetic, clean composition with plenty of negative space.
16:9 aspect ratio.
```

## Detalles técnicos

- Modelo: Nano Banana 2 (via `multimodalart/nano-banana` en HF)
- El endpoint de Gradio es privado (`api_visibility: private`), el script fuerza `is_valid = True` y pasa el token en el campo manual del Space
- Resolución: 1K, Aspect Ratio: 16:9 (encaja en la tarjeta hero del Home: ~330x196px)
- Se generan 2 imágenes por ejercicio: `<id>-male.webp` y `<id>-female.webp`
