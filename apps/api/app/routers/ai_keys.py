from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import APIProviderKey, AIProviderEnum, User
from app.schemas import (
    AIKeyPatchRequest,
    AIKeyResponse,
    AIKeyTestRequest,
    AIKeyTestResponse,
    AIKeyUpsertRequest,
)
from app.services.encryption import encrypt_secret, fingerprint_secret

router = APIRouter(prefix="/ai-keys", tags=["ai-keys"])


def _to_response(key: APIProviderKey) -> AIKeyResponse:
    return AIKeyResponse(
        provider=key.provider,
        key_fingerprint=key.key_fingerprint,
        is_active=key.is_active,
        last_tested_at=key.last_tested_at,
        created_at=key.created_at,
        updated_at=key.updated_at,
    )


@router.get("", response_model=list[AIKeyResponse])
def list_keys(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AIKeyResponse]:
    keys = (
        db.query(APIProviderKey)
        .filter(APIProviderKey.user_id == user.id)
        .order_by(APIProviderKey.provider.asc())
        .all()
    )
    return [_to_response(k) for k in keys]


@router.post("", response_model=AIKeyResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_key(
    payload: AIKeyUpsertRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIKeyResponse:
    key = (
        db.query(APIProviderKey)
        .filter(
            APIProviderKey.user_id == user.id,
            APIProviderKey.provider == payload.provider,
        )
        .first()
    )

    ciphertext = encrypt_secret(payload.api_key)
    fingerprint = fingerprint_secret(payload.api_key)

    if key is None:
        key = APIProviderKey(
            user_id=user.id,
            provider=payload.provider,
            key_ciphertext=ciphertext,
            key_fingerprint=fingerprint,
            is_active=True,
        )
        db.add(key)
    else:
        key.key_ciphertext = ciphertext
        key.key_fingerprint = fingerprint
        key.is_active = True
        db.add(key)

    db.commit()
    db.refresh(key)
    return _to_response(key)


@router.patch("/{provider}", response_model=AIKeyResponse)
def patch_key(
    provider: AIProviderEnum,
    payload: AIKeyPatchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIKeyResponse:
    key = (
        db.query(APIProviderKey)
        .filter(APIProviderKey.user_id == user.id, APIProviderKey.provider == provider)
        .first()
    )
    if key is None:
        raise HTTPException(status_code=404, detail="Key not found")

    key.key_ciphertext = encrypt_secret(payload.api_key)
    key.key_fingerprint = fingerprint_secret(payload.api_key)
    key.is_active = True
    db.add(key)
    db.commit()
    db.refresh(key)
    return _to_response(key)


@router.delete("/{provider}", status_code=status.HTTP_204_NO_CONTENT)
def delete_key(
    provider: AIProviderEnum,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    key = (
        db.query(APIProviderKey)
        .filter(APIProviderKey.user_id == user.id, APIProviderKey.provider == provider)
        .first()
    )
    if key is None:
        return

    db.delete(key)
    db.commit()


@router.post("/test", response_model=AIKeyTestResponse)
def test_key(
    payload: AIKeyTestRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIKeyTestResponse:
    key = (
        db.query(APIProviderKey)
        .filter(
            APIProviderKey.user_id == user.id,
            APIProviderKey.provider == payload.provider,
            APIProviderKey.is_active.is_(True),
        )
        .first()
    )
    if key is None:
        raise HTTPException(status_code=404, detail="Active key not found")

    # V1 local check only. Provider live ping can be added in Fase 4.
    tested_at = datetime.now(UTC)
    key.last_tested_at = tested_at
    db.add(key)
    db.commit()

    return AIKeyTestResponse(
        provider=payload.provider,
        success=True,
        tested_at=tested_at,
        message="Key format accepted. Provider ping not implemented in v1 base.",
    )
