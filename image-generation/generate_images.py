"""
Generate images for exercises and foods using Nano Banana 2 via Hugging Face Gradio API.

Usage:
    uv run generate_images.py exercises                          # all exercises
    uv run generate_images.py exercises --id press-banca         # single exercise
    uv run generate_images.py foods                              # all foods
    uv run generate_images.py foods --id arroz-blanco            # single food

Requires HF_TOKEN in root .env file (Hugging Face PRO account).
"""

import json
import os
import sys
import shutil
import argparse
from pathlib import Path

from gradio_client import Client
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

ROOT_DIR = Path(__file__).parent.parent
SCRIPT_DIR = Path(__file__).parent

MODEL = "Nano Banana 2"
RESOLUTION = "1K"

# ---------------------------------------------------------------------------
# Exercise config
# ---------------------------------------------------------------------------

EXERCISES_DIR = ROOT_DIR / "ejercicios"
EXERCISES_IMAGES_DIR = EXERCISES_DIR / "images"
EXERCISE_ASPECT_RATIO = "16:9"

EXERCISE_PROMPT_TEMPLATE = (
    "Minimal flat illustration of a {gender} performing {exercise_en}, {view}. "
    "Silhouette style with clean lines, dark charcoal background (#0D1117). "
    "The figure is outlined in soft lime green (#CBFF1A) with subtle glow effect. "
    "No face details, athletic body proportions. "
    "Simple gym environment, no text, no watermark. "
    "Modern fitness app aesthetic, clean composition with plenty of negative space. 16:9 aspect ratio."
)

