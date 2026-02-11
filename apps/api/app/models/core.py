from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TimeStampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UserGoal(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "user_goals"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    section: Mapped[str] = mapped_column(String(32), nullable=False)
    objective: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ExerciseLibrary(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "exercise_library"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    muscle_group: Mapped[str] = mapped_column(String(64), nullable=False)
    equipment: Mapped[str] = mapped_column(String(64), nullable=False, default="other")
    instructions: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)


class TrainingPlan(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "training_plans"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class TrainingPlanExercise(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "training_plan_exercises"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    plan_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("training_plans.id"), nullable=False)
    exercise_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("exercise_library.id"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class TrainingSet(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "training_sets"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    plan_exercise_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("training_plan_exercises.id"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    rest_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))


class TrainingSession(Base, TimeStampMixin):
    __tablename__ = "training_sessions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    plan_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("training_plans.id"), nullable=True)
    plan_version_at_start: Mapped[int | None] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    should_update_template: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class TrainingSessionExercise(Base, TimeStampMixin):
    __tablename__ = "training_session_exercises"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    session_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("training_sessions.id"), nullable=False)
    source_plan_exercise_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("training_plan_exercises.id"),
    )
    exercise_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("exercise_library.id"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class TrainingSessionSet(Base, TimeStampMixin):
    __tablename__ = "training_session_sets"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    session_exercise_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("training_session_exercises.id"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    rest_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))


class PersonalRecord(Base, TimeStampMixin):
    __tablename__ = "personal_records"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    exercise_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("exercise_library.id"), nullable=False)
    record_type: Mapped[str] = mapped_column(String(32), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    session_set_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("training_session_sets.id"),
        nullable=False,
    )


class FoodItem(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "food_items"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    unit: Mapped[str] = mapped_column(String(16), default="g", nullable=False)
    protein_per_100g: Mapped[Decimal] = mapped_column(Numeric(7, 2), default=0, nullable=False)
    carbs_per_100g: Mapped[Decimal] = mapped_column(Numeric(7, 2), default=0, nullable=False)
    fats_per_100g: Mapped[Decimal] = mapped_column(Numeric(7, 2), default=0, nullable=False)
    calories_per_100g: Mapped[Decimal] = mapped_column(Numeric(7, 2), default=0, nullable=False)


class Recipe(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "recipes"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text)
    servings: Mapped[int] = mapped_column(Integer, default=1, nullable=False)


class RecipeItem(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "recipe_items"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    recipe_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("recipes.id"), nullable=False)
    food_item_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("food_items.id"), nullable=False)
    grams: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)


class DailyDiet(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "daily_diets"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    diet_date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phase: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(Text)


class Meal(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "meals"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    daily_diet_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("daily_diets.id"), nullable=False)
    meal_type: Mapped[str] = mapped_column(String(32), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class MealEntry(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "meal_entries"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    meal_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("meals.id"), nullable=False)
    entry_type: Mapped[str] = mapped_column(String(16), nullable=False)
    food_item_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("food_items.id"), nullable=True)
    recipe_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("recipes.id"), nullable=True)
    custom_name: Mapped[str | None] = mapped_column(String(140))
    grams: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    servings: Mapped[Decimal] = mapped_column(Numeric(7, 2), default=1, nullable=False)
    protein_g: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0, nullable=False)
    carbs_g: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0, nullable=False)
    fats_g: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0, nullable=False)
    calories: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0, nullable=False)


class BodyMeasurement(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "body_measurements"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    measured_at: Mapped[date] = mapped_column(Date, nullable=False)
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    body_fat_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    waist_cm: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    hip_cm: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    chest_cm: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    arm_cm: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    thigh_cm: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    notes: Mapped[str | None] = mapped_column(Text)


class ProgressPhoto(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "progress_photos"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    measured_at: Mapped[date] = mapped_column(Date, nullable=False)
    photo_type: Mapped[str] = mapped_column(String(32), default="other", nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)


class ChatThread(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "chat_threads"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    section: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(140), nullable=False)


class ChatMessage(Base, TimeStampMixin):
    __tablename__ = "chat_messages"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    thread_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("chat_threads.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    audio_path: Mapped[str | None] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(String(32))
    model: Mapped[str | None] = mapped_column(String(80))
    metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


class MediaAsset(Base, TimeStampMixin, SoftDeleteMixin):
    __tablename__ = "media_assets"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True))
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    generator: Mapped[str] = mapped_column(String(80), default="manual", nullable=False)
    generation_prompt: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="completed", nullable=False)
    metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DomainEvent(Base):
    __tablename__ = "domain_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    domain: Mapped[str] = mapped_column(String(32), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    table_name: Mapped[str] = mapped_column(String(64), nullable=False)
    record_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    changes: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
