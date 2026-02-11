from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ExerciseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    muscle_group: str = Field(min_length=1, max_length=64)
    equipment: str = Field(default="other", max_length=64)
    instructions: str | None = None
    tags: list[str] = Field(default_factory=list)


class ExerciseUpdate(BaseModel):
    name: str | None = None
    muscle_group: str | None = None
    equipment: str | None = None
    instructions: str | None = None
    tags: list[str] | None = None


class ExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    muscle_group: str
    equipment: str
    instructions: str | None
    tags: list[str]


class TrainingPlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None


class TrainingPlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class TrainingPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    position: int
    version: int


class PlanReorderItem(BaseModel):
    id: UUID
    position: int


class PlanExerciseCreate(BaseModel):
    exercise_id: UUID
    notes: str | None = None


class PlanExerciseUpdate(BaseModel):
    exercise_id: UUID | None = None
    notes: str | None = None


class PlanExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_id: UUID
    exercise_id: UUID
    position: int
    notes: str | None


class PlanExerciseReorderItem(BaseModel):
    id: UUID
    position: int


class TrainingSetCreate(BaseModel):
    reps: int = Field(ge=1, le=200)
    rest_seconds: int = Field(ge=0, le=3600)
    weight_kg: Decimal | None = Field(default=None, ge=0)


class TrainingSetUpdate(BaseModel):
    reps: int | None = Field(default=None, ge=1, le=200)
    rest_seconds: int | None = Field(default=None, ge=0, le=3600)
    weight_kg: Decimal | None = Field(default=None, ge=0)


class TrainingSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_exercise_id: UUID
    position: int
    reps: int
    rest_seconds: int
    weight_kg: Decimal | None


class SessionStartRequest(BaseModel):
    plan_id: UUID


class SessionFinishRequest(BaseModel):
    should_update_template: bool = False
    notes: str | None = None


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_id: UUID | None
    started_at: datetime
    finished_at: datetime | None
    should_update_template: bool
    notes: str | None


class SessionSetUpdate(BaseModel):
    reps: int | None = Field(default=None, ge=1, le=200)
    rest_seconds: int | None = Field(default=None, ge=0, le=3600)
    weight_kg: Decimal | None = Field(default=None, ge=0)
