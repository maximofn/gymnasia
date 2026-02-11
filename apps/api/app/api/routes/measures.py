from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db_session
from app.models.core import BodyMeasurement, ProgressPhoto
from app.schemas.measures import (
    BodyMeasurementCreate,
    BodyMeasurementOut,
    BodyMeasurementUpdate,
    ProgressPhotoCreate,
    ProgressPhotoOut,
)
from app.utils.auth import get_current_user_id
from app.utils.events import log_event

router = APIRouter()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def get_measurement_or_404(db: AsyncSession, user_id: UUID, measurement_id: UUID) -> BodyMeasurement:
    measurement = (
        await db.execute(
            select(BodyMeasurement).where(
                BodyMeasurement.id == measurement_id,
                BodyMeasurement.user_id == user_id,
                BodyMeasurement.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not measurement:
        raise HTTPException(status_code=404, detail="Medida no encontrada")
    return measurement


async def get_photo_or_404(db: AsyncSession, user_id: UUID, photo_id: UUID) -> ProgressPhoto:
    photo = (
        await db.execute(
            select(ProgressPhoto).where(
                ProgressPhoto.id == photo_id,
                ProgressPhoto.user_id == user_id,
                ProgressPhoto.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto de progreso no encontrada")
    return photo


@router.get("/body", response_model=list[BodyMeasurementOut])
async def list_body_measurements(
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[BodyMeasurement]:
    return (
        await db.execute(
            select(BodyMeasurement)
            .where(
                BodyMeasurement.user_id == user_id,
                BodyMeasurement.deleted_at.is_(None),
            )
            .order_by(BodyMeasurement.measured_at.desc())
        )
    ).scalars().all()


@router.post("/body", response_model=BodyMeasurementOut, status_code=status.HTTP_201_CREATED)
async def create_body_measurement(
    payload: BodyMeasurementCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> BodyMeasurement:
    measurement = BodyMeasurement(user_id=user_id, **payload.model_dump())
    db.add(measurement)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="measures",
        action="body_measurement.create",
        entity_type="body_measurements",
        entity_id=measurement.id,
        payload=payload.model_dump(mode="json"),
    )

    await db.commit()
    await db.refresh(measurement)
    return measurement


@router.patch("/body/{measurement_id}", response_model=BodyMeasurementOut)
async def update_body_measurement(
    measurement_id: UUID,
    payload: BodyMeasurementUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> BodyMeasurement:
    measurement = await get_measurement_or_404(db, user_id, measurement_id)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(measurement, key, value)

    await db.commit()
    await db.refresh(measurement)
    return measurement


@router.delete("/body/{measurement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_body_measurement(
    measurement_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    measurement = await get_measurement_or_404(db, user_id, measurement_id)
    measurement.deleted_at = utc_now()
    await db.commit()


@router.get("/photos", response_model=list[ProgressPhotoOut])
async def list_progress_photos(
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[ProgressPhoto]:
    return (
        await db.execute(
            select(ProgressPhoto)
            .where(
                ProgressPhoto.user_id == user_id,
                ProgressPhoto.deleted_at.is_(None),
            )
            .order_by(ProgressPhoto.measured_at.desc())
        )
    ).scalars().all()


@router.post("/photos", response_model=ProgressPhotoOut, status_code=status.HTTP_201_CREATED)
async def create_progress_photo(
    payload: ProgressPhotoCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> ProgressPhoto:
    photo = ProgressPhoto(user_id=user_id, **payload.model_dump())
    db.add(photo)
    await db.flush()
    await db.commit()
    await db.refresh(photo)
    return photo


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_progress_photo(
    photo_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    photo = await get_photo_or_404(db, user_id, photo_id)
    photo.deleted_at = utc_now()
    await db.commit()
