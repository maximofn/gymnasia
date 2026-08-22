---
name: generate-exercise-image
description: Generar o regenerar las imágenes masculina y femenina de ejercicios del repositorio Gymnasia, manteniendo su estilo visual y usando por prioridad la herramienta de imágenes integrada de Codex, Nano Banana, Z-Image-Turbo y FLUX.2-dev. Usar al añadir ejercicios, completar imágenes ausentes o corregir ilustraciones existentes.
---

# Generate Exercise Images

Generar dos imágenes por ejercicio —variante masculina y femenina— con el estilo visual de Gymnasia. En una sesión interactiva, usar primero la herramienta de generación de imágenes integrada de Codex; recurrir a Hugging Face solo cuando esa ruta no esté disponible.

## Orden de preferencia

La skill admite cuatro rutas, en este orden:

| Prioridad | Ruta | Ejecución | Requiere |
|-----------|------|-----------|----------|
| 1 | Generador integrado de Codex | Herramienta de imágenes de la sesión | Disponibilidad en la sesión/suscripción de Codex |
| 2 | `nano-banana` | `generate_images.py` mediante Hugging Face | HF PRO |
| 3 | `z-image-turbo` | `generate_images.py` mediante Hugging Face | Nada |
| 4 | `flux2-dev` | `generate_images.py` mediante Hugging Face | Nada |

La herramienta integrada de Codex **no es un backend del script**. `generate_images.py` y `generate.sh` solo soportan los tres backends de Hugging Face y no pueden reutilizar la suscripción de Codex/ChatGPT como una clave de API. No usar `OPENAI_API_KEY` ni facturación de API salvo que el usuario solicite expresamente esa ruta.

Para la ruta integrada, emitir una llamada independiente por cada imagen o variante. Copiar el resultado final desde el directorio de imágenes generadas de Codex a `ejercicios/images/` y normalizarlo como WebP real de 768×432.

## Fallback y avisos

1. Intentar primero el generador integrado de Codex.
2. Si la herramienta no existe en la sesión, está bloqueada por límites/permisos o falla repetidamente, intentar `nano-banana` mediante el script.
3. Si tampoco se puede usar `nano-banana`, informar al usuario de que **no están disponibles ni el generador integrado de Codex ni Nano Banana** antes de continuar con los fallbacks restantes.
4. Generar entonces alternativas con `z-image-turbo` y `flux2-dev` para que el usuario elija.

Sin `--backend`, el script aplica su propio fallback interno: `nano-banana` → `z-image-turbo` → `flux2-dev`. Ese fallback no incluye la herramienta integrada de Codex.

Ejemplo para comparar los dos últimos backends:

```bash
# Generar con z-image-turbo
.claude/skills/generate-exercise-image/scripts/generate.sh --backend z-image-turbo --id <id>

# Generar con flux2-dev
.claude/skills/generate-exercise-image/scripts/generate.sh --backend flux2-dev --id <id>
```

Antes de generar con cada backend, renombrar las imágenes existentes para que el script no las salte. Guardar las imágenes con sufijo temporal (`<id>-male-z.webp`, `<id>-female-z.webp`, `<id>-male-flux.webp`, `<id>-female-flux.webp`), mostrarlas al usuario, y cuando el usuario elija un backend:

1. Renombrar las imágenes elegidas a `<id>-male.webp` y `<id>-female.webp` (quitar el sufijo `-z` o `-flux`)
2. Eliminar las imágenes descartadas
3. Verificar que el JSON `ejercicios/<id>.json` tiene los campos `"image_male": "images/<id>-male.webp"` e `"image_female": "images/<id>-female.webp"`
4. Regenerar `ejercicios/all.json` ejecutando el script (saltará las imágenes ya existentes pero reconstruirá los JSON)
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

3. Intentar generar primero `<id>-male` y `<id>-female` con la herramienta integrada de Codex, usando una llamada por variante y las imágenes aprobadas del repositorio solo como referencias de estilo.
4. Copiar las salidas seleccionadas a `ejercicios/images/<id>-male.webp` y `ejercicios/images/<id>-female.webp`; convertirlas a WebP real de 768×432 y revisar anatomía, técnica, equipamiento, color, encuadre y ausencia de texto o marcas.
5. Si la ruta integrada no está disponible, ejecutar el helper de Hugging Face:

```bash
# Generar solo un ejercicio (auto-fallback)
.claude/skills/generate-exercise-image/scripts/generate.sh --id <id>

# Generar con backend específico
.claude/skills/generate-exercise-image/scripts/generate.sh --backend z-image-turbo --id <id>

# Generar todos los que falten
.claude/skills/generate-exercise-image/scripts/generate.sh
```

El script se encarga de hacer `cd` a `image-generation/`, desactivar conda y ejecutar `uv run`. No intenta acceder a la suscripción de Codex.

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

- **Generador integrado de Codex**: ruta interactiva preferida. Usar el último modelo disponible en la herramienta de imágenes de la sesión. No requiere `OPENAI_API_KEY`; su disponibilidad y límites dependen de la sesión/suscripción. Guardar siempre los resultados finales dentro del repositorio, no únicamente en el directorio de imágenes generadas de Codex.
- **nano-banana**: Nano Banana 2 (via `multimodalart/nano-banana` en HF). El endpoint de Gradio es privado (`api_visibility: private`), el script fuerza `is_valid = True` y pasa el token en el campo manual del Space. Resolución: 1K, Aspect Ratio: 16:9.
- **z-image-turbo**: Z-Image-Turbo (via `mrfakename/Z-Image-Turbo`). Gratuito, rápido (9 inference steps). Resolución: 1024x1024.
- **flux2-dev**: FLUX.2-dev (via `black-forest-labs/FLUX.2-dev`). Gratuito, alta calidad pero más lento (30 inference steps). Resolución: 1024x1024. Incluye prompt upsampling.
- Se generan 2 imágenes por ejercicio: `<id>-male.webp` y `<id>-female.webp`
- Resolución final: 16:9 (encaja en la tarjeta hero del Home: ~330x196px)
