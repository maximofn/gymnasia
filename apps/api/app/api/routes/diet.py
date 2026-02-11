from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db_session
from app.models.core import DailyDiet, FoodItem, Meal, MealEntry, Recipe, RecipeItem
from app.schemas.diet import (
    DailyDietCreate,
    DailyDietOut,
    DailyDietUpdate,
    FoodItemCreate,
    FoodItemOut,
    FoodItemUpdate,
    MacroSummary,
    MealCreate,
    MealEntryCreate,
    MealEntryOut,
    MealEntryUpdate,
    MealOut,
    RecipeCreate,
    RecipeItemCreate,
    RecipeOut,
    RecipeScaleRequest,
    RecipeUpdate,
)
from app.services.nutrition import compute_food_macros, compute_recipe_macros, summarize_entries
from app.utils.auth import get_current_user_id
from app.utils.events import log_audit, log_event

router = APIRouter()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def round_decimal(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


async def get_food_or_404(db: AsyncSession, user_id: UUID, food_id: UUID) -> FoodItem:
    food = (
        await db.execute(
            select(FoodItem).where(
                FoodItem.id == food_id,
                FoodItem.user_id == user_id,
                FoodItem.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not food:
        raise HTTPException(status_code=404, detail="Alimento no encontrado")
    return food


async def get_recipe_or_404(db: AsyncSession, user_id: UUID, recipe_id: UUID) -> Recipe:
    recipe = (
        await db.execute(
            select(Recipe).where(
                Recipe.id == recipe_id,
                Recipe.user_id == user_id,
                Recipe.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    return recipe


async def get_daily_diet_or_404(db: AsyncSession, user_id: UUID, daily_diet_id: UUID) -> DailyDiet:
    daily_diet = (
        await db.execute(
            select(DailyDiet).where(
                DailyDiet.id == daily_diet_id,
                DailyDiet.user_id == user_id,
                DailyDiet.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not daily_diet:
        raise HTTPException(status_code=404, detail="Dieta diaria no encontrada")
    return daily_diet


async def get_meal_or_404(db: AsyncSession, user_id: UUID, meal_id: UUID) -> Meal:
    meal = (
        await db.execute(
            select(Meal).where(
                Meal.id == meal_id,
                Meal.user_id == user_id,
                Meal.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not meal:
        raise HTTPException(status_code=404, detail="Comida no encontrada")
    return meal


async def get_meal_entry_or_404(db: AsyncSession, user_id: UUID, entry_id: UUID) -> MealEntry:
    entry = (
        await db.execute(
            select(MealEntry).where(
                MealEntry.id == entry_id,
                MealEntry.user_id == user_id,
                MealEntry.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrada de comida no encontrada")
    return entry


@router.get("/foods", response_model=list[FoodItemOut])
async def list_foods(
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[FoodItem]:
    stmt = select(FoodItem).where(FoodItem.user_id == user_id, FoodItem.deleted_at.is_(None))
    if q:
        stmt = stmt.where(FoodItem.name.ilike(f"%{q}%"))

    return (await db.execute(stmt.order_by(FoodItem.name.asc()))).scalars().all()


@router.post("/foods", response_model=FoodItemOut, status_code=status.HTTP_201_CREATED)
async def create_food(
    payload: FoodItemCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> FoodItem:
    food = FoodItem(user_id=user_id, **payload.model_dump())
    db.add(food)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="diet",
        action="food.create",
        entity_type="food_items",
        entity_id=food.id,
        payload=payload.model_dump(mode="json"),
    )
    await log_audit(
        db,
        user_id=user_id,
        table_name="food_items",
        record_id=food.id,
        action="create",
        changes=payload.model_dump(mode="json"),
    )

    await db.commit()
    await db.refresh(food)
    return food


@router.patch("/foods/{food_id}", response_model=FoodItemOut)
async def update_food(
    food_id: UUID,
    payload: FoodItemUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> FoodItem:
    food = await get_food_or_404(db, user_id, food_id)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(food, key, value)

    await log_event(
        db,
        user_id=user_id,
        domain="diet",
        action="food.update",
        entity_type="food_items",
        entity_id=food.id,
        payload=changes,
    )
    await log_audit(
        db,
        user_id=user_id,
        table_name="food_items",
        record_id=food.id,
        action="update",
        changes=changes,
    )

    await db.commit()
    await db.refresh(food)
    return food


@router.delete("/foods/{food_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_food(
    food_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    food = await get_food_or_404(db, user_id, food_id)
    food.deleted_at = utc_now()
    await db.commit()


@router.get("/recipes", response_model=list[RecipeOut])
async def list_recipes(
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[Recipe]:
    return (
        await db.execute(
            select(Recipe)
            .where(Recipe.user_id == user_id, Recipe.deleted_at.is_(None))
            .order_by(Recipe.name.asc())
        )
    ).scalars().all()


@router.post("/recipes", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    payload: RecipeCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> Recipe:
    recipe = Recipe(user_id=user_id, **payload.model_dump())
    db.add(recipe)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="diet",
        action="recipe.create",
        entity_type="recipes",
        entity_id=recipe.id,
        payload=payload.model_dump(mode="json"),
    )

    await db.commit()
    await db.refresh(recipe)
    return recipe


@router.patch("/recipes/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: UUID,
    payload: RecipeUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> Recipe:
    recipe = await get_recipe_or_404(db, user_id, recipe_id)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(recipe, key, value)

    await db.commit()
    await db.refresh(recipe)
    return recipe


@router.post("/recipes/{recipe_id}/clone", response_model=RecipeOut, status_code=status.HTTP_201_CREATED)
async def clone_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> Recipe:
    source = await get_recipe_or_404(db, user_id, recipe_id)
    clone = Recipe(
        user_id=user_id,
        name=f"{source.name} (copia)",
        instructions=source.instructions,
        servings=source.servings,
    )
    db.add(clone)
    await db.flush()

    source_items = (
        await db.execute(
            select(RecipeItem).where(
                RecipeItem.recipe_id == source.id,
                RecipeItem.user_id == user_id,
                RecipeItem.deleted_at.is_(None),
            )
        )
    ).scalars().all()

    for item in source_items:
        db.add(
            RecipeItem(
                user_id=user_id,
                recipe_id=clone.id,
                food_item_id=item.food_item_id,
                grams=item.grams,
            )
        )

    await db.commit()
    await db.refresh(clone)
    return clone


@router.delete("/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    recipe = await get_recipe_or_404(db, user_id, recipe_id)
    recipe.deleted_at = utc_now()
    await db.commit()


@router.get("/recipes/{recipe_id}/items", response_model=list[dict])
async def list_recipe_items(
    recipe_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[dict]:
    await get_recipe_or_404(db, user_id, recipe_id)
    rows = (
        await db.execute(
            select(RecipeItem, FoodItem)
            .join(FoodItem, FoodItem.id == RecipeItem.food_item_id)
            .where(
                RecipeItem.recipe_id == recipe_id,
                RecipeItem.user_id == user_id,
                RecipeItem.deleted_at.is_(None),
                FoodItem.deleted_at.is_(None),
            )
        )
    ).all()

    result: list[dict] = []
    for recipe_item, food_item in rows:
        result.append(
            {
                "id": str(recipe_item.id),
                "food_item_id": str(recipe_item.food_item_id),
                "food_name": food_item.name,
                "grams": float(recipe_item.grams),
            }
        )
    return result


@router.post("/recipes/{recipe_id}/items", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_recipe_item(
    recipe_id: UUID,
    payload: RecipeItemCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> dict:
    await get_recipe_or_404(db, user_id, recipe_id)
    await get_food_or_404(db, user_id, payload.food_item_id)

    recipe_item = RecipeItem(
        user_id=user_id,
        recipe_id=recipe_id,
        food_item_id=payload.food_item_id,
        grams=payload.grams,
    )
    db.add(recipe_item)
    await db.flush()
    await db.commit()
    return {"id": str(recipe_item.id)}


@router.delete("/recipe-items/{recipe_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe_item(
    recipe_item_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    recipe_item = (
        await db.execute(
            select(RecipeItem).where(
                RecipeItem.id == recipe_item_id,
                RecipeItem.user_id == user_id,
                RecipeItem.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not recipe_item:
        raise HTTPException(status_code=404, detail="Ingrediente de receta no encontrado")

    recipe_item.deleted_at = utc_now()
    await db.commit()


@router.post("/recipes/{recipe_id}/scale", response_model=dict)
async def scale_recipe(
    recipe_id: UUID,
    payload: RecipeScaleRequest,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> dict:
    recipe = await get_recipe_or_404(db, user_id, recipe_id)
    scale_factor = payload.target_servings / Decimal(recipe.servings)

    items = (
        await db.execute(
            select(RecipeItem, FoodItem)
            .join(FoodItem, FoodItem.id == RecipeItem.food_item_id)
            .where(
                RecipeItem.recipe_id == recipe.id,
                RecipeItem.user_id == user_id,
                RecipeItem.deleted_at.is_(None),
                FoodItem.deleted_at.is_(None),
            )
        )
    ).all()

    scaled_items: list[dict] = []
    for recipe_item, food in items:
        scaled_items.append(
            {
                "food_item_id": str(food.id),
                "food_name": food.name,
                "grams": float(round_decimal(recipe_item.grams * scale_factor)),
            }
        )

    return {
        "recipe_id": str(recipe.id),
        "original_servings": recipe.servings,
        "target_servings": float(payload.target_servings),
        "items": scaled_items,
    }


@router.get("/daily-diets", response_model=list[DailyDietOut])
async def list_daily_diets(
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[DailyDiet]:
    return (
        await db.execute(
            select(DailyDiet)
            .where(DailyDiet.user_id == user_id, DailyDiet.deleted_at.is_(None))
            .order_by(DailyDiet.diet_date.desc())
        )
    ).scalars().all()


@router.post("/daily-diets", response_model=DailyDietOut, status_code=status.HTTP_201_CREATED)
async def create_daily_diet(
    payload: DailyDietCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> DailyDiet:
    diet = DailyDiet(user_id=user_id, **payload.model_dump())
    db.add(diet)
    await db.flush()
    await db.commit()
    await db.refresh(diet)
    return diet


@router.patch("/daily-diets/{daily_diet_id}", response_model=DailyDietOut)
async def update_daily_diet(
    daily_diet_id: UUID,
    payload: DailyDietUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> DailyDiet:
    daily_diet = await get_daily_diet_or_404(db, user_id, daily_diet_id)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(daily_diet, key, value)

    await db.commit()
    await db.refresh(daily_diet)
    return daily_diet


@router.post("/daily-diets/{daily_diet_id}/clone", response_model=DailyDietOut, status_code=status.HTTP_201_CREATED)
async def clone_daily_diet(
    daily_diet_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> DailyDiet:
    source = await get_daily_diet_or_404(db, user_id, daily_diet_id)
    clone = DailyDiet(
        user_id=user_id,
        diet_date=source.diet_date,
        name=f"{source.name} (copia)",
        phase=source.phase,
        notes=source.notes,
    )
    db.add(clone)
    await db.flush()

    source_meals = (
        await db.execute(
            select(Meal)
            .where(
                Meal.daily_diet_id == source.id,
                Meal.user_id == user_id,
                Meal.deleted_at.is_(None),
            )
            .order_by(Meal.position.asc())
        )
    ).scalars().all()

    for source_meal in source_meals:
        cloned_meal = Meal(
            user_id=user_id,
            daily_diet_id=clone.id,
            meal_type=source_meal.meal_type,
            position=source_meal.position,
        )
        db.add(cloned_meal)
        await db.flush()

        source_entries = (
            await db.execute(
                select(MealEntry)
                .where(
                    MealEntry.meal_id == source_meal.id,
                    MealEntry.user_id == user_id,
                    MealEntry.deleted_at.is_(None),
                )
            )
        ).scalars().all()

        for source_entry in source_entries:
            db.add(
                MealEntry(
                    user_id=user_id,
                    meal_id=cloned_meal.id,
                    entry_type=source_entry.entry_type,
                    food_item_id=source_entry.food_item_id,
                    recipe_id=source_entry.recipe_id,
                    custom_name=source_entry.custom_name,
                    grams=source_entry.grams,
                    servings=source_entry.servings,
                    protein_g=source_entry.protein_g,
                    carbs_g=source_entry.carbs_g,
                    fats_g=source_entry.fats_g,
                    calories=source_entry.calories,
                )
            )

    await db.commit()
    await db.refresh(clone)
    return clone


@router.delete("/daily-diets/{daily_diet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_daily_diet(
    daily_diet_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    daily_diet = await get_daily_diet_or_404(db, user_id, daily_diet_id)
    daily_diet.deleted_at = utc_now()
    await db.commit()


@router.get("/daily-diets/{daily_diet_id}/meals", response_model=list[MealOut])
async def list_meals(
    daily_diet_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[Meal]:
    await get_daily_diet_or_404(db, user_id, daily_diet_id)
    return (
        await db.execute(
            select(Meal)
            .where(
                Meal.daily_diet_id == daily_diet_id,
                Meal.user_id == user_id,
                Meal.deleted_at.is_(None),
            )
            .order_by(Meal.position.asc())
        )
    ).scalars().all()


@router.post("/daily-diets/{daily_diet_id}/meals", response_model=MealOut, status_code=status.HTTP_201_CREATED)
async def create_meal(
    daily_diet_id: UUID,
    payload: MealCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> Meal:
    await get_daily_diet_or_404(db, user_id, daily_diet_id)

    max_position = (
        await db.execute(
            select(func.max(Meal.position)).where(
                Meal.daily_diet_id == daily_diet_id,
                Meal.user_id == user_id,
                Meal.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    meal = Meal(
        user_id=user_id,
        daily_diet_id=daily_diet_id,
        meal_type=payload.meal_type,
        position=(max_position or 0) + 1,
    )
    db.add(meal)
    await db.flush()
    await db.commit()
    await db.refresh(meal)
    return meal


@router.delete("/meals/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal(
    meal_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    meal = await get_meal_or_404(db, user_id, meal_id)
    meal.deleted_at = utc_now()
    await db.commit()


@router.get("/meals/{meal_id}/entries", response_model=list[MealEntryOut])
async def list_meal_entries(
    meal_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[MealEntry]:
    await get_meal_or_404(db, user_id, meal_id)
    return (
        await db.execute(
            select(MealEntry)
            .where(
                MealEntry.meal_id == meal_id,
                MealEntry.user_id == user_id,
                MealEntry.deleted_at.is_(None),
            )
            .order_by(MealEntry.created_at.asc())
        )
    ).scalars().all()


@router.post("/meals/{meal_id}/entries", response_model=MealEntryOut, status_code=status.HTTP_201_CREATED)
async def create_meal_entry(
    meal_id: UUID,
    payload: MealEntryCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> MealEntry:
    await get_meal_or_404(db, user_id, meal_id)

    protein = Decimal("0")
    carbs = Decimal("0")
    fats = Decimal("0")
    calories = Decimal("0")

    if payload.entry_type == "food":
        if payload.food_item_id is None:
            raise HTTPException(status_code=400, detail="food_item_id es obligatorio para entry_type=food")
        food = await get_food_or_404(db, user_id, payload.food_item_id)
        macros = compute_food_macros(food, payload.grams * payload.servings)
        protein = macros["protein_g"]
        carbs = macros["carbs_g"]
        fats = macros["fats_g"]
        calories = macros["calories"]

    elif payload.entry_type == "recipe":
        if payload.recipe_id is None:
            raise HTTPException(status_code=400, detail="recipe_id es obligatorio para entry_type=recipe")
        recipe = await get_recipe_or_404(db, user_id, payload.recipe_id)
        rows = (
            await db.execute(
                select(RecipeItem, FoodItem)
                .join(FoodItem, FoodItem.id == RecipeItem.food_item_id)
                .where(
                    RecipeItem.recipe_id == recipe.id,
                    RecipeItem.user_id == user_id,
                    RecipeItem.deleted_at.is_(None),
                    FoodItem.deleted_at.is_(None),
                )
            )
        ).all()
        macros_per_serving = compute_recipe_macros(rows, Decimal(recipe.servings))
        protein = macros_per_serving["protein_g"] * payload.servings
        carbs = macros_per_serving["carbs_g"] * payload.servings
        fats = macros_per_serving["fats_g"] * payload.servings
        calories = macros_per_serving["calories"] * payload.servings

    entry = MealEntry(
        user_id=user_id,
        meal_id=meal_id,
        entry_type=payload.entry_type,
        food_item_id=payload.food_item_id,
        recipe_id=payload.recipe_id,
        custom_name=payload.custom_name,
        grams=payload.grams,
        servings=payload.servings,
        protein_g=round_decimal(protein),
        carbs_g=round_decimal(carbs),
        fats_g=round_decimal(fats),
        calories=round_decimal(calories),
    )
    db.add(entry)
    await db.flush()
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch("/meal-entries/{entry_id}", response_model=MealEntryOut)
async def update_meal_entry(
    entry_id: UUID,
    payload: MealEntryUpdate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> MealEntry:
    entry = await get_meal_entry_or_404(db, user_id, entry_id)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(entry, key, value)

    if payload.grams is not None or payload.servings is not None:
        if entry.entry_type == "food" and entry.food_item_id:
            food = await get_food_or_404(db, user_id, entry.food_item_id)
            macros = compute_food_macros(food, entry.grams * entry.servings)
            entry.protein_g = round_decimal(macros["protein_g"])
            entry.carbs_g = round_decimal(macros["carbs_g"])
            entry.fats_g = round_decimal(macros["fats_g"])
            entry.calories = round_decimal(macros["calories"])

    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/meal-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal_entry(
    entry_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    entry = await get_meal_entry_or_404(db, user_id, entry_id)
    entry.deleted_at = utc_now()
    await db.commit()


@router.get("/daily-diets/{daily_diet_id}/summary", response_model=MacroSummary)
async def daily_summary(
    daily_diet_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> dict:
    await get_daily_diet_or_404(db, user_id, daily_diet_id)

    entries = (
        await db.execute(
            select(MealEntry)
            .join(Meal, Meal.id == MealEntry.meal_id)
            .where(
                Meal.daily_diet_id == daily_diet_id,
                Meal.user_id == user_id,
                Meal.deleted_at.is_(None),
                MealEntry.deleted_at.is_(None),
            )
        )
    ).scalars().all()

    return summarize_entries(entries)


@router.get("/daily-diets/{daily_diet_id}/breakdown", response_model=dict)
async def daily_breakdown(
    daily_diet_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> dict:
    await get_daily_diet_or_404(db, user_id, daily_diet_id)

    meals = (
        await db.execute(
            select(Meal)
            .where(
                Meal.daily_diet_id == daily_diet_id,
                Meal.user_id == user_id,
                Meal.deleted_at.is_(None),
            )
            .order_by(Meal.position.asc())
        )
    ).scalars().all()

    meal_data: list[dict] = []
    all_entries: list[MealEntry] = []

    for meal in meals:
        entries = (
            await db.execute(
                select(MealEntry).where(
                    MealEntry.meal_id == meal.id,
                    MealEntry.user_id == user_id,
                    MealEntry.deleted_at.is_(None),
                )
            )
        ).scalars().all()
        all_entries.extend(entries)

        summary = summarize_entries(entries)
        entry_breakdown = []
        for entry in entries:
            pct = Decimal("0") if summary["calories"] == 0 else (entry.calories / summary["calories"]) * Decimal("100")
            entry_breakdown.append(
                {
                    "entry_id": str(entry.id),
                    "entry_type": entry.entry_type,
                    "name": entry.custom_name,
                    "calories": float(entry.calories),
                    "pct_calories_within_meal": float(round_decimal(pct)),
                }
            )

        meal_data.append(
            {
                "meal_id": str(meal.id),
                "meal_type": meal.meal_type,
                "summary": {k: float(round_decimal(v)) for k, v in summary.items()},
                "entries": entry_breakdown,
            }
        )

    daily = summarize_entries(all_entries)
    total_calories = daily["calories"]

    for meal_item in meal_data:
        meal_calories = Decimal(str(meal_item["summary"]["calories"]))
        pct_in_day = Decimal("0") if total_calories == 0 else (meal_calories / total_calories) * Decimal("100")
        meal_item["pct_calories_in_day"] = float(round_decimal(pct_in_day))

    return {
        "daily": {k: float(round_decimal(v)) for k, v in daily.items()},
        "meals": meal_data,
    }
