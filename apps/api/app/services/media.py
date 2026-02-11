from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.config import get_settings


def build_generation_result(*, generator: str) -> dict:
    settings = get_settings()
    generation_id = uuid4()
    suffix = "png" if generator == "google_nano_banana" else "mp4"
    output_path = f"generated/{generation_id}.{suffix}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.media_retention_days)

    return {
        "generation_id": generation_id,
        "status": "queued",
        "output_path": output_path,
        "expires_at": expires_at,
    }
