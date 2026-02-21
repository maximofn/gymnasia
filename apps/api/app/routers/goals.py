from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Goal, User
from app.schemas import GoalResponse, GoalUpsertRequest

router = APIRouter(prefix="/goals", tags=["goals"])


def _to_goal_response(goal: Goal) -> GoalResponse:
    return GoalResponse(
        id=str(goal.id),
        title=goal.title,
        domain=goal.domain,
        target_value=float(goal.target_value) if goal.target_value is not None else None,
        target_unit=goal.target_unit,
        start_date=goal.start_date,
        end_date=goal.end_date,
        notes=goal.notes,
        is_active=goal.is_active,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


@router.get("/active", response_model=GoalResponse | None)
def get_active_goal(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> GoalResponse | None:
    goal = (
        db.query(Goal)
        .filter(Goal.user_id == user.id, Goal.is_active.is_(True))
        .order_by(Goal.created_at.desc())
        .first()
    )
    if goal is None:
        return None
    return _to_goal_response(goal)


@router.put("/active", response_model=GoalResponse)
def upsert_active_goal(
    payload: GoalUpsertRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalResponse:
    db.query(Goal).filter(Goal.user_id == user.id, Goal.is_active.is_(True)).update({"is_active": False})

    goal = Goal(
        user_id=user.id,
        title=payload.title,
        domain=payload.domain,
        target_value=payload.target_value,
        target_unit=payload.target_unit,
        start_date=payload.start_date,
        end_date=payload.end_date,
        notes=payload.notes,
        is_active=True,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _to_goal_response(goal)
