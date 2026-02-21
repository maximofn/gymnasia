from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AIProviderEnum, APIProviderKey, MediaKindEnum

PROVIDER_PRIORITY: list[AIProviderEnum] = [
    AIProviderEnum.anthropic,
    AIProviderEnum.openai,
    AIProviderEnum.google,
]

SAFETY_PATTERNS: dict[str, tuple[str, ...]] = {
    "doping": (
        "esteroide",
        "esteroides",
        "anabolizante",
        "anabolizantes",
        "clenbuterol",
        "dopaje",
        "farmaco",
        "fármaco",
    ),
    "extreme_fasting_or_purging": (
        "purg",
        "vomitar",
        "vomito",
        "vómito",
        "ayuno extremo",
        "dejar de comer",
        "no comer",
    ),
}


def pick_active_provider(db: Session, user_id: UUID | str) -> AIProviderEnum | None:
    keys = (
        db.query(APIProviderKey)
        .filter(APIProviderKey.user_id == user_id, APIProviderKey.is_active.is_(True))
        .all()
    )
    active = {key.provider for key in keys}
    for provider in PROVIDER_PRIORITY:
        if provider in active:
            return provider
    return None


def detect_safety_flags(text: str) -> list[str]:
    lowered = text.lower()
    detected: list[str] = []

    for flag, patterns in SAFETY_PATTERNS.items():
        if any(pattern in lowered for pattern in patterns):
            detected.append(flag)

    return detected


def generate_chat_reply(user_message: str, safety_flags: list[str], provider: AIProviderEnum) -> str:
    if safety_flags:
        return (
            "No puedo ayudar con peticiones de riesgo (dopaje/farmacos o conductas alimentarias peligrosas). "
            "Puedo ayudarte con una alternativa segura de entrenamiento y nutricion."
        )

    return (
        f"(v1/{provider.value}) Te propongo una respuesta accionable sobre: '{user_message[:180]}'. "
        "Si quieres, te lo convierto en plan semanal con progresion y ajuste de carga."
    )


def estimate_diet_item_from_asset(
    asset_id: str,
    kind: MediaKindEnum,
    override_name: str | None = None,
) -> tuple[dict, float]:
    digest = hashlib.sha256(asset_id.encode("utf-8")).hexdigest()
    seed = int(digest[:8], 16)

    confidence = 70 + (seed % 26)
    if kind == MediaKindEnum.diet_label:
        confidence = min(99, confidence + 6)

    base_kcal = 260 + (seed % 460)
    protein = round(base_kcal * (0.18 + ((seed % 7) / 100)), 1)
    carbs = round(base_kcal * (0.34 + ((seed % 11) / 100)), 1)
    fat = round(base_kcal * (0.11 + ((seed % 9) / 100)), 1)

    name = override_name or {
        MediaKindEnum.diet_photo: "Plato estimado IA",
        MediaKindEnum.diet_label: "Producto etiquetado IA",
        MediaKindEnum.diet_menu: "Plato de carta IA",
        MediaKindEnum.exercise_machine_photo: "Item IA",
        MediaKindEnum.exercise_generated_image: "Item IA",
        MediaKindEnum.exercise_generated_video: "Item IA",
        MediaKindEnum.measurement_photo: "Item IA",
    }[kind]

    payload = {
        "name": name,
        "grams": 100.0,
        "serving_count": 1.0,
        "calories_kcal": float(base_kcal),
        "protein_g": protein,
        "carbs_g": carbs,
        "fat_g": fat,
        "calories_protein_kcal": round(protein * 4, 2),
        "calories_carbs_kcal": round(carbs * 4, 2),
        "calories_fat_kcal": round(fat * 9, 2),
        "estimated_at": datetime.now(UTC).isoformat(),
    }
    return payload, float(confidence)
