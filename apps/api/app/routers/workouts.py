from collections import defaultdict
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    User,
    WorkoutSession,
    WorkoutSessionExercise,
    WorkoutSessionSet,
    WorkoutSessionStatusEnum,
    WorkoutTemplate,
    WorkoutTemplateExercise,
    WorkoutTemplateSet,
)
from app.schemas import (
    WorkoutExercisePayload,
    WorkoutExerciseReorderRequest,
    WorkoutExerciseResponse,
    WorkoutSessionApplyTemplateUpdatesRequest,
    WorkoutSessionFinishRequest,
    WorkoutSessionPatchRequest,
    WorkoutSessionResponse,
    WorkoutSetPayload,
    WorkoutSetReorderRequest,
    WorkoutSetResponse,
    WorkoutTemplateCloneRequest,
    WorkoutTemplateCreateRequest,
    WorkoutTemplatePatchRequest,
    WorkoutTemplateReorderRequest,
    WorkoutTemplateResponse,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])


def _uuid_or_404(raw_id: str, detail: str = "Invalid ID") -> UUID:
    try:
        return UUID(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=detail) from exc


def _to_set_response(
    set_obj: WorkoutTemplateSet | WorkoutSessionSet,
    inherited_from_last_session: bool | None = None,
    completed_at: datetime | None = None,
) -> WorkoutSetResponse:
    return WorkoutSetResponse(
        id=str(set_obj.id),
        position=set_obj.position,
        reps_fixed=set_obj.reps_fixed,
        reps_min=set_obj.reps_min,
        reps_max=set_obj.reps_max,
        rest_mmss=set_obj.rest_mmss,
        weight_kg=float(set_obj.weight_kg) if set_obj.weight_kg is not None else None,
        inherited_from_last_session=inherited_from_last_session,
        completed_at=completed_at,
    )


