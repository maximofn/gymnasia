"""
Generate exercise images (male + female) for each exercise JSON in the ejercicios folder.
Uses Nano Banana 2 via Hugging Face Gradio API.

Usage:
    uv run generate_images.py                          # all exercises
    uv run generate_images.py --exercise press-banca   # single exercise only

Requires HF_TOKEN in .env file (Hugging Face PRO account).
"""

import json
import os
import sys
import shutil
import argparse
from pathlib import Path

from gradio_client import Client
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SCRIPT_DIR = Path(__file__).parent
IMAGES_DIR = SCRIPT_DIR / "images"
EXERCISES_DIR = SCRIPT_DIR

MODEL = "Nano Banana 2"
RESOLUTION = "1K"
ASPECT_RATIO = "16:9"

PROMPT_TEMPLATE = (
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
}


def get_hf_token() -> str:
    token = os.environ.get("HF_TOKEN", "")
    if not token:
        print("Error: set HF_TOKEN in ejercicios/.env")
        sys.exit(1)
    return token


def generate_image(client: Client, token: str, prompt: str, output_path: Path) -> None:
    if output_path.exists():
        print(f"  Skipping (already exists): {output_path.name}")
        return

    print(f"  Generating: {output_path.name}")
    print(f"  Prompt: {prompt[:100]}...")

    result = client.predict(
        prompt,
        None,       # gallery
        ASPECT_RATIO,
        MODEL,
        RESOLUTION,
        token,      # manual token field
        fn_index=2,
    )

    if result and isinstance(result, str):
        shutil.copy(result, str(output_path))
        print(f"  Saved: {output_path.name}")
    else:
        print(f"  Warning: unexpected result: {result}")


def main():
    parser = argparse.ArgumentParser(description="Generate exercise images")
    parser.add_argument("--exercise", type=str, help="Generate only for this exercise id")
    args = parser.parse_args()

    token = get_hf_token()
    IMAGES_DIR.mkdir(exist_ok=True)

    print("Connecting to Nano Banana 2...")
    client = Client("multimodalart/nano-banana", token=token)
    # Force private endpoint to be accessible
    ep = client.endpoints[2]
    ep.is_valid = True

    # Find exercise JSONs
    json_files = sorted(EXERCISES_DIR.glob("*.json"))
    json_files = [f for f in json_files if f.name not in ("package.json", "index.json", "all.json")]

    if not json_files:
        print("No exercise JSON files found.")
        return

    for json_path in json_files:
        with open(json_path) as f:
            exercise = json.load(f)

        exercise_id = exercise["id"]

        if args.exercise and exercise_id != args.exercise:
            continue

        if exercise_id not in EXERCISE_PROMPTS:
            print(f"Skipping {exercise_id}: no prompt mapping defined in EXERCISE_PROMPTS")
            continue

        exercise_en, view = EXERCISE_PROMPTS[exercise_id]
        print(f"\n{'='*50}")
        print(f"Exercise: {exercise['name']} ({exercise_id})")
        print(f"{'='*50}")

        for gender, label in [("man", "male"), ("woman", "female")]:
            prompt = PROMPT_TEMPLATE.format(
                gender=gender,
                exercise_en=exercise_en,
                view=view,
            )
            output_path = IMAGES_DIR / f"{exercise_id}-{label}.webp"
            generate_image(client, token, prompt, output_path)

    # Rebuild all.json and index.json from individual exercise files
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

    print("\nDone!")


if __name__ == "__main__":
    main()
