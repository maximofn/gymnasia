from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FoodItemCreate(BaseModel):
    name: str
    unit: str = "g"
    protein_per_100g: Decimal = Field(default=0, ge=0)
    carbs_per_100g: Decimal = Field(default=0, ge=0)
    fats_per_100g: Decimal = Field(default=0, ge=0)
    calories_per_100g: Decimal = Field(default=0, ge=0)


class FoodItemUpdate(BaseModel):
    name: str | None = None
    unit: str | None = None
    protein_per_100g: Decimal | None = Field(default=None, ge=0)
    carbs_per_100g: Decimal | None = Field(default=None, ge=0)
    fats_per_100g: Decimal | None = Field(default=None, ge=0)
    calories_per_100g: Decimal | None = Field(default=None, ge=0)


class FoodItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    unit: str
    protein_per_100g: Decimal
    carbs_per_100g: Decimal
    fats_per_100g: Decimal
    calories_per_100g: Decimal


class RecipeCreate(BaseModel):
    name: str
    instructions: str | None = None
    servings: int = Field(default=1, ge=1)


class RecipeUpdate(BaseModel):
    name: str | None = None
    instructions: str | None = None
    servings: int | None = Field(default=None, ge=1)


class RecipeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    instructions: str | None
    servings: int


class RecipeScaleRequest(BaseModel):
    target_servings: Decimal = Field(gt=0)


class RecipeItemCreate(BaseModel):
    food_item_id: UUID
    grams: Decimal = Field(gt=0)


class DailyDietCreate(BaseModel):
    diet_date: date
    name: str
    phase: str | None = None
    notes: str | None = None


class DailyDietUpdate(BaseModel):
    name: str | None = None
    phase: str | None = None
    notes: str | None = None


class DailyDietOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    diet_date: date
    name: str
    phase: str | None
    notes: str | None


class MealCreate(BaseModel):
    meal_type: str


class MealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    daily_diet_id: UUID
    meal_type: str
    position: int


class MealEntryCreate(BaseModel):
    entry_type: str = Field(pattern="^(food|recipe|custom)$")
    food_item_id: UUID | None = None
    recipe_id: UUID | None = None
    custom_name: str | None = None
    grams: Decimal = Field(gt=0)
    servings: Decimal = Field(default=1, gt=0)


class MealEntryUpdate(BaseModel):
    grams: Decimal | None = Field(default=None, gt=0)
    servings: Decimal | None = Field(default=None, gt=0)
    custom_name: str | None = None


class MealEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    meal_id: UUID
    entry_type: str
    food_item_id: UUID | None
    recipe_id: UUID | None
    custom_name: str | None
    grams: Decimal
    servings: Decimal
    protein_g: Decimal
    carbs_g: Decimal
    fats_g: Decimal
    calories: Decimal


class MacroSummary(BaseModel):
    protein_g: Decimal
    carbs_g: Decimal
    fats_g: Decimal
    calories: Decimal
    calories_from_protein: Decimal
    calories_from_carbs: Decimal
    calories_from_fats: Decimal
    pct_calories_protein: Decimal
    pct_calories_carbs: Decimal
    pct_calories_fats: Decimal
