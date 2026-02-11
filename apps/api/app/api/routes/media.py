from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db_session
from app.models.core import MediaAsset
from app.schemas.media import (
    MediaAssetCreate,
    MediaAssetOut,
    MediaGenerateRequest,
    MediaGenerateResponse,
)
from app.services.media import build_generation_result
from app.utils.auth import get_current_user_id
from app.utils.events import log_event

router = APIRouter()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def get_media_or_404(db: AsyncSession, user_id: UUID, asset_id: UUID) -> MediaAsset:
    media = (
        await db.execute(
            select(MediaAsset).where(
                MediaAsset.id == asset_id,
                MediaAsset.user_id == user_id,
                MediaAsset.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Asset no encontrado")
    return media


@router.get("/assets", response_model=list[MediaAssetOut])
async def list_assets(
    source_type: str | None = Query(default=None),
    source_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[MediaAsset]:
    stmt = select(MediaAsset).where(MediaAsset.user_id == user_id, MediaAsset.deleted_at.is_(None))
    if source_type:
        stmt = stmt.where(MediaAsset.source_type == source_type)
    if source_id:
        stmt = stmt.where(MediaAsset.source_id == source_id)

    return (await db.execute(stmt.order_by(MediaAsset.created_at.desc()))).scalars().all()


@router.post("/assets", response_model=MediaAssetOut, status_code=status.HTTP_201_CREATED)
async def create_asset(
    payload: MediaAssetCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> MediaAsset:
    media = MediaAsset(user_id=user_id, **payload.model_dump())
    db.add(media)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="media",
        action="asset.create",
        entity_type="media_assets",
        entity_id=media.id,
        payload=payload.model_dump(mode="json"),
    )

    await db.commit()
    await db.refresh(media)
    return media


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    media = await get_media_or_404(db, user_id, asset_id)
    media.deleted_at = utc_now()
    await db.commit()


@router.post("/generate", response_model=MediaGenerateResponse)
async def generate_asset(
    payload: MediaGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> MediaGenerateResponse:
    source_asset = await get_media_or_404(db, user_id, payload.source_asset_id)

    generation = build_generation_result(generator=payload.generator)

    output = MediaAsset(
        user_id=user_id,
        source_type=source_asset.source_type,
        source_id=source_asset.source_id,
        storage_path=generation["output_path"],
        mime_type="image/png" if payload.generator == "google_nano_banana" else "video/mp4",
        generator=payload.generator,
        generation_prompt=payload.prompt,
        status=generation["status"],
        expires_at=generation["expires_at"],
    )
    db.add(output)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="media",
        action="generation.requested",
        entity_type="media_assets",
        entity_id=output.id,
        payload={
            "source_asset_id": str(source_asset.id),
            "generator": payload.generator,
            "prompt": payload.prompt,
        },
    )

    await db.commit()

    return MediaGenerateResponse(
        generation_id=output.id,
        status=output.status,
        output_path=output.storage_path,
    )


@router.post("/assets/{asset_id}/complete", response_model=MediaAssetOut)
async def complete_generation(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> MediaAsset:
    asset = await get_media_or_404(db, user_id, asset_id)
    asset.status = "completed"
    await db.commit()
    await db.refresh(asset)
    return asset