def _build_template_response(db: Session, template: WorkoutTemplate) -> WorkoutTemplateResponse:
    exercises = (
        db.query(WorkoutTemplateExercise)
        .filter(WorkoutTemplateExercise.workout_template_id == template.id)
        .order_by(WorkoutTemplateExercise.position.asc())
        .all()
    )
    exercise_ids = [e.id for e in exercises]

    sets_by_exercise: dict[UUID, list[WorkoutTemplateSet]] = defaultdict(list)
    if exercise_ids:
        sets = (
            db.query(WorkoutTemplateSet)
            .filter(WorkoutTemplateSet.template_exercise_id.in_(exercise_ids))
            .order_by(WorkoutTemplateSet.position.asc())
            .all()
        )
        for item in sets:
            sets_by_exercise[item.template_exercise_id].append(item)

    response_exercises = []
    for exercise in exercises:
        response_exercises.append(
            WorkoutExerciseResponse(
                id=str(exercise.id),
                position=exercise.position,
                exercise_name_snapshot=exercise.exercise_name_snapshot,
                muscle_group_snapshot=exercise.muscle_group_snapshot,
                notes=exercise.notes,
                sets=[_to_set_response(s) for s in sets_by_exercise[exercise.id]],
            )
        )

    return WorkoutTemplateResponse(
        id=str(template.id),
        name=template.name,
        notes=template.notes,
        position=template.position,
        is_archived=template.is_archived,
        exercises=response_exercises,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


def _build_session_response(db: Session, workout_session: WorkoutSession) -> WorkoutSessionResponse:
    exercises = (
        db.query(WorkoutSessionExercise)
        .filter(WorkoutSessionExercise.workout_session_id == workout_session.id)
        .order_by(WorkoutSessionExercise.position.asc())
        .all()
    )
    exercise_ids = [e.id for e in exercises]

    sets_by_exercise: dict[UUID, list[WorkoutSessionSet]] = defaultdict(list)
    if exercise_ids:
        sets = (
            db.query(WorkoutSessionSet)
            .filter(WorkoutSessionSet.session_exercise_id.in_(exercise_ids))
            .order_by(WorkoutSessionSet.position.asc())
            .all()
        )
        for item in sets:
            sets_by_exercise[item.session_exercise_id].append(item)

    response_exercises = []
    for exercise in exercises:
        response_exercises.append(
            WorkoutExerciseResponse(
                id=str(exercise.id),
                position=exercise.position,
                exercise_name_snapshot=exercise.exercise_name_snapshot,
                muscle_group_snapshot=exercise.muscle_group_snapshot,
                notes=exercise.notes,
                sets=[
                    _to_set_response(
                        s,
                        inherited_from_last_session=s.inherited_from_last_session,
                        completed_at=s.completed_at,
                    )
                    for s in sets_by_exercise[exercise.id]
                ],
            )
        )

    return WorkoutSessionResponse(
        id=str(workout_session.id),
        template_id=str(workout_session.template_id) if workout_session.template_id else None,
        status=workout_session.status,
        started_at=workout_session.started_at,
        ended_at=workout_session.ended_at,
        notes=workout_session.notes,
        applied_changes_to_template=workout_session.applied_changes_to_template,
        exercises=response_exercises,
    )


def _next_template_position(db: Session, user_id: UUID) -> int:
    current_max = db.query(func.max(WorkoutTemplate.position)).filter(WorkoutTemplate.user_id == user_id).scalar()
    return (current_max if current_max is not None else -1) + 1


def _replace_template_exercises(db: Session, template_id: UUID, exercises: list[WorkoutExercisePayload]) -> None:
    existing_exercise_ids = [
        item.id
        for item in db.query(WorkoutTemplateExercise.id)
        .filter(WorkoutTemplateExercise.workout_template_id == template_id)
        .all()
    ]
    if existing_exercise_ids:
        db.query(WorkoutTemplateSet).filter(WorkoutTemplateSet.template_exercise_id.in_(existing_exercise_ids)).delete(
            synchronize_session=False
        )
    db.query(WorkoutTemplateExercise).filter(WorkoutTemplateExercise.workout_template_id == template_id).delete(
        synchronize_session=False
    )

    for ex_position, ex_payload in enumerate(exercises):
        exercise = WorkoutTemplateExercise(
            workout_template_id=template_id,
            position=ex_position,
            exercise_name_snapshot=ex_payload.exercise_name_snapshot,
            muscle_group_snapshot=ex_payload.muscle_group_snapshot,
            notes=ex_payload.notes,
        )
        db.add(exercise)
        db.flush()

        for set_position, set_payload in enumerate(ex_payload.sets):
            db.add(
                WorkoutTemplateSet(
                    template_exercise_id=exercise.id,
                    position=set_position,
                    reps_fixed=set_payload.reps_fixed,
                    reps_min=set_payload.reps_min,
                    reps_max=set_payload.reps_max,
                    rest_mmss=set_payload.rest_mmss,
                    weight_kg=set_payload.weight_kg,
                )
            )


def _replace_session_exercises(db: Session, session_id: UUID, exercises: list[WorkoutExercisePayload]) -> None:
    existing_exercise_ids = [
        item.id
        for item in db.query(WorkoutSessionExercise.id)
        .filter(WorkoutSessionExercise.workout_session_id == session_id)
        .all()
    ]
    if existing_exercise_ids:
        db.query(WorkoutSessionSet).filter(WorkoutSessionSet.session_exercise_id.in_(existing_exercise_ids)).delete(
            synchronize_session=False
        )
    db.query(WorkoutSessionExercise).filter(WorkoutSessionExercise.workout_session_id == session_id).delete(
        synchronize_session=False
    )

    for ex_position, ex_payload in enumerate(exercises):
        exercise = WorkoutSessionExercise(
            workout_session_id=session_id,
            position=ex_position,
            exercise_name_snapshot=ex_payload.exercise_name_snapshot,
            muscle_group_snapshot=ex_payload.muscle_group_snapshot,
            notes=ex_payload.notes,
        )
        db.add(exercise)
        db.flush()

        for set_position, set_payload in enumerate(ex_payload.sets):
            db.add(
                WorkoutSessionSet(
                    session_exercise_id=exercise.id,
                    position=set_position,
                    reps_fixed=set_payload.reps_fixed,
                    reps_min=set_payload.reps_min,
                    reps_max=set_payload.reps_max,
                    rest_mmss=set_payload.rest_mmss,
                    weight_kg=set_payload.weight_kg,
                    inherited_from_last_session=False,
                )
            )


def _get_template_or_404(db: Session, user_id: UUID, template_id: str) -> WorkoutTemplate:
    template_uuid = _uuid_or_404(template_id, detail="Template not found")
    template = (
        db.query(WorkoutTemplate)
        .filter(WorkoutTemplate.id == template_uuid, WorkoutTemplate.user_id == user_id)
        .first()
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


def _get_session_or_404(db: Session, user_id: UUID, session_id: str) -> WorkoutSession:
    session_uuid = _uuid_or_404(session_id, detail="Session not found")
    workout_session = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.id == session_uuid, WorkoutSession.user_id == user_id)
        .first()
    )
    if workout_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return workout_session


