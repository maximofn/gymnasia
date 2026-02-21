from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import DietDay, DietItem, DietMeal, User
from app.schemas import (
    DietDayResponse,
    DietDayUpsertRequest,
    DietItemResponse,
    DietMealResponse,
)

router = APIRouter(prefix="/diet", tags=["diet"])


def _to_day_response(db: Session, day: DietDay) -> DietDayResponse:
    meals = (
        db.query(DietMeal)
        .filter(DietMeal.day_id == day.id)
        .order_by(DietMeal.position.asc())
        .all()
    )

    response_meals = []
    for meal in meals:
        items = db.query(DietItem).filter(DietItem.meal_id == meal.id).all()
        response_meals.append(
            DietMealResponse(
                id=str(meal.id),
                meal_type=meal.meal_type,
                title=meal.title,
                position=meal.position,
                items=[
                    DietItemResponse(
                        id=str(item.id),
                        name=item.name,
                        grams=float(item.grams) if item.grams is not None else None,
                        serving_count=float(item.serving_count) if item.serving_count is not None else None,
                        calories_kcal=float(item.calories_kcal) if item.calories_kcal is not None else None,
                        protein_g=float(item.protein_g) if item.protein_g is not None else None,
                        carbs_g=float(item.carbs_g) if item.carbs_g is not None else None,
                        fat_g=float(item.fat_g) if item.fat_g is not None else None,
                        calories_protein_kcal=(
                            float(item.calories_protein_kcal) if item.calories_protein_kcal is not None else None
                        ),
                        calories_carbs_kcal=(
                            float(item.calories_carbs_kcal) if item.calories_carbs_kcal is not None else None
                        ),
                        calories_fat_kcal=float(item.calories_fat_kcal) if item.calories_fat_kcal is not None else None,
                        created_by_ai=item.created_by_ai,
                    )
                    for item in items
                ],
            )
        )

    return DietDayResponse(
        id=str(day.id),
        day_date=day.day_date,
        notes=day.notes,
        meals=response_meals,
    )


@router.get("/days/{day_date}", response_model=DietDayResponse | None)
def get_day(day_date: date, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DietDayResponse | None:
    day = db.query(DietDay).filter(DietDay.user_id == user.id, DietDay.day_date == day_date).first()
    if day is None:
        return None
    return _to_day_response(db, day)


@router.put("/days/{day_date}", response_model=DietDayResponse)
def upsert_day(
    day_date: date,
    payload: DietDayUpsertRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DietDayResponse:
    day = db.query(DietDay).filter(DietDay.user_id == user.id, DietDay.day_date == day_date).first()
    if day is None:
        day = DietDay(user_id=user.id, day_date=day_date)
        db.add(day)
        db.flush()

    day.notes = payload.notes
    db.add(day)

    existing_meal_ids = [item.id for item in db.query(DietMeal.id).filter(DietMeal.day_id == day.id).all()]
    if existing_meal_ids:
        db.query(DietItem).filter(DietItem.meal_id.in_(existing_meal_ids)).delete(synchronize_session=False)
    db.query(DietMeal).filter(DietMeal.day_id == day.id).delete(synchronize_session=False)

    for meal_position, meal_payload in enumerate(payload.meals):
        meal = DietMeal(
            day_id=day.id,
            meal_type=meal_payload.meal_type,
            title=meal_payload.title,
            position=meal_position,
        )
        db.add(meal)
        db.flush()

        for item_payload in meal_payload.items:
            db.add(
                DietItem(
                    meal_id=meal.id,
                    name=item_payload.name,
                    grams=item_payload.grams,
                    serving_count=item_payload.serving_count,
                    calories_kcal=item_payload.calories_kcal,
                    protein_g=item_payload.protein_g,
                    carbs_g=item_payload.carbs_g,
                    fat_g=item_payload.fat_g,
                    calories_protein_kcal=item_payload.calories_protein_kcal,
                    calories_carbs_kcal=item_payload.calories_carbs_kcal,
                    calories_fat_kcal=item_payload.calories_fat_kcal,
                    created_by_ai=False,
                )
            )

    db.commit()
    db.refresh(day)
    return _to_day_response(db, day)
