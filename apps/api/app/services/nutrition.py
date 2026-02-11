from decimal import Decimal

from app.models.core import FoodItem, MealEntry, RecipeItem

KCAL_PROTEIN = Decimal("4")
KCAL_CARBS = Decimal("4")
KCAL_FATS = Decimal("9")


def compute_food_macros(food: FoodItem, grams: Decimal) -> dict[str, Decimal]:
    factor = grams / Decimal("100")
    protein = food.protein_per_100g * factor
    carbs = food.carbs_per_100g * factor
    fats = food.fats_per_100g * factor
    calories = food.calories_per_100g * factor
    return {
        "protein_g": protein,
        "carbs_g": carbs,
        "fats_g": fats,
        "calories": calories,
    }


def compute_recipe_macros(recipe_items: list[tuple[RecipeItem, FoodItem]], servings: Decimal) -> dict[str, Decimal]:
    protein = Decimal("0")
    carbs = Decimal("0")
    fats = Decimal("0")
    calories = Decimal("0")

    for recipe_item, food in recipe_items:
        item_macros = compute_food_macros(food, recipe_item.grams)
        protein += item_macros["protein_g"]
        carbs += item_macros["carbs_g"]
        fats += item_macros["fats_g"]
        calories += item_macros["calories"]

    if servings > 0:
        protein /= servings
        carbs /= servings
        fats /= servings
        calories /= servings

    return {
        "protein_g": protein,
        "carbs_g": carbs,
        "fats_g": fats,
        "calories": calories,
    }


def summarize_entries(entries: list[MealEntry]) -> dict[str, Decimal]:
    protein = sum((entry.protein_g for entry in entries), Decimal("0"))
    carbs = sum((entry.carbs_g for entry in entries), Decimal("0"))
    fats = sum((entry.fats_g for entry in entries), Decimal("0"))
    calories = sum((entry.calories for entry in entries), Decimal("0"))

    calories_from_protein = protein * KCAL_PROTEIN
    calories_from_carbs = carbs * KCAL_CARBS
    calories_from_fats = fats * KCAL_FATS

    if calories > 0:
        pct_protein = (calories_from_protein / calories) * Decimal("100")
        pct_carbs = (calories_from_carbs / calories) * Decimal("100")
        pct_fats = (calories_from_fats / calories) * Decimal("100")
    else:
        pct_protein = Decimal("0")
        pct_carbs = Decimal("0")
        pct_fats = Decimal("0")

    return {
        "protein_g": protein,
        "carbs_g": carbs,
        "fats_g": fats,
        "calories": calories,
        "calories_from_protein": calories_from_protein,
        "calories_from_carbs": calories_from_carbs,
        "calories_from_fats": calories_from_fats,
        "pct_calories_protein": pct_protein,
        "pct_calories_carbs": pct_carbs,
        "pct_calories_fats": pct_fats,
    }
