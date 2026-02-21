from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import BodyMeasurement, User
from app.schemas import (
    BodyMeasurementCreateRequest,
    BodyMeasurementPatchRequest,
    BodyMeasurementResponse,
)

router = APIRouter(prefix="/measurements", tags=["measurements"])


def _to_response(row: BodyMeasurement) -> BodyMeasurementResponse:
    return BodyMeasurementResponse(
        id=str(row.id),
        measured_at=row.measured_at,
        weight_kg=float(row.weight_kg) if row.weight_kg is not None else None,
        circumferences_cm={k: float(v) for k, v in (row.circumferences_cm or {}).items()},
        notes=row.notes,
        photo_asset_id=str(row.photo_asset_id) if row.photo_asset_id else None,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _uuid_or_404(raw_id: str) -> UUID:
    try:
        return UUID(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Measurement not found") from exc


def _optional_uuid(raw_id: str | None) -> UUID | None:
    if raw_id is None:
        return None
    try:
        return UUID(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid photo_asset_id") from exc


@router.get("", response_model=list[BodyMeasurementResponse])
def list_measurements(
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BodyMeasurementResponse]:
    if limit < 1:
        limit = 1
    if limit > 500:
        limit = 500

    rows = (
        db.query(BodyMeasurement)
        .filter(BodyMeasurement.user_id == user.id)
        .order_by(BodyMeasurement.measured_at.desc())
        .limit(limit)
        .all()
    )
    return [_to_response(r) for r in rows]


@router.post("", response_model=BodyMeasurementResponse, status_code=status.HTTP_201_CREATED)
def create_measurement(
    payload: BodyMeasurementCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BodyMeasurementResponse:
    measured_at = payload.measured_at or datetime.now(UTC)
    row = BodyMeasurement(
        user_id=user.id,
        measured_at=measured_at,
        weight_kg=payload.weight_kg,
        circumferences_cm=payload.circumferences_cm,
        notes=payload.notes,
        photo_asset_id=_optional_uuid(payload.photo_asset_id),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_response(row)


@router.patch("/{measurement_id}", response_model=BodyMeasurementResponse)
def patch_measurement(
    measurement_id: str,
    payload: BodyMeasurementPatchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BodyMeasurementResponse:
    row = (
        db.query(BodyMeasurement)
        .filter(BodyMeasurement.id == _uuid_or_404(measurement_id), BodyMeasurement.user_id == user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Measurement not found")

    if payload.measured_at is not None:
        row.measured_at = payload.measured_at
    if payload.weight_kg is not None:
        row.weight_kg = payload.weight_kg
    if payload.circumferences_cm is not None:
        row.circumferences_cm = payload.circumferences_cm
    if payload.notes is not None:
        row.notes = payload.notes
    if payload.photo_asset_id is not None:
        row.photo_asset_id = _optional_uuid(payload.photo_asset_id)

    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_response(row)


@router.delete("/{measurement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_measurement(
    measurement_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    row = (
        db.query(BodyMeasurement)
        .filter(BodyMeasurement.id == _uuid_or_404(measurement_id), BodyMeasurement.user_id == user.id)
        .first()
    )
    if row is None:
        return

    db.delete(row)
    db.commit()