def _last_finished_set_defaults(db: Session, user_id: UUID) -> dict[tuple[str, int], WorkoutSessionSet]:
    rows = (
        db.query(WorkoutSessionExercise.exercise_name_snapshot, WorkoutSessionSet)
        .join(WorkoutSessionSet, WorkoutSessionSet.session_exercise_id == WorkoutSessionExercise.id)
        .join(WorkoutSession, WorkoutSession.id == WorkoutSessionExercise.workout_session_id)
        .filter(WorkoutSession.user_id == user_id, WorkoutSession.status == WorkoutSessionStatusEnum.finished)
        .order_by(WorkoutSession.started_at.desc(), WorkoutSessionSet.position.asc())
        .all()
    )

    defaults: dict[tuple[str, int], WorkoutSessionSet] = {}
    for exercise_name, session_set in rows:
        key = (exercise_name.strip().lower(), session_set.position)
        if key not in defaults:
            defaults[key] = session_set
    return defaults


def _create_session_from_template(db: Session, user_id: UUID, template: WorkoutTemplate) -> WorkoutSession:
    defaults = _last_finished_set_defaults(db, user_id)

    workout_session = WorkoutSession(
        user_id=user_id,
        template_id=template.id,
        status=WorkoutSessionStatusEnum.in_progress,
    )
    db.add(workout_session)
    db.flush()

    template_exercises = (
        db.query(WorkoutTemplateExercise)
        .filter(WorkoutTemplateExercise.workout_template_id == template.id)
        .order_by(WorkoutTemplateExercise.position.asc())
        .all()
    )

    for ex in template_exercises:
        session_exercise = WorkoutSessionExercise(
            workout_session_id=workout_session.id,
            source_template_exercise_id=ex.id,
            position=ex.position,
            exercise_name_snapshot=ex.exercise_name_snapshot,
            muscle_group_snapshot=ex.muscle_group_snapshot,
            notes=ex.notes,
        )
        db.add(session_exercise)
        db.flush()

        template_sets = (
            db.query(WorkoutTemplateSet)
            .filter(WorkoutTemplateSet.template_exercise_id == ex.id)
            .order_by(WorkoutTemplateSet.position.asc())
            .all()
        )

        for tset in template_sets:
            inherited = False
            default_source = defaults.get((ex.exercise_name_snapshot.strip().lower(), tset.position))

            reps_fixed = tset.reps_fixed
            reps_min = tset.reps_min
            reps_max = tset.reps_max
            weight_kg = tset.weight_kg

            if reps_fixed is None and reps_min is None and reps_max is None and default_source is not None:
                reps_fixed = default_source.reps_fixed
                reps_min = default_source.reps_min
                reps_max = default_source.reps_max
                inherited = True

            if weight_kg is None and default_source is not None and default_source.weight_kg is not None:
                weight_kg = default_source.weight_kg
                inherited = True

            db.add(
                WorkoutSessionSet(
                    session_exercise_id=session_exercise.id,
                    source_template_set_id=tset.id,
                    position=tset.position,
                    reps_fixed=reps_fixed,
                    reps_min=reps_min,
                    reps_max=reps_max,
                    rest_mmss=tset.rest_mmss,
                    weight_kg=weight_kg,
                    inherited_from_last_session=inherited,
                )
            )

    return workout_session


