from uuid import UUID

from fastapi import Header, HTTPException, status

from app.core.config import get_settings


async def get_current_user_id(x_user_id: str | None = Header(default=None)) -> UUID:
    settings = get_settings()
    raw_user_id = x_user_id or settings.default_dev_user_id

    try:
        return UUID(raw_user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="x-user-id no es un UUID valido",
        ) from exc
