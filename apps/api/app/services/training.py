from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import (
    PersonalRecord,
    TrainingPlan,
    TrainingPlanExercise,
    TrainingSession,
    TrainingSessionExercise,
    TrainingSessionSet,
    TrainingSet,
)


async def apply_session_to_template(db: AsyncSession, *, session: TrainingSession) -> None:
    if session.plan_id is None:
        return

    session_exercises = (
        await db.execute(
            select(TrainingSessionExercise)
            .where(TrainingSessionExercise.session_id == session.id)
            .order_by(TrainingSessionExercise.position.asc())
        )
    ).scalars().all()

    await db.execute(delete(TrainingSet).where(TrainingSet.plan_exercise_id.in_(select(TrainingPlanExercise.id).where(TrainingPlanExercise.plan_id == session.plan_id))))
    await db.execute(delete(TrainingPlanExercise).where(TrainingPlanExercise.plan_id == session.plan_id))

    for exercise in session_exercises:
        new_plan_exercise_id = uuid4()
        await db.execute(
            insert(TrainingPlanExercise).values(
                id=new_plan_exercise_id,
                user_id=exercise.user_id,
                plan_id=session.plan_id,
                exercise_id=exercise.exercise_id,
                position=exercise.position,
                notes=exercise.notes,
            )
        )

        sets = (
            await db.execute(
                select(TrainingSessionSet)
                .where(TrainingSessionSet.session_exercise_id == exercise.id)
                .order_by(TrainingSessionSet.position.asc())
            )
        ).scalars().all()

        for session_set in sets:
            await db.execute(
                insert(TrainingSet).values(
                    user_id=session_set.user_id,
                    plan_exercise_id=new_plan_exercise_id,
                    position=session_set.position,
                    reps=session_set.reps,
                    rest_seconds=session_set.rest_seconds,
                    weight_kg=session_set.weight_kg,
                )
            )

    await db.execute(
        update(TrainingPlan)
        .where(TrainingPlan.id == session.plan_id)
        .values(version=TrainingPlan.version + 1)
    )


async def register_personal_records(db: AsyncSession, *, user_id: UUID, session_id: UUID) -> int:
    session_sets = (
        await db.execute(
            select(TrainingSessionSet, TrainingSessionExercise)
            .join(
                TrainingSessionExercise,
                TrainingSessionExercise.id == TrainingSessionSet.session_exercise_id,
            )
            .where(TrainingSessionExercise.session_id == session_id)
        )
    ).all()

    pr_count = 0
    for row in session_sets:
        session_set: TrainingSessionSet = row[0]
        session_exercise: TrainingSessionExercise = row[1]
        if session_set.weight_kg is None:
            continue

        previous_max = (
            await db.execute(
                select(PersonalRecord)
                .where(
                    PersonalRecord.user_id == user_id,
                    PersonalRecord.exercise_id == session_exercise.exercise_id,
                    PersonalRecord.record_type == "max_weight",
                )
                .order_by(PersonalRecord.value.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        if previous_max is None or Decimal(previous_max.value) < Decimal(session_set.weight_kg):
            await db.execute(
                insert(PersonalRecord).values(
                    user_id=user_id,
                    exercise_id=session_exercise.exercise_id,
                    record_type="max_weight",
                    value=session_set.weight_kg,
                    session_set_id=session_set.id,
                )
            )
            pr_count += 1

    return pr_count
