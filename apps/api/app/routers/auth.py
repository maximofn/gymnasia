from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, UserAISettings
from app.schemas import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.security import create_access_token, hash_password, verify_password

router = APIRouter(tags=["auth"])


def _is_adult(birth_date: date, today: date) -> bool:
    age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    return age >= 18


@router.post("/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower().strip()

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    if not _is_adult(payload.birth_date, datetime.now(UTC).date()):
        raise HTTPException(status_code=400, detail="Debes tener 18 años o más para registrarte")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        birth_date=payload.birth_date,
    )
    db.add(user)
    db.flush()

    ai_settings = UserAISettings(user_id=user.id)
    db.add(ai_settings)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return AuthResponse(
        access_token=token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            email_verified_at=user.email_verified_at,
        ),
    )


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return AuthResponse(
        access_token=token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            email_verified_at=user.email_verified_at,
        ),
    )


@router.post("/auth/verify-email")
def verify_email(
    _payload: VerifyEmailRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    user.email_verified_at = datetime.now(UTC)
    db.add(user)
    db.commit()
    return {"ok": True, "message": "Email verified"}


@router.post("/auth/forgot-password")
def forgot_password(_payload: ForgotPasswordRequest) -> dict:
    # V1 placeholder: no email provider integrated yet.
    return {
        "ok": True,
        "message": "If the account exists, reset instructions have been sent.",
    }


@router.post("/auth/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict:
    # V1 placeholder without reset token flow.
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if user is None:
        return {"ok": True}

    user.password_hash = hash_password(payload.new_password)
    db.add(user)
    db.commit()
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        email_verified_at=user.email_verified_at,
    )