# Map exercise id -> (english description, view angle)
EXERCISE_PROMPTS = {
    "press-banca": ("a barbell bench press lying on a flat bench", "3/4 diagonal view"),
    "press-mancuernas": ("a dumbbell bench press lying on a flat bench, one dumbbell in each hand", "3/4 diagonal view"),
    "aperturas-mancuernas": ("dumbbell chest flyes lying on a flat bench, arms open wide with slight elbow bend", "3/4 diagonal view"),
    "aperturas-inclinadas-mancuernas": ("incline dumbbell chest flyes lying on an incline bench at 30-45 degrees, arms open wide with slight elbow bend", "3/4 diagonal view"),
    "press-unilateral-maquina": ("a seated single-arm chest press on a machine, pushing forward with one arm", "3/4 diagonal view"),
    "extensiones-triceps-cuerda": ("a standing tricep rope pushdown on a cable machine, arms pushing down", "3/4 diagonal view"),
    "jalon-unilateral-maquina": ("a seated single-arm plate-loaded lat pulldown machine with converging lever arms, pulling one handle down with one arm, no cables no bar", "3/4 diagonal view"),
    "remo-unilateral-maquina": ("a seated single-arm plate-loaded row machine, chest supported, pulling one handle back with one arm bringing the elbow close to the body, no cables", "3/4 diagonal view"),
    "jalon-poleas": ("a seated cable lat pulldown, pulling a wide bar down to the upper chest with both hands on a cable pulley machine, thighs locked under pads", "3/4 diagonal view"),
    "remo-polea": ("a seated cable row on a low pulley machine, feet on platform, pulling a handle toward the abdomen with both hands, back straight", "3/4 diagonal view"),
    "remo-cuello-polea-baja": ("a standing face pull on a low cable pulley, pulling a rope upward toward the neck with elbows high and wide, targeting rear deltoids", "3/4 diagonal view"),
    "curl-mancuernas-sentado": ("a seated incline dumbbell bicep curl, sitting on an incline bench with back supported, curling both dumbbells up toward the shoulders simultaneously", "3/4 diagonal view"),
    "curl-concentrado": ("a seated concentration curl, sitting on a bench with legs apart, elbow braced against inner thigh, curling a dumbbell up with one arm", "3/4 diagonal view"),
    "sentadilla-barra": ("a barbell back squat, standing with a barbell on the upper back behind the neck, squatting down with thighs parallel to the floor, feet shoulder width apart", "3/4 diagonal view"),
    "prensa-inclinada": ("a 45-degree incline leg press machine, seated with back against pad, pushing a weighted platform upward with both legs, knees bent at 90 degrees", "3/4 diagonal view"),
    "prensa-horizontal": ("a horizontal seated leg press machine, sitting upright pushing a vertical platform forward with both legs, knees bent at 90 degrees", "3/4 diagonal view"),
    "prensa-vertical": ("a vertical leg press machine with metal frame and guide rails, person lying on back on the base pad inside the machine frame, pushing a plate-loaded platform vertically upward with both feet along guide rails", "3/4 diagonal view"),
    "femoral-de-pie": ("a standing single-leg hamstring curl machine, standing upright with chest leaning on pad, curling one leg back bringing heel toward glute against a roller pad", "3/4 diagonal view from behind"),
    "femoral-tumbado": ("a prone lying leg curl machine, lying face down on a bench curling both heels toward glutes against a roller pad, gripping front handles", "side view"),
    "femoral-sentado": ("person sitting on a machine seat in a gym, torso upright, thighs flat on the seat, but the knees are bent sharply so the feet go DOWN and BACK with the soles of the feet facing the wall behind the chair, the calves are pressed against a round roller pad under the seat near the floor", "side view close-up"),
    "press-inclinado-unilateral-maquina": ("a seated single-arm incline chest press on a machine, pushing upward and forward with one arm on an inclined trajectory", "3/4 diagonal view"),
    "extensiones-triceps-barra": ("a standing tricep straight bar pushdown on a cable machine, gripping a straight bar pushing down", "3/4 diagonal view"),
    "gemelos-sentado": ("a seated calf raise machine, person sitting with a pad on top of the knees, feet on a platform with heels hanging off the edge, raising the heels upward by contracting the calves", "3/4 diagonal view"),
    "gemelos-de-pie": ("a standing calf raise machine, person standing upright with shoulder pads pressing down on the shoulders, toes on a platform with heels hanging off the edge, rising up on tiptoes by contracting the calves", "3/4 diagonal view from behind"),
    "gemelos-prensa": ("a calf press on a 45-degree leg press machine, person lying back on the inclined seat with legs almost fully extended, only the toes and balls of the feet on the bottom edge of the platform, pushing the platform by pointing the toes and extending the ankles", "side view"),
    "press-hombro-mancuernas": ("a seated dumbbell shoulder press, sitting on a bench with back support, pressing two dumbbells overhead with arms extended above the head, palms facing forward", "3/4 diagonal view"),
    "press-hombro-unilateral-maquina": ("a seated single-arm overhead shoulder press on a plate-loaded machine, sitting with back against pad, pushing one handle upward above the head with one arm, the other arm resting", "3/4 diagonal view"),
    "elevaciones-laterales-mancuernas": ("a standing dumbbell lateral raise, standing upright holding a dumbbell in each hand, arms raised out to the sides at shoulder height forming a T shape, slight bend in the elbows", "front view"),
    "elevaciones-frontales-mancuernas": ("a standing dumbbell front raise, standing upright holding a dumbbell in each hand, one arm raised straight forward to shoulder height in front of the body, palms facing down", "3/4 diagonal view"),
    "crunch-abdominales": ("a crunch exercise lying on the floor, knees bent with feet flat on the ground, hands behind the head, upper back and shoulders lifted off the floor contracting the abs", "side view"),
    "extension-cuadriceps": ("a seated leg extension machine, person sitting upright with back against the pad, ankles hooked behind a roller pad, legs extended forward and upward contracting the quadriceps", "side view"),
}

# ---------------------------------------------------------------------------
# Food config
# ---------------------------------------------------------------------------

FOODS_DIR = ROOT_DIR / "alimentos"
FOODS_IMAGES_DIR = FOODS_DIR / "images"
FOOD_ASPECT_RATIO = "1:1"

FOOD_PROMPT_TEMPLATE = (
    "{food_description}. "
    "Centered on a dark charcoal background (#0D1117). "
    "Clean studio food photography style, single subject, no plate clutter. "
    "Soft top-down warm lighting with subtle shadow. "
    "Vibrant, appetizing colors, high contrast against dark background. "
    "No text, no watermark, no hands, no utensils. "
    "Minimal composition, plenty of negative space. "
    "Optimized for small thumbnail display: bold shapes, clear silhouette, easily recognizable at 48x48px. "
    "Square 1:1 aspect ratio."
)