@router.get("/templates", response_model=list[WorkoutTemplateResponse])
def list_templates(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[WorkoutTemplateResponse]:
    templates = (
        db.query(WorkoutTemplate)
        .filter(WorkoutTemplate.user_id == user.id)
        .order_by(WorkoutTemplate.position.asc(), WorkoutTemplate.created_at.asc())
        .all()
    )
    return [_build_template_response(db, t) for t in templates]


@router.post("/templates", response_model=WorkoutTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: WorkoutTemplateCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutTemplateResponse:
    template = WorkoutTemplate(
        user_id=user.id,
        name=payload.name,
        notes=payload.notes,
        position=_next_template_position(db, user.id),
    )
    db.add(template)
    db.flush()

    _replace_template_exercises(db, template.id, payload.exercises)

    db.commit()
    db.refresh(template)
    return _build_template_response(db, template)


@router.patch("/templates/{template_id}", response_model=WorkoutTemplateResponse)
def patch_template(
    template_id: str,
    payload: WorkoutTemplatePatchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutTemplateResponse:
    template = _get_template_or_404(db, user.id, template_id)

    if payload.name is not None:
        template.name = payload.name
    if payload.notes is not None:
        template.notes = payload.notes
    if payload.is_archived is not None:
        template.is_archived = payload.is_archived

    db.add(template)

    if payload.exercises is not None:
        _replace_template_exercises(db, template.id, payload.exercises)

    db.commit()
    db.refresh(template)
    return _build_template_response(db, template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    template = _get_template_or_404(db, user.id, template_id)
    db.delete(template)
    db.commit()


@router.post("/templates/{template_id}/clone", response_model=WorkoutTemplateResponse, status_code=status.HTTP_201_CREATED)
def clone_template(
    template_id: str,
    payload: WorkoutTemplateCloneRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutTemplateResponse:
    template = _get_template_or_404(db, user.id, template_id)

    cloned = WorkoutTemplate(
        user_id=user.id,
        name=payload.name or f"{template.name} (copy)",
        notes=template.notes,
        position=_next_template_position(db, user.id),
        is_archived=template.is_archived,
    )
    db.add(cloned)
    db.flush()

    source_exercises = (
        db.query(WorkoutTemplateExercise)
        .filter(WorkoutTemplateExercise.workout_template_id == template.id)
        .order_by(WorkoutTemplateExercise.position.asc())
        .all()
    )
    for source_ex in source_exercises:
        cloned_ex = WorkoutTemplateExercise(
            workout_template_id=cloned.id,
            position=source_ex.position,
            exercise_name_snapshot=source_ex.exercise_name_snapshot,
            muscle_group_snapshot=source_ex.muscle_group_snapshot,
            notes=source_ex.notes,
        )
        db.add(cloned_ex)
        db.flush()

        source_sets = (
            db.query(WorkoutTemplateSet)
            .filter(WorkoutTemplateSet.template_exercise_id == source_ex.id)
            .order_by(WorkoutTemplateSet.position.asc())
            .all()
        )
        for source_set in source_sets:
            db.add(
                WorkoutTemplateSet(
                    template_exercise_id=cloned_ex.id,
                    position=source_set.position,
                    reps_fixed=source_set.reps_fixed,
                    reps_min=source_set.reps_min,
                    reps_max=source_set.reps_max,
                    rest_mmss=source_set.rest_mmss,
                    weight_kg=source_set.weight_kg,
                )
            )

    db.commit()
    db.refresh(cloned)
    return _build_template_response(db, cloned)


@router.post("/templates/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_templates(
    payload: WorkoutTemplateReorderRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    template_uuids = [_uuid_or_404(tid, "Invalid template ID") for tid in payload.template_ids]

    templates = (
        db.query(WorkoutTemplate)
        .filter(WorkoutTemplate.user_id == user.id, WorkoutTemplate.id.in_(template_uuids))
        .all()
    )
    if len(templates) != len(set(template_uuids)):
        raise HTTPException(status_code=400, detail="Some template IDs do not belong to current user")

    for idx, template_uuid in enumerate(template_uuids):
        db.query(WorkoutTemplate).filter(WorkoutTemplate.id == template_uuid).update({"position": idx})

    db.commit()


@router.post("/templates/{template_id}/exercises", response_model=WorkoutTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template_exercise(
    template_id: str,
    payload: WorkoutExercisePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutTemplateResponse:
    template = _get_template_or_404(db, user.id, template_id)
    current_max = (
        db.query(func.max(WorkoutTemplateExercise.position))
        .filter(WorkoutTemplateExercise.workout_template_id == template.id)
        .scalar()
    )
    exercise = WorkoutTemplateExercise(
        workout_template_id=template.id,
        position=(current_max or -1) + 1,
        exercise_name_snapshot=payload.exercise_name_snapshot,
        muscle_group_snapshot=payload.muscle_group_snapshot,
        notes=payload.notes,
    )
    db.add(exercise)
    db.flush()

    for idx, set_payload in enumerate(payload.sets):
        db.add(
            WorkoutTemplateSet(
                template_exercise_id=exercise.id,
                position=idx,
                reps_fixed=set_payload.reps_fixed,
                reps_min=set_payload.reps_min,
                reps_max=set_payload.reps_max,
                rest_mmss=set_payload.rest_mmss,
                weight_kg=set_payload.weight_kg,
            )
        )

    db.commit()
    db.refresh(template)
    return _build_template_response(db, template)


@router.patch("/templates/{template_id}/exercises/{exercise_id}", response_model=WorkoutTemplateResponse)
def patch_template_exercise(
    template_id: str,
    exercise_id: str,
    payload: WorkoutExercisePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutTemplateResponse:
    template = _get_template_or_404(db, user.id, template_id)
    exercise_uuid = _uuid_or_404(exercise_id, "Exercise not found")
    exercise = (
        db.query(WorkoutTemplateExercise)
        .filter(
            WorkoutTemplateExercise.id == exercise_uuid,
            WorkoutTemplateExercise.workout_template_id == template.id,
        )
        .first()
    )
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    exercise.exercise_name_snapshot = payload.exercise_name_snapshot
    exercise.muscle_group_snapshot = payload.muscle_group_snapshot
    exercise.notes = payload.notes
    db.add(exercise)

    db.query(WorkoutTemplateSet).filter(WorkoutTemplateSet.template_exercise_id == exercise.id).delete(
        synchronize_session=False
    )
    for idx, set_payload in enumerate(payload.sets):
        db.add(
            WorkoutTemplateSet(
                template_exercise_id=exercise.id,
                position=idx,
                reps_fixed=set_payload.reps_fixed,
                reps_min=set_payload.reps_min,
                reps_max=set_payload.reps_max,
                rest_mmss=set_payload.rest_mmss,
                weight_kg=set_payload.weight_kg,
            )
        )

    db.commit()
    db.refresh(template)
    return _build_template_response(db, template)


@router.delete("/templates/{template_id}/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template_exercise(
    template_id: str,
    exercise_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    template = _get_template_or_404(db, user.id, template_id)
    exercise_uuid = _uuid_or_404(exercise_id, "Exercise not found")
    exercise = (
        db.query(WorkoutTemplateExercise)
        .filter(
            WorkoutTemplateExercise.id == exercise_uuid,
            WorkoutTemplateExercise.workout_template_id == template.id,
        )
        .first()
    )
    if exercise is None:
        return

    db.delete(exercise)
    db.commit()


@router.post(
    "/templates/{template_id}/exercises/{exercise_id}/clone",
    response_model=WorkoutTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def clone_template_exercise(
    template_id: str,
    exercise_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutTemplateResponse:
    template = _get_template_or_404(db, user.id, template_id)
    exercise_uuid = _uuid_or_404(exercise_id, "Exercise not found")
    source = (
        db.query(WorkoutTemplateExercise)
        .filter(
            WorkoutTemplateExercise.id == exercise_uuid,
            WorkoutTemplateExercise.workout_template_id == template.id,
        )
        .first()
    )
    if source is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    current_max = (
        db.query(func.max(WorkoutTemplateExercise.position))
        .filter(WorkoutTemplateExercise.workout_template_id == template.id)
        .scalar()
    )
    cloned = WorkoutTemplateExercise(
        workout_template_id=template.id,
        position=(current_max or -1) + 1,
        exercise_name_snapshot=source.exercise_name_snapshot,
        muscle_group_snapshot=source.muscle_group_snapshot,
        notes=source.notes,
    )
    db.add(cloned)
    db.flush()

    source_sets = (
        db.query(WorkoutTemplateSet)
        .filter(WorkoutTemplateSet.template_exercise_id == source.id)
        .order_by(WorkoutTemplateSet.position.asc())
        .all()
    )
    for source_set in source_sets:
        db.add(
            WorkoutTemplateSet(
                template_exercise_id=cloned.id,
                position=source_set.position,
                reps_fixed=source_set.reps_fixed,
                reps_min=source_set.reps_min,
                reps_max=source_set.reps_max,
                rest_mmss=source_set.rest_mmss,
                weight_kg=source_set.weight_kg,
            )
        )

    db.commit()
    db.refresh(template)
    return _build_template_response(db, template)


@router.post("/templates/{template_id}/exercises/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_template_exercises(
    template_id: str,
    payload: WorkoutExerciseReorderRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    template = _get_template_or_404(db, user.id, template_id)
    exercise_uuids = [_uuid_or_404(eid, "Invalid exercise ID") for eid in payload.exercise_ids]

    exercises = (
        db.query(WorkoutTemplateExercise)
        .filter(
            WorkoutTemplateExercise.workout_template_id == template.id,
            WorkoutTemplateExercise.id.in_(exercise_uuids),
        )
        .all()
    )
    if len(exercises) != len(set(exercise_uuids)):
        raise HTTPException(status_code=400, detail="Some exercise IDs do not belong to this template")

    for idx, exercise_uuid in enumerate(exercise_uuids):
        db.query(WorkoutTemplateExercise).filter(WorkoutTemplateExercise.id == exercise_uuid).update({"position": idx})

    db.commit()


@router.post(
    "/templates/{template_id}/exercises/{exercise_id}/sets",
    response_model=WorkoutTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_template_set(
    template_id: str,
    exercise_id: str,
    payload: WorkoutSetPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutTemplateResponse:
    template = _get_template_or_404(db, user.id, template_id)
    exercise_uuid = _uuid_or_404(exercise_id, "Exercise not found")
    exercise = (
        db.query(WorkoutTemplateExercise)
        .filter(WorkoutTemplateExercise.id == exercise_uuid, WorkoutTemplateExercise.workout_template_id == template.id)
        .first()
    )
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    current_max = (
        db.query(func.max(WorkoutTemplateSet.position))
        .filter(WorkoutTemplateSet.template_exercise_id == exercise.id)
        .scalar()
    )
    db.add(
        WorkoutTemplateSet(
            template_exercise_id=exercise.id,
            position=(current_max or -1) + 1,
            reps_fixed=payload.reps_fixed,
            reps_min=payload.reps_min,
            reps_max=payload.reps_max,
            rest_mmss=payload.rest_mmss,
            weight_kg=payload.weight_kg,
        )
    )
    db.commit()
    db.refresh(template)
    return _build_template_response(db, template)


@router.patch(
    "/templates/{template_id}/exercises/{exercise_id}/sets/{set_id}",
    response_model=WorkoutTemplateResponse,
)
def patch_template_set(
    template_id: str,
    exercise_id: str,
    set_id: str,
    payload: WorkoutSetPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutTemplateResponse:
    template = _get_template_or_404(db, user.id, template_id)
    exercise_uuid = _uuid_or_404(exercise_id, "Exercise not found")
    set_uuid = _uuid_or_404(set_id, "Set not found")

    exercise = (
        db.query(WorkoutTemplateExercise)
        .filter(WorkoutTemplateExercise.id == exercise_uuid, WorkoutTemplateExercise.workout_template_id == template.id)
        .first()
    )
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    set_row = (
        db.query(WorkoutTemplateSet)
        .filter(WorkoutTemplateSet.id == set_uuid, WorkoutTemplateSet.template_exercise_id == exercise.id)
        .first()
    )
    if set_row is None:
        raise HTTPException(status_code=404, detail="Set not found")

    set_row.reps_fixed = payload.reps_fixed
    set_row.reps_min = payload.reps_min
    set_row.reps_max = payload.reps_max
    set_row.rest_mmss = payload.rest_mmss
    set_row.weight_kg = payload.weight_kg
    db.add(set_row)

    db.commit()
    db.refresh(template)
    return _build_template_response(db, template)


@router.delete("/templates/{template_id}/exercises/{exercise_id}/sets/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template_set(
    template_id: str,
    exercise_id: str,
    set_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    template = _get_template_or_404(db, user.id, template_id)
    exercise_uuid = _uuid_or_404(exercise_id, "Exercise not found")
    set_uuid = _uuid_or_404(set_id, "Set not found")

    exercise = (
        db.query(WorkoutTemplateExercise)
        .filter(WorkoutTemplateExercise.id == exercise_uuid, WorkoutTemplateExercise.workout_template_id == template.id)
        .first()
    )
    if exercise is None:
        return

    set_row = (
        db.query(WorkoutTemplateSet)
        .filter(WorkoutTemplateSet.id == set_uuid, WorkoutTemplateSet.template_exercise_id == exercise.id)
        .first()
    )
    if set_row is None:
        return

    db.delete(set_row)
    db.commit()


@router.post(
    "/templates/{template_id}/exercises/{exercise_id}/sets/{set_id}/clone",
    response_model=WorkoutTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def clone_template_set(
    template_id: str,
    exercise_id: str,
    set_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutTemplateResponse:
    template = _get_template_or_404(db, user.id, template_id)
    exercise_uuid = _uuid_or_404(exercise_id, "Exercise not found")
    set_uuid = _uuid_or_404(set_id, "Set not found")

    exercise = (
        db.query(WorkoutTemplateExercise)
        .filter(WorkoutTemplateExercise.id == exercise_uuid, WorkoutTemplateExercise.workout_template_id == template.id)
        .first()
    )
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    source = (
        db.query(WorkoutTemplateSet)
        .filter(WorkoutTemplateSet.id == set_uuid, WorkoutTemplateSet.template_exercise_id == exercise.id)
        .first()
    )
    if source is None:
        raise HTTPException(status_code=404, detail="Set not found")

    current_max = (
        db.query(func.max(WorkoutTemplateSet.position))
        .filter(WorkoutTemplateSet.template_exercise_id == exercise.id)
        .scalar()
    )
    db.add(
        WorkoutTemplateSet(
            template_exercise_id=exercise.id,
            position=(current_max or -1) + 1,
            reps_fixed=source.reps_fixed,
            reps_min=source.reps_min,
            reps_max=source.reps_max,
            rest_mmss=source.rest_mmss,
            weight_kg=source.weight_kg,
        )
    )
    db.commit()
    db.refresh(template)
    return _build_template_response(db, template)


@router.post("/templates/{template_id}/exercises/{exercise_id}/sets/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_template_sets(
    template_id: str,
    exercise_id: str,
    payload: WorkoutSetReorderRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    template = _get_template_or_404(db, user.id, template_id)
    exercise_uuid = _uuid_or_404(exercise_id, "Exercise not found")
    set_uuids = [_uuid_or_404(sid, "Invalid set ID") for sid in payload.set_ids]

    exercise = (
        db.query(WorkoutTemplateExercise)
        .filter(WorkoutTemplateExercise.id == exercise_uuid, WorkoutTemplateExercise.workout_template_id == template.id)
        .first()
    )
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    rows = (
        db.query(WorkoutTemplateSet)
        .filter(WorkoutTemplateSet.template_exercise_id == exercise.id, WorkoutTemplateSet.id.in_(set_uuids))
        .all()
    )
    if len(rows) != len(set(set_uuids)):
        raise HTTPException(status_code=400, detail="Some set IDs do not belong to this exercise")

    for idx, set_uuid in enumerate(set_uuids):
        db.query(WorkoutTemplateSet).filter(WorkoutTemplateSet.id == set_uuid).update({"position": idx})

    db.commit()


@router.post("/templates/{template_id}/start-session", response_model=WorkoutSessionResponse, status_code=status.HTTP_201_CREATED)
def start_session(
    template_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutSessionResponse:
    template = _get_template_or_404(db, user.id, template_id)
    workout_session = _create_session_from_template(db, user.id, template)
    db.commit()
    db.refresh(workout_session)
    return _build_session_response(db, workout_session)


@router.get("/sessions", response_model=list[WorkoutSessionResponse])
def list_sessions(
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkoutSessionResponse]:
    if limit < 1:
        limit = 1
    if limit > 100:
        limit = 100

    sessions = (
        db.query(WorkoutSession)
        .filter(WorkoutSession.user_id == user.id)
        .order_by(WorkoutSession.started_at.desc())
        .limit(limit)
        .all()
    )
    return [_build_session_response(db, s) for s in sessions]


@router.patch("/sessions/{session_id}", response_model=WorkoutSessionResponse)
def patch_session(
    session_id: str,
    payload: WorkoutSessionPatchRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutSessionResponse:
    workout_session = _get_session_or_404(db, user.id, session_id)

    if payload.notes is not None:
        workout_session.notes = payload.notes
        db.add(workout_session)

    if payload.exercises is not None:
        _replace_session_exercises(db, workout_session.id, payload.exercises)

    db.commit()
    db.refresh(workout_session)
    return _build_session_response(db, workout_session)


@router.post("/sessions/{session_id}/finish", response_model=WorkoutSessionResponse)
def finish_session(
    session_id: str,
    payload: WorkoutSessionFinishRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutSessionResponse:
    workout_session = _get_session_or_404(db, user.id, session_id)

    workout_session.status = WorkoutSessionStatusEnum.finished
    workout_session.ended_at = datetime.now(UTC)
    if payload.notes is not None:
        workout_session.notes = payload.notes

    db.add(workout_session)
    db.commit()
    db.refresh(workout_session)
    return _build_session_response(db, workout_session)


@router.post("/sessions/{session_id}/apply-template-updates", response_model=WorkoutTemplateResponse)
def apply_template_updates(
    session_id: str,
    payload: WorkoutSessionApplyTemplateUpdatesRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkoutTemplateResponse:
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="confirm=true is required")

    workout_session = _get_session_or_404(db, user.id, session_id)
    if workout_session.template_id is None:
        raise HTTPException(status_code=400, detail="Session has no base template")

    template = _get_template_or_404(db, user.id, str(workout_session.template_id))

    session_exercises = (
        db.query(WorkoutSessionExercise)
        .filter(WorkoutSessionExercise.workout_session_id == workout_session.id)
        .order_by(WorkoutSessionExercise.position.asc())
        .all()
    )

    payload_exercises: list[WorkoutExercisePayload] = []
    for s_ex in session_exercises:
        session_sets = (
            db.query(WorkoutSessionSet)
            .filter(WorkoutSessionSet.session_exercise_id == s_ex.id)
            .order_by(WorkoutSessionSet.position.asc())
            .all()
        )
        payload_exercises.append(
            WorkoutExercisePayload(
                exercise_name_snapshot=s_ex.exercise_name_snapshot,
                muscle_group_snapshot=s_ex.muscle_group_snapshot,
                notes=s_ex.notes,
                sets=[
                    WorkoutSetPayload(
                        reps_fixed=s_set.reps_fixed,
                        reps_min=s_set.reps_min,
                        reps_max=s_set.reps_max,
                        rest_mmss=s_set.rest_mmss,
                        weight_kg=float(s_set.weight_kg) if s_set.weight_kg is not None else None,
                    )
                    for s_set in session_sets
                ],
            )
        )

    _replace_template_exercises(db, template.id, payload_exercises)
    workout_session.applied_changes_to_template = True
    db.add(workout_session)
    db.commit()
    db.refresh(template)

    return _build_template_response(db, template)
