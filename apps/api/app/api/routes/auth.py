from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter()


@router.get("/config")
async def auth_config() -> dict[str, str]:
    settings = get_settings()
    return {
        "supabase_url": settings.supabase_url,
        "auth_mode": "email_password",
        "email_verification": "required",
    }
