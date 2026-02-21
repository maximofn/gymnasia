from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    AIProviderEnum,
    BackgroundJob,
    DietDay,
    DietItem,
    DietItemEstimate,
    DietMeal,
    JobStatusEnum,
    JobTypeEnum,
    MealTypeEnum,
    MediaAsset,
    MediaKindEnum,
    MediaStatusEnum,
    User,
    ExerciseMediaLink,
)
from app.schemas import (
    BackgroundJobResponse,
    DietItemResponse,
    DietPhotoEstimateRequest,
    DietPhotoEstimateResponse,
    ExerciseMediaGenerateRequest,
    ExerciseMediaLinkCreateRequest,
    ExerciseMediaLinkResponse,
    MediaAssetResponse,
    MediaSignedUrlResponse,
    MediaUploadIntentRequest,
    MediaUploadIntentResponse,
)
from app.services.ai_runtime import estimate_diet_item_from_asset, pick_active_provider

router = APIRouter(prefix="/media", tags=["media"])


def _uuid_or_404(raw_id: str) -> UUID:
    try:
        return UUID(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Resource not found") from exc


def _to_asset_response(row: MediaAsset) -> MediaAssetResponse:
    return MediaAssetResponse(
        id=str(row.id),
        kind=row.kind,
        status=row.status,
        storage_bucket=row.storage_bucket,
        storage_path=row.storage_path,
        mime_type=row.mime_type,
        size_bytes=row.size_bytes,
        retention_delete_at=row.retention_delete_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _to_job_response(row: BackgroundJob) -> BackgroundJobResponse:
    return BackgroundJobResponse(
        id=str(row.id),
        type=row.type,
        status=row.status,
        payload=row.payload,
        result=row.result,
        attempts=row.attempts,
        max_attempts=row.max_attempts,
        run_after=row.run_after,
        last_error=row.last_error,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _to_exercise_link_response(row: ExerciseMediaLink) -> ExerciseMediaLinkResponse:
    return ExerciseMediaLinkResponse(
        id=str(row.id),
        exercise_name=row.exercise_name,
        machine_photo_asset_id=str(row.machine_photo_asset_id) if row.machine_photo_asset_id else None,
        generated_image_asset_id=str(row.generated_image_asset_id) if row.generated_image_asset_id else None,
        generated_video_asset_id=str(row.generated_video_asset_id) if row.generated_video_asset_id else None,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _signed_url(asset: MediaAsset, expires_in_seconds: int = 300) -> str:
    expires_at = int((datetime.now(UTC) + timedelta(seconds=expires_in_seconds)).timestamp())
    return (
        f"https://signed.local/{asset.storage_bucket}/{asset.storage_path}"
        f"?expires={expires_at}&asset={asset.id}"
    )


@router.post("/uploads/intents", response_model=MediaUploadIntentResponse, status_code=status.HTTP_201_CREATED)
def create_upload_intent(
    payload: MediaUploadIntentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MediaUploadIntentResponse:
    suffix = payload.file_name.split(".")[-1].lower() if payload.file_name and "." in payload.file_name else "bin"
    now = datetime.now(UTC)
    storage_path = f"{user.id}/{now.year:04d}/{now.month:02d}/{uuid4()}.{suffix}"

    asset = MediaAsset(
        user_id=user.id,
        kind=payload.kind,
        status=MediaStatusEnum.uploaded,
        storage_bucket=payload.bucket,
        storage_path=storage_path,
        mime_type=payload.mime_type,
        size_bytes=payload.size_bytes,
        retention_delete_at=datetime.now(UTC) + timedelta(days=365),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    return MediaUploadIntentResponse(
        asset=_to_asset_response(asset),
        upload_url=f"https://upload.local/{asset.storage_bucket}/{asset.storage_path}",
        signed_read_url=_signed_url(asset),
    )


@router.get("/assets", response_model=list[MediaAssetResponse])
def list_assets(
    kind: MediaKindEnum | None = Query(default=None),
    status_filter: MediaStatusEnum | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MediaAssetResponse]:
    query = db.query(MediaAsset).filter(MediaAsset.user_id == user.id)
    if kind is not None:
        query = query.filter(MediaAsset.kind == kind)
    if status_filter is not None:
        query = query.filter(MediaAsset.status == status_filter)

    rows = query.order_by(MediaAsset.created_at.desc()).limit(limit).all()
    return [_to_asset_response(row) for row in rows]


@router.post("/assets/{asset_id}/signed-url", response_model=MediaSignedUrlResponse)
def get_signed_url(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MediaSignedUrlResponse:
    row = (
        db.query(MediaAsset)
        .filter(MediaAsset.id == _uuid_or_404(asset_id), MediaAsset.user_id == user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    return MediaSignedUrlResponse(asset_id=str(row.id), signed_url=_signed_url(row), expires_in_seconds=300)


@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    row = (
        db.query(MediaAsset)
        .filter(MediaAsset.id == _uuid_or_404(asset_id), MediaAsset.user_id == user.id)
        .first()
    )
    if row is None:
        return

    row.status = MediaStatusEnum.deleted
    row.retention_delete_at = datetime.now(UTC)
    db.add(row)
    db.commit()


@router.post("/diet/estimate", response_model=DietPhotoEstimateResponse, status_code=status.HTTP_201_CREATED)
def estimate_diet_from_photo(
    payload: DietPhotoEstimateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DietPhotoEstimateResponse:
    provider = pick_active_provider(db, user.id)
    if provider is None:
        raise HTTPException(status_code=409, detail="AI disabled. Configure an active BYOK key first.")

    asset = (
        db.query(MediaAsset)
        .filter(MediaAsset.id == _uuid_or_404(payload.asset_id), MediaAsset.user_id == user.id)
        .first()
    )
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.kind not in {MediaKindEnum.diet_photo, MediaKindEnum.diet_label, MediaKindEnum.diet_menu}:
        raise HTTPException(status_code=400, detail="Asset kind not valid for diet estimation")

    estimate_payload, confidence = estimate_diet_item_from_asset(
        asset_id=str(asset.id),
        kind=asset.kind,
        override_name=payload.item_name_override,
    )

    day = db.query(DietDay).filter(DietDay.user_id == user.id, DietDay.day_date == payload.day_date).first()
    if day is None:
        day = DietDay(user_id=user.id, day_date=payload.day_date, notes=None)
        db.add(day)
        db.flush()

    meal = (
        db.query(DietMeal)
        .filter(DietMeal.day_id == day.id, DietMeal.meal_type == payload.meal_type)
        .order_by(DietMeal.position.asc())
        .first()
    )
    if meal is None:
        max_position = db.query(DietMeal).filter(DietMeal.day_id == day.id).count()
        meal = DietMeal(
            day_id=day.id,
            meal_type=payload.meal_type,
            title=payload.meal_type.value.title(),
            position=max_position,
        )
        db.add(meal)
        db.flush()

    item = DietItem(
        meal_id=meal.id,
        name=estimate_payload["name"],
        grams=estimate_payload["grams"],
        serving_count=estimate_payload["serving_count"],
        calories_kcal=estimate_payload["calories_kcal"],
        protein_g=estimate_payload["protein_g"],
        carbs_g=estimate_payload["carbs_g"],
        fat_g=estimate_payload["fat_g"],
        calories_protein_kcal=estimate_payload["calories_protein_kcal"],
        calories_carbs_kcal=estimate_payload["calories_carbs_kcal"],
        calories_fat_kcal=estimate_payload["calories_fat_kcal"],
        created_by_ai=True,
    )
    db.add(item)
    db.flush()

    estimate_row = DietItemEstimate(
        diet_item_id=item.id,
        media_asset_id=asset.id,
        provider=provider,
        confidence_percent=confidence,
        estimate_payload=estimate_payload,
    )
    db.add(estimate_row)
    db.commit()
    db.refresh(item)

    return DietPhotoEstimateResponse(
        provider=provider,
        confidence_percent=confidence,
        meal_type=payload.meal_type,
        day_date=payload.day_date,
        item=DietItemResponse(
            id=str(item.id),
            name=item.name,
            grams=float(item.grams) if item.grams is not None else None,
            serving_count=float(item.serving_count) if item.serving_count is not None else None,
            calories_kcal=float(item.calories_kcal) if item.calories_kcal is not None else None,
            protein_g=float(item.protein_g) if item.protein_g is not None else None,
            carbs_g=float(item.carbs_g) if item.carbs_g is not None else None,
            fat_g=float(item.fat_g) if item.fat_g is not None else None,
            calories_protein_kcal=float(item.calories_protein_kcal) if item.calories_protein_kcal is not None else None,
            calories_carbs_kcal=float(item.calories_carbs_kcal) if item.calories_carbs_kcal is not None else None,
            calories_fat_kcal=float(item.calories_fat_kcal) if item.calories_fat_kcal is not None else None,
            created_by_ai=item.created_by_ai,
        ),
    )


@router.get("/exercise-links", response_model=list[ExerciseMediaLinkResponse])
def list_exercise_links(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ExerciseMediaLinkResponse]:
    rows = (
        db.query(ExerciseMediaLink)
        .filter(ExerciseMediaLink.user_id == user.id)
        .order_by(ExerciseMediaLink.updated_at.desc())
        .all()
    )
    return [_to_exercise_link_response(row) for row in rows]


@router.post("/exercise-links", response_model=ExerciseMediaLinkResponse, status_code=status.HTTP_201_CREATED)
def create_exercise_link(
    payload: ExerciseMediaLinkCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExerciseMediaLinkResponse:
    machine_photo_asset_id = _uuid_or_404(payload.machine_photo_asset_id) if payload.machine_photo_asset_id else None
    if machine_photo_asset_id is not None:
        asset = (
            db.query(MediaAsset)
            .filter(MediaAsset.id == machine_photo_asset_id, MediaAsset.user_id == user.id)
            .first()
        )
        if asset is None:
            raise HTTPException(status_code=404, detail="Machine photo asset not found")

    row = ExerciseMediaLink(
        user_id=user.id,
        exercise_name=payload.exercise_name,
        machine_photo_asset_id=machine_photo_asset_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_exercise_link_response(row)


def _run_generation_job(
    *,
    link: ExerciseMediaLink,
    user: User,
    db: Session,
    kind: MediaKindEnum,
    job_type: JobTypeEnum,
    prompt: str | None,
    provider: AIProviderEnum,
) -> BackgroundJob:
    job = BackgroundJob(
        user_id=user.id,
        type=job_type,
        status=JobStatusEnum.running,
        payload={
            "link_id": str(link.id),
            "exercise_name": link.exercise_name,
            "prompt": prompt,
            "provider": provider.value,
        },
        attempts=1,
        max_attempts=5,
    )
    db.add(job)
    db.flush()

    generated_asset = MediaAsset(
        user_id=user.id,
        kind=kind,
        status=MediaStatusEnum.ready,
        storage_bucket="gymnasia-generated",
        storage_path=f"{user.id}/generated/{kind.value}/{job.id}.bin",
        mime_type="image/png" if kind == MediaKindEnum.exercise_generated_image else "video/mp4",
        size_bytes=1024 * (300 if kind == MediaKindEnum.exercise_generated_video else 120),
        retention_delete_at=datetime.now(UTC) + timedelta(days=365),
    )
    db.add(generated_asset)
    db.flush()

    if kind == MediaKindEnum.exercise_generated_image:
        link.generated_image_asset_id = generated_asset.id
    else:
        link.generated_video_asset_id = generated_asset.id
    db.add(link)

    job.status = JobStatusEnum.done
    job.result = {
        "asset_id": str(generated_asset.id),
        "kind": kind.value,
        "provider": provider.value,
    }
    db.add(job)

    return job


@router.post("/exercise-links/{link_id}/generate-image", response_model=BackgroundJobResponse, status_code=status.HTTP_201_CREATED)
def generate_exercise_image(
    link_id: str,
    payload: ExerciseMediaGenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BackgroundJobResponse:
    provider = pick_active_provider(db, user.id)
    if provider is None:
        raise HTTPException(status_code=409, detail="AI disabled. Configure an active BYOK key first.")

    link = (
        db.query(ExerciseMediaLink)
        .filter(ExerciseMediaLink.id == _uuid_or_404(link_id), ExerciseMediaLink.user_id == user.id)
        .first()
    )
    if link is None:
        raise HTTPException(status_code=404, detail="Exercise media link not found")

    job = _run_generation_job(
        link=link,
        user=user,
        db=db,
        kind=MediaKindEnum.exercise_generated_image,
        job_type=JobTypeEnum.exercise_image_generation,
        prompt=payload.prompt,
        provider=provider,
    )

    db.commit()
    db.refresh(job)
    return _to_job_response(job)


@router.post("/exercise-links/{link_id}/generate-video", response_model=BackgroundJobResponse, status_code=status.HTTP_201_CREATED)
def generate_exercise_video(
    link_id: str,
    payload: ExerciseMediaGenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BackgroundJobResponse:
    provider = pick_active_provider(db, user.id)
    if provider is None:
        raise HTTPException(status_code=409, detail="AI disabled. Configure an active BYOK key first.")

    link = (
        db.query(ExerciseMediaLink)
        .filter(ExerciseMediaLink.id == _uuid_or_404(link_id), ExerciseMediaLink.user_id == user.id)
        .first()
    )
    if link is None:
        raise HTTPException(status_code=404, detail="Exercise media link not found")

    job = _run_generation_job(
        link=link,
        user=user,
        db=db,
        kind=MediaKindEnum.exercise_generated_video,
        job_type=JobTypeEnum.exercise_video_generation,
        prompt=payload.prompt,
        provider=provider,
    )

    db.commit()
    db.refresh(job)
    return _to_job_response(job)


@router.get("/jobs", response_model=list[BackgroundJobResponse])
def list_jobs(
    status_filter: JobStatusEnum | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BackgroundJobResponse]:
    query = db.query(BackgroundJob).filter(BackgroundJob.user_id == user.id)
    if status_filter is not None:
        query = query.filter(BackgroundJob.status == status_filter)

    rows = query.order_by(BackgroundJob.created_at.desc()).limit(limit).all()
    return [_to_job_response(row) for row in rows]
