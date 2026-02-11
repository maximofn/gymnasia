from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db_session
from app.models.core import (
    ExerciseLibrary,
    TrainingPlan,
    TrainingPlanExercise,
    TrainingSession,
    TrainingSessionExercise,
    TrainingSessionSet,
    TrainingSet,
)
from app.schemas.training import (
    ExerciseCreate,
    ExerciseOut,
    ExerciseUpdate,
    PlanExerciseCreate,
    PlanExerciseOut,
    PlanExerciseReorderItem,
    PlanExerciseUpdate,
    PlanReorderItem,
    SessionFinishRequest,
    SessionOut,
    SessionSetUpdate,
    SessionStartRequest,
    TrainingPlanCreate,
    TrainingPlanOut,
    TrainingPlanUpdate,
    TrainingSetCreate,
    TrainingSetOut,
    TrainingSetUpdate,
)
from app.services.training import apply_session_to_template, register_personal_records
from app.utils.auth import get_current_user_id
from app.utils.events import log_audit, log_event

router = APIRouter()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def get_plan_or_404(db: AsyncSession, user_id: UUID, plan_id: UUID) -> TrainingPlan:
    plan = (
        await db.execute(
            select(TrainingPlan).where(
                TrainingPlan.id == plan_id,
                TrainingPlan.user_id == user_id,
                TrainingPlan.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Entrenamiento no encontrado")
    return plan


async def get_plan_exercise_or_404(db: AsyncSession, user_id: UUID, plan_exercise_id: UUID) -> TrainingPlanExercise:
    plan_exercise = (
        await db.execute(
            select(TrainingPlanExercise).where(
                TrainingPlanExercise.id == plan_exercise_id,
                TrainingPlanExercise.user_id == user_id,
                TrainingPlanExercise.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not plan_exercise:
        raise HTTPException(status_code=404, detail="Ejercicio del entrenamiento no encontrado")
    return plan_exercise


async def get_training_set_or_404(db: AsyncSession, user_id: UUID, set_id: UUID) -> TrainingSet:
    training_set = (
        await db.execute(
            select(TrainingSet).where(
                TrainingSet.id == set_id,
                TrainingSet.user_id == user_id,
                TrainingSet.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not training_set:
        raise HTTPException(status_code=404, detail="Serie no encontrada")
    return training_set


@router.get("/exercises", response_model=list[ExerciseOut])
async def list_exercises(
    q: str | None = Query(default=None),
    muscle_group: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[ExerciseLibrary]:
    stmt = select(ExerciseLibrary).where(
        ExerciseLibrary.user_id == user_id,
        ExerciseLibrary.deleted_at.is_(None),
    )

    if q:
        stmt = stmt.where(ExerciseLibrary.name.ilike(f"%{q}%"))
    if muscle_group:
        stmt = stmt.where(ExerciseLibrary.muscle_group == muscle_group)

    return (await db.execute(stmt.order_by(ExerciseLibrary.name.asc()))).scalars().all()


@router.post("/exercises", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    payload: ExerciseCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> ExerciseLibrary:
    exercise = ExerciseLibrary(user_id=user_id, **payload.model_dump())
    db.add(exercise)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="exercise.create",
        entity_type="exercise_library",
        entity_id=exercise.id,
        payload=payload.model_dump(),
    )
    await log_audit(
        db,
        user_id=user_id,
        table_name="exercise_library",
        record_id=exercise.id,
        action="create",
        changes=payload.model_dump(),
    )

    await db.commit()
    await db.refresh(exercise)
    return exercise


@router.patch("/exercises/{exercise_id}", response_model=ExerciseOut)
async def update_exercise(
    exercise_id: UUID,
    payload: ExerciseUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> ExerciseLibrary:
    exercise = (
        await db.execute(
            select(ExerciseLibrary).where(
                ExerciseLibrary.id == exercise_id,
                ExerciseLibrary.user_id == user_id,
                ExerciseLibrary.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")

    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(exercise, key, value)

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="exercise.update",
        entity_type="exercise_library",
        entity_id=exercise.id,
        payload=changes,
    )
    await log_audit(
        db,
        user_id=user_id,
        table_name="exercise_library",
        record_id=exercise.id,
        action="update",
        changes=changes,
    )

    await db.commit()
    await db.refresh(exercise)
    return exercise


@router.post("/exercises/{exercise_id}/clone", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED)
async def clone_exercise(
    exercise_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> ExerciseLibrary:
    source = (
        await db.execute(
            select(ExerciseLibrary).where(
                ExerciseLibrary.id == exercise_id,
                ExerciseLibrary.user_id == user_id,
                ExerciseLibrary.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")

    clone = ExerciseLibrary(
        user_id=user_id,
        name=f"{source.name} (copia)",
        muscle_group=source.muscle_group,
        equipment=source.equipment,
        instructions=source.instructions,
        tags=source.tags,
    )
    db.add(clone)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="exercise.clone",
        entity_type="exercise_library",
        entity_id=clone.id,
        payload={"source_id": str(source.id)},
    )
    await db.commit()
    await db.refresh(clone)
    return clone


@router.delete("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    exercise = (
        await db.execute(
            select(ExerciseLibrary).where(
                ExerciseLibrary.id == exercise_id,
                ExerciseLibrary.user_id == user_id,
                ExerciseLibrary.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not exercise:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")

    exercise.deleted_at = utc_now()
    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="exercise.delete",
        entity_type="exercise_library",
        entity_id=exercise.id,
        payload={},
    )
    await db.commit()


@router.get("/plans", response_model=list[TrainingPlanOut])
async def list_plans(
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[TrainingPlan]:
    return (
        await db.execute(
            select(TrainingPlan)
            .where(TrainingPlan.user_id == user_id, TrainingPlan.deleted_at.is_(None))
            .order_by(TrainingPlan.position.asc(), TrainingPlan.created_at.asc())
        )
    ).scalars().all()


@router.post("/plans", response_model=TrainingPlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: TrainingPlanCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TrainingPlan:
    max_position = (
        await db.execute(
            select(func.max(TrainingPlan.position)).where(
                TrainingPlan.user_id == user_id,
                TrainingPlan.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    plan = TrainingPlan(
        user_id=user_id,
        name=payload.name,
        description=payload.description,
        position=(max_position or 0) + 1,
    )
    db.add(plan)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="plan.create",
        entity_type="training_plan",
        entity_id=plan.id,
        payload=payload.model_dump(),
    )
    await log_audit(
        db,
        user_id=user_id,
        table_name="training_plans",
        record_id=plan.id,
        action="create",
        changes=payload.model_dump(),
    )

    await db.commit()
    await db.refresh(plan)
    return plan


@router.patch("/plans/{plan_id}", response_model=TrainingPlanOut)
async def update_plan(
    plan_id: UUID,
    payload: TrainingPlanUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TrainingPlan:
    plan = await get_plan_or_404(db, user_id, plan_id)
    changes = payload.model_dump(exclude_unset=True)

    for key, value in changes.items():
        setattr(plan, key, value)

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="plan.update",
        entity_type="training_plan",
        entity_id=plan.id,
        payload=changes,
    )
    await log_audit(
        db,
        user_id=user_id,
        table_name="training_plans",
        record_id=plan.id,
        action="update",
        changes=changes,
    )

    await db.commit()
    await db.refresh(plan)
    return plan


@router.post("/plans/{plan_id}/clone", response_model=TrainingPlanOut, status_code=status.HTTP_201_CREATED)
async def clone_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TrainingPlan:
    source_plan = await get_plan_or_404(db, user_id, plan_id)
    max_position = (
        await db.execute(
            select(func.max(TrainingPlan.position)).where(
                TrainingPlan.user_id == user_id,
                TrainingPlan.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    clone = TrainingPlan(
        user_id=user_id,
        name=f"{source_plan.name} (copia)",
        description=source_plan.description,
        position=(max_position or 0) + 1,
        version=1,
    )
    db.add(clone)
    await db.flush()

    source_exercises = (
        await db.execute(
            select(TrainingPlanExercise)
            .where(
                TrainingPlanExercise.user_id == user_id,
                TrainingPlanExercise.plan_id == source_plan.id,
                TrainingPlanExercise.deleted_at.is_(None),
            )
            .order_by(TrainingPlanExercise.position.asc())
        )
    ).scalars().all()

    for source_exercise in source_exercises:
        copied_exercise = TrainingPlanExercise(
            user_id=user_id,
            plan_id=clone.id,
            exercise_id=source_exercise.exercise_id,
            position=source_exercise.position,
            notes=source_exercise.notes,
        )
        db.add(copied_exercise)
        await db.flush()

        source_sets = (
            await db.execute(
                select(TrainingSet)
                .where(
                    TrainingSet.user_id == user_id,
                    TrainingSet.plan_exercise_id == source_exercise.id,
                    TrainingSet.deleted_at.is_(None),
                )
                .order_by(TrainingSet.position.asc())
            )
        ).scalars().all()

        for source_set in source_sets:
            db.add(
                TrainingSet(
                    user_id=user_id,
                    plan_exercise_id=copied_exercise.id,
                    position=source_set.position,
                    reps=source_set.reps,
                    rest_seconds=source_set.rest_seconds,
                    weight_kg=source_set.weight_kg,
                )
            )

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="plan.clone",
        entity_type="training_plan",
        entity_id=clone.id,
        payload={"source_id": str(source_plan.id)},
    )

    await db.commit()
    await db.refresh(clone)
    return clone


@router.post("/plans/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_plans(
    payload: list[PlanReorderItem],
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    for item in payload:
        plan = await get_plan_or_404(db, user_id, item.id)
        plan.position = item.position

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="plan.reorder",
        entity_type="training_plan",
        entity_id=None,
        payload={"count": len(payload)},
    )
    await db.commit()


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    plan = await get_plan_or_404(db, user_id, plan_id)
    plan.deleted_at = utc_now()

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="plan.delete",
        entity_type="training_plan",
        entity_id=plan.id,
        payload={},
    )
    await db.commit()


@router.get("/plans/{plan_id}/exercises", response_model=list[PlanExerciseOut])
async def list_plan_exercises(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[TrainingPlanExercise]:
    await get_plan_or_404(db, user_id, plan_id)
    return (
        await db.execute(
            select(TrainingPlanExercise)
            .where(
                TrainingPlanExercise.plan_id == plan_id,
                TrainingPlanExercise.user_id == user_id,
                TrainingPlanExercise.deleted_at.is_(None),
            )
            .order_by(TrainingPlanExercise.position.asc())
        )
    ).scalars().all()


@router.post("/plans/{plan_id}/exercises", response_model=PlanExerciseOut, status_code=status.HTTP_201_CREATED)
async def create_plan_exercise(
    plan_id: UUID,
    payload: PlanExerciseCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TrainingPlanExercise:
    await get_plan_or_404(db, user_id, plan_id)

    exercise_exists = (
        await db.execute(
            select(ExerciseLibrary.id).where(
                ExerciseLibrary.id == payload.exercise_id,
                ExerciseLibrary.user_id == user_id,
                ExerciseLibrary.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not exercise_exists:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")

    max_position = (
        await db.execute(
            select(func.max(TrainingPlanExercise.position)).where(
                TrainingPlanExercise.plan_id == plan_id,
                TrainingPlanExercise.user_id == user_id,
                TrainingPlanExercise.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    plan_exercise = TrainingPlanExercise(
        user_id=user_id,
        plan_id=plan_id,
        exercise_id=payload.exercise_id,
        notes=payload.notes,
        position=(max_position or 0) + 1,
    )
    db.add(plan_exercise)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="plan_exercise.create",
        entity_type="training_plan_exercise",
        entity_id=plan_exercise.id,
        payload=payload.model_dump(),
    )

    await db.commit()
    await db.refresh(plan_exercise)
    return plan_exercise


@router.patch("/plan-exercises/{plan_exercise_id}", response_model=PlanExerciseOut)
async def update_plan_exercise(
    plan_exercise_id: UUID,
    payload: PlanExerciseUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TrainingPlanExercise:
    plan_exercise = await get_plan_exercise_or_404(db, user_id, plan_exercise_id)

    if payload.exercise_id:
        exercise_exists = (
            await db.execute(
                select(ExerciseLibrary.id).where(
                    ExerciseLibrary.id == payload.exercise_id,
                    ExerciseLibrary.user_id == user_id,
                    ExerciseLibrary.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if not exercise_exists:
            raise HTTPException(status_code=404, detail="Ejercicio no encontrado")

    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(plan_exercise, key, value)

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="plan_exercise.update",
        entity_type="training_plan_exercise",
        entity_id=plan_exercise.id,
        payload=changes,
    )

    await db.commit()
    await db.refresh(plan_exercise)
    return plan_exercise


@router.post("/plan-exercises/{plan_exercise_id}/clone", response_model=PlanExerciseOut, status_code=status.HTTP_201_CREATED)
async def clone_plan_exercise(
    plan_exercise_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TrainingPlanExercise:
    source = await get_plan_exercise_or_404(db, user_id, plan_exercise_id)

    max_position = (
        await db.execute(
            select(func.max(TrainingPlanExercise.position)).where(
                TrainingPlanExercise.plan_id == source.plan_id,
                TrainingPlanExercise.user_id == user_id,
                TrainingPlanExercise.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    clone = TrainingPlanExercise(
        user_id=user_id,
        plan_id=source.plan_id,
        exercise_id=source.exercise_id,
        position=(max_position or 0) + 1,
        notes=source.notes,
    )
    db.add(clone)
    await db.flush()

    source_sets = (
        await db.execute(
            select(TrainingSet)
            .where(
                TrainingSet.plan_exercise_id == source.id,
                TrainingSet.user_id == user_id,
                TrainingSet.deleted_at.is_(None),
            )
            .order_by(TrainingSet.position.asc())
        )
    ).scalars().all()

    for source_set in source_sets:
        db.add(
            TrainingSet(
                user_id=user_id,
                plan_exercise_id=clone.id,
                position=source_set.position,
                reps=source_set.reps,
                rest_seconds=source_set.rest_seconds,
                weight_kg=source_set.weight_kg,
            )
        )

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="plan_exercise.clone",
        entity_type="training_plan_exercise",
        entity_id=clone.id,
        payload={"source_id": str(source.id)},
    )

    await db.commit()
    await db.refresh(clone)
    return clone


@router.post("/plan-exercises/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_plan_exercises(
    payload: list[PlanExerciseReorderItem],
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    for item in payload:
        plan_exercise = await get_plan_exercise_or_404(db, user_id, item.id)
        plan_exercise.position = item.position

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="plan_exercise.reorder",
        entity_type="training_plan_exercise",
        entity_id=None,
        payload={"count": len(payload)},
    )
    await db.commit()


@router.delete("/plan-exercises/{plan_exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan_exercise(
    plan_exercise_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    plan_exercise = await get_plan_exercise_or_404(db, user_id, plan_exercise_id)
    plan_exercise.deleted_at = utc_now()
    await db.commit()


@router.get("/plan-exercises/{plan_exercise_id}/sets", response_model=list[TrainingSetOut])
async def list_plan_sets(
    plan_exercise_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[TrainingSet]:
    await get_plan_exercise_or_404(db, user_id, plan_exercise_id)
    return (
        await db.execute(
            select(TrainingSet)
            .where(
                TrainingSet.plan_exercise_id == plan_exercise_id,
                TrainingSet.user_id == user_id,
                TrainingSet.deleted_at.is_(None),
            )
            .order_by(TrainingSet.position.asc())
        )
    ).scalars().all()


@router.post("/plan-exercises/{plan_exercise_id}/sets", response_model=TrainingSetOut, status_code=status.HTTP_201_CREATED)
async def create_plan_set(
    plan_exercise_id: UUID,
    payload: TrainingSetCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TrainingSet:
    await get_plan_exercise_or_404(db, user_id, plan_exercise_id)

    max_position = (
        await db.execute(
            select(func.max(TrainingSet.position)).where(
                TrainingSet.plan_exercise_id == plan_exercise_id,
                TrainingSet.user_id == user_id,
                TrainingSet.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    training_set = TrainingSet(
        user_id=user_id,
        plan_exercise_id=plan_exercise_id,
        reps=payload.reps,
        rest_seconds=payload.rest_seconds,
        weight_kg=payload.weight_kg,
        position=(max_position or 0) + 1,
    )
    db.add(training_set)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="set.create",
        entity_type="training_set",
        entity_id=training_set.id,
        payload=payload.model_dump(mode="json"),
    )

    await db.commit()
    await db.refresh(training_set)
    return training_set


@router.patch("/sets/{set_id}", response_model=TrainingSetOut)
async def update_plan_set(
    set_id: UUID,
    payload: TrainingSetUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TrainingSet:
    training_set = await get_training_set_or_404(db, user_id, set_id)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(training_set, key, value)

    await db.commit()
    await db.refresh(training_set)
    return training_set


@router.post("/sets/{set_id}/clone", response_model=TrainingSetOut, status_code=status.HTTP_201_CREATED)
async def clone_plan_set(
    set_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TrainingSet:
    source = await get_training_set_or_404(db, user_id, set_id)

    max_position = (
        await db.execute(
            select(func.max(TrainingSet.position)).where(
                TrainingSet.plan_exercise_id == source.plan_exercise_id,
                TrainingSet.user_id == user_id,
                TrainingSet.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    clone = TrainingSet(
        user_id=user_id,
        plan_exercise_id=source.plan_exercise_id,
        reps=source.reps,
        rest_seconds=source.rest_seconds,
        weight_kg=source.weight_kg,
        position=(max_position or 0) + 1,
    )
    db.add(clone)
    await db.flush()
    await db.commit()
    await db.refresh(clone)
    return clone


@router.delete("/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan_set(
    set_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    training_set = await get_training_set_or_404(db, user_id, set_id)
    training_set.deleted_at = utc_now()
    await db.commit()


@router.post("/sessions/start", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def start_session(
    payload: SessionStartRequest,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TrainingSession:
    plan = await get_plan_or_404(db, user_id, payload.plan_id)

    session = TrainingSession(
        user_id=user_id,
        plan_id=plan.id,
        plan_version_at_start=plan.version,
        started_at=utc_now(),
    )
    db.add(session)
    await db.flush()

    plan_exercises = (
        await db.execute(
            select(TrainingPlanExercise)
            .where(
                TrainingPlanExercise.plan_id == plan.id,
                TrainingPlanExercise.user_id == user_id,
                TrainingPlanExercise.deleted_at.is_(None),
            )
            .order_by(TrainingPlanExercise.position.asc())
        )
    ).scalars().all()

    for plan_exercise in plan_exercises:
        session_exercise = TrainingSessionExercise(
            user_id=user_id,
            session_id=session.id,
            source_plan_exercise_id=plan_exercise.id,
            exercise_id=plan_exercise.exercise_id,
            position=plan_exercise.position,
            notes=plan_exercise.notes,
        )
        db.add(session_exercise)
        await db.flush()

        plan_sets = (
            await db.execute(
                select(TrainingSet)
                .where(
                    TrainingSet.plan_exercise_id == plan_exercise.id,
                    TrainingSet.user_id == user_id,
                    TrainingSet.deleted_at.is_(None),
                )
                .order_by(TrainingSet.position.asc())
            )
        ).scalars().all()

        for plan_set in plan_sets:
            db.add(
                TrainingSessionSet(
                    user_id=user_id,
                    session_exercise_id=session_exercise.id,
                    position=plan_set.position,
                    reps=plan_set.reps,
                    rest_seconds=plan_set.rest_seconds,
                    weight_kg=plan_set.weight_kg,
                )
            )

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="session.start",
        entity_type="training_session",
        entity_id=session.id,
        payload={"plan_id": str(plan.id), "plan_version": plan.version},
    )

    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[TrainingSession]:
    return (
        await db.execute(
            select(TrainingSession)
            .where(TrainingSession.user_id == user_id)
            .order_by(TrainingSession.started_at.desc())
        )
    ).scalars().all()


@router.patch("/session-sets/{session_set_id}", response_model=dict)
async def update_session_set(
    session_set_id: UUID,
    payload: SessionSetUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> dict:
    session_set = (
        await db.execute(
            select(TrainingSessionSet).where(
                TrainingSessionSet.id == session_set_id,
                TrainingSessionSet.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not session_set:
        raise HTTPException(status_code=404, detail="Serie de sesion no encontrada")

    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(session_set, key, value)

    await db.commit()
    return {"id": str(session_set.id), "updated": True}


@router.post("/sessions/{session_id}/finish", response_model=SessionOut)
async def finish_session(
    session_id: UUID,
    payload: SessionFinishRequest,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TrainingSession:
    session = (
        await db.execute(
            select(TrainingSession).where(
                TrainingSession.id == session_id,
                TrainingSession.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Sesion no encontrada")

    if session.finished_at is not None:
        raise HTTPException(status_code=400, detail="La sesion ya esta cerrada")

    session.finished_at = utc_now()
    session.should_update_template = payload.should_update_template
    session.notes = payload.notes

    pr_count = await register_personal_records(db, user_id=user_id, session_id=session.id)

    if payload.should_update_template:
        await apply_session_to_template(db, session=session)

    await log_event(
        db,
        user_id=user_id,
        domain="training",
        action="session.finish",
        entity_type="training_session",
        entity_id=session.id,
        payload={
            "should_update_template": payload.should_update_template,
            "prs_detected": pr_count,
            "notes": payload.notes,
        },
    )

    await db.commit()
    await db.refresh(session)
    return session


@router.get("/sessions/{session_id}/detail", response_model=dict)
async def session_detail(
    session_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> dict:
    session = (
        await db.execute(
            select(TrainingSession).where(
                TrainingSession.id == session_id,
                TrainingSession.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Sesion no encontrada")

    exercises = (
        await db.execute(
            select(TrainingSessionExercise, ExerciseLibrary.name)
            .join(ExerciseLibrary, ExerciseLibrary.id == TrainingSessionExercise.exercise_id)
            .where(TrainingSessionExercise.session_id == session_id)
            .order_by(TrainingSessionExercise.position.asc())
        )
    ).all()

    detail_exercises: list[dict] = []
    for row in exercises:
        session_exercise = row[0]
        exercise_name = row[1]
        sets = (
            await db.execute(
                select(TrainingSessionSet)
                .where(TrainingSessionSet.session_exercise_id == session_exercise.id)
                .order_by(TrainingSessionSet.position.asc())
            )
        ).scalars().all()
        detail_exercises.append(
            {
                "id": str(session_exercise.id),
                "exercise_id": str(session_exercise.exercise_id),
                "exercise_name": exercise_name,
                "position": session_exercise.position,
                "notes": session_exercise.notes,
                "sets": [
                    {
                        "id": str(item.id),
                        "position": item.position,
                        "reps": item.reps,
                        "weight_kg": float(item.weight_kg) if item.weight_kg is not None else None,
                        "rest_seconds": item.rest_seconds,
                    }
                    for item in sets
                ],
            }
        )

    return {
        "id": str(session.id),
        "plan_id": str(session.plan_id) if session.plan_id else None,
        "started_at": session.started_at,
        "finished_at": session.finished_at,
        "should_update_template": session.should_update_template,
        "notes": session.notes,
        "exercises": detail_exercises,
    }


@router.get("/prs", response_model=list[dict])
async def list_prs(
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[dict]:
    rows = (
        await db.execute(
            select(
                ExerciseLibrary.name,
                func.max(TrainingSessionSet.weight_kg),
            )
            .join(TrainingSessionExercise, TrainingSessionExercise.exercise_id == ExerciseLibrary.id)
            .join(TrainingSessionSet, TrainingSessionSet.session_exercise_id == TrainingSessionExercise.id)
            .where(
                TrainingSessionExercise.user_id == user_id,
                TrainingSessionSet.weight_kg.is_not(None),
                ExerciseLibrary.deleted_at.is_(None),
            )
            .group_by(ExerciseLibrary.name)
            .order_by(ExerciseLibrary.name.asc())
        )
    ).all()

    return [
        {
            "exercise": name,
            "max_weight_kg": float(weight) if weight is not None else None,
        }
        for name, weight in rows
    ]