# Map food id -> english description (visually specific for small thumbnails)
FOOD_PROMPTS = {
    "aceite-girasol": "a small glass bottle of pale golden sunflower oil with a bright yellow sunflower beside it",
    "aceite-oliva": "a small glass bottle of golden-green extra virgin olive oil with a thin stream pouring",
    "aguacate": "a ripe avocado cut in half showing the green flesh and brown pit",
    "almendras": "a handful of whole raw almonds with brown skin, scattered loosely",
    "arroz-basmati": "a small bowl of cooked basmati rice, long slender separated grains with a slightly golden hue",
    "arroz-blanco": "a small bowl of cooked white rice, fluffy separated grains",
    "arroz-integral": "a small bowl of cooked brown rice, slightly nutty-looking grains",
    "atun": "a fresh raw tuna steak, deep red-pink flesh with clean cut",
    "atun-lata": "an open tin can of tuna in water, flaky light-pink chunks visible from above",
    "avena": "a small bowl of dry rolled oats, golden flakes",
    "boniato": "a baked sweet potato cut open showing bright orange flesh",
    "brocoli": "a single fresh broccoli floret, vibrant deep green",
    "claras-huevo": "a carton bottle of liquid egg whites pouring a stream of translucent glossy egg whites into the void",
    "espinacas": "a bunch of fresh baby spinach leaves, bright green and tender",
    "garbanzos": "a small bowl of cooked chickpeas, round beige-golden legumes",
    "huevo": "a whole brown egg next to a fried egg with bright yellow yolk",
    "leche-entera": "a glass of whole white milk, creamy and opaque",
    "leche-semidesnatada": "a glass of whole white milk, creamy and opaque",
    "leche-desnatada": "a glass of whole white milk, creamy and opaque",
    "lentejas": "a small bowl of cooked brown-green lentils, earthy and rustic",
    "manzana": "a single shiny red apple with a small green leaf on the stem",
    "nueces": "a few shelled walnut halves showing the wrinkled brain-like shape",
    "pan-integral": "a slice of whole wheat bread, dense texture with visible grain specks",
    "pasta": "a small portion of cooked spaghetti pasta twirled into a neat nest",
    "patata": "a boiled potato cut in half, smooth creamy-yellow interior",
    "pechuga-pavo": "a sliced grilled turkey breast fillet, lean white meat with grill marks",
    "pechuga-pollo": "a grilled chicken breast fillet, golden-brown sear marks on white meat",
    "platano": "a single ripe yellow banana with a few brown spots",
    "queso-fresco": "a wedge of fresh white cheese, soft and moist with a clean cut",
    "salmon": "a raw salmon fillet, vibrant orange-pink flesh with white fat lines",
    "tomate": "a single ripe red tomato with green stem, glossy skin",
    "yogur-griego": "a small bowl of thick creamy white Greek yogurt with a smooth surface",
}


# ---------------------------------------------------------------------------
# Shared generation logic
# ---------------------------------------------------------------------------

def get_hf_token() -> str:
    token = os.environ.get("HF_TOKEN", "")
    if not token:
        print("Error: set HF_TOKEN in image-generation/.env")
        sys.exit(1)
    return token


def generate_image(client: Client, token: str, prompt: str, output_path: Path, aspect_ratio: str) -> None:
    if output_path.exists():
        print(f"  Skipping (already exists): {output_path.name}")
        return

    print(f"  Generating: {output_path.name}")
    print(f"  Prompt: {prompt[:120]}...")

    result = client.predict(
        prompt,
        None,           # gallery
        aspect_ratio,
        MODEL,
        RESOLUTION,
        token,          # manual token field
        fn_index=2,
    )

    if result and isinstance(result, str):
        shutil.copy(result, str(output_path))
        print(f"  Saved: {output_path.name}")
    else:
        print(f"  Warning: unexpected result: {result}")


# ---------------------------------------------------------------------------
# Exercise generation
# ---------------------------------------------------------------------------

