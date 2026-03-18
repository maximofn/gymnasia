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
    "press-unilateral-maquina": ("a seated single-arm chest press on a machine, pushing forward with one arm", "3/4 diagonal view"),
    "extensiones-triceps-cuerda": ("a standing tricep rope pushdown on a cable machine, arms pushing down", "3/4 diagonal view"),
    "extensiones-triceps-barra": ("a standing tricep straight bar pushdown on a cable machine, gripping a straight bar pushing down", "3/4 diagonal view"),
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