def generate_exercises(client: Client, token: str, exercise_id: str | None):
    EXERCISES_IMAGES_DIR.mkdir(exist_ok=True)

    json_files = sorted(EXERCISES_DIR.glob("*.json"))
    json_files = [f for f in json_files if f.name not in ("package.json", "index.json", "all.json")]

    if not json_files:
        print("No exercise JSON files found.")
        return

    for json_path in json_files:
        with open(json_path) as f:
            exercise = json.load(f)

        eid = exercise["id"]

        if exercise_id and eid != exercise_id:
            continue

        if eid not in EXERCISE_PROMPTS:
            print(f"Skipping {eid}: no prompt mapping defined in EXERCISE_PROMPTS")
            continue

        exercise_en, view = EXERCISE_PROMPTS[eid]
        print(f"\n{'='*50}")
        print(f"Exercise: {exercise['name']} ({eid})")
        print(f"{'='*50}")

        for gender, label in [("man", "male"), ("woman", "female")]:
            prompt = EXERCISE_PROMPT_TEMPLATE.format(
                gender=gender,
                exercise_en=exercise_en,
                view=view,
            )
            output_path = EXERCISES_IMAGES_DIR / f"{eid}-{label}.webp"
            generate_image(client, token, prompt, output_path, EXERCISE_ASPECT_RATIO)

    # Rebuild all.json and index.json
    all_exercises = []
    all_ids = []
    for jp in sorted(EXERCISES_DIR.glob("*.json")):
        if jp.name in ("package.json", "index.json", "all.json"):
            continue
        with open(jp) as f:
            all_exercises.append(json.load(f))
        all_ids.append(jp.stem)

    with open(EXERCISES_DIR / "all.json", "w") as f:
        json.dump(all_exercises, f, indent=2, ensure_ascii=False)
    with open(EXERCISES_DIR / "index.json", "w") as f:
        json.dump(all_ids, f, ensure_ascii=False)
    print(f"\nUpdated all.json ({len(all_exercises)} exercises) and index.json")


# ---------------------------------------------------------------------------
# Food generation
# ---------------------------------------------------------------------------

def generate_foods(client: Client, token: str, food_id: str | None):
    FOODS_IMAGES_DIR.mkdir(exist_ok=True)

    json_files = sorted(FOODS_DIR.glob("*.json"))
    json_files = [f for f in json_files if f.name not in ("package.json", "index.json", "all.json")]

    if not json_files:
        print("No food JSON files found.")
        return

    for json_path in json_files:
        with open(json_path) as f:
            food = json.load(f)

        fid = food["id"]

        if food_id and fid != food_id:
            continue

        if fid not in FOOD_PROMPTS:
            print(f"Skipping {fid}: no prompt mapping defined in FOOD_PROMPTS")
            continue

        food_description = FOOD_PROMPTS[fid]
        print(f"\n{'='*50}")
        print(f"Food: {food['name']} ({fid})")
        print(f"{'='*50}")

        prompt = FOOD_PROMPT_TEMPLATE.format(food_description=food_description)
        output_path = FOODS_IMAGES_DIR / f"{fid}.webp"
        generate_image(client, token, prompt, output_path, FOOD_ASPECT_RATIO)

    # Rebuild all.json and index.json
    all_foods = []
    all_index = []
    for jp in sorted(FOODS_DIR.glob("*.json")):
        if jp.name in ("package.json", "index.json", "all.json"):
            continue
        with open(jp) as f:
            all_foods.append(json.load(f))
        all_index.append({"id": jp.stem, "name": all_foods[-1]["name"]})

    with open(FOODS_DIR / "all.json", "w") as f:
        json.dump(all_foods, f, indent=2, ensure_ascii=False)
    with open(FOODS_DIR / "index.json", "w") as f:
        json.dump(all_index, f, indent=2, ensure_ascii=False)
    print(f"\nUpdated all.json ({len(all_foods)} foods) and index.json")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Generate images for exercises or foods")
    subparsers = parser.add_subparsers(dest="command", required=True)

    ex_parser = subparsers.add_parser("exercises", help="Generate exercise images")
    ex_parser.add_argument("--id", type=str, help="Generate only for this exercise id")

    food_parser = subparsers.add_parser("foods", help="Generate food images")
    food_parser.add_argument("--id", type=str, help="Generate only for this food id")

    args = parser.parse_args()

    token = get_hf_token()

    print("Connecting to Nano Banana 2...")
    client = Client("multimodalart/nano-banana", token=token)
    ep = client.endpoints[2]
    ep.is_valid = True

    if args.command == "exercises":
        generate_exercises(client, token, args.id)
    elif args.command == "foods":
        generate_foods(client, token, args.id)

    print("\nDone!")


if __name__ == "__main__":
    main()
