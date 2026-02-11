from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BodyMeasurementCreate(BaseModel):
    measured_at: date
    weight_kg: Decimal | None = Field(default=None, ge=0)
    body_fat_pct: Decimal | None = Field(default=None, ge=0)
    waist_cm: Decimal | None = Field(default=None, ge=0)
    hip_cm: Decimal | None = Field(default=None, ge=0)
    chest_cm: Decimal | None = Field(default=None, ge=0)
    arm_cm: Decimal | None = Field(default=None, ge=0)
    thigh_cm: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None


class BodyMeasurementUpdate(BaseModel):
    weight_kg: Decimal | None = Field(default=None, ge=0)
    body_fat_pct: Decimal | None = Field(default=None, ge=0)
    waist_cm: Decimal | None = Field(default=None, ge=0)
    hip_cm: Decimal | None = Field(default=None, ge=0)
    chest_cm: Decimal | None = Field(default=None, ge=0)
    arm_cm: Decimal | None = Field(default=None, ge=0)
    thigh_cm: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None


class BodyMeasurementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    measured_at: date
    weight_kg: Decimal | None
    body_fat_pct: Decimal | None
    waist_cm: Decimal | None
    hip_cm: Decimal | None
    chest_cm: Decimal | None
    arm_cm: Decimal | None
    thigh_cm: Decimal | None
    notes: str | None


class ProgressPhotoCreate(BaseModel):
    measured_at: date
    photo_type: str = "other"
    storage_path: str
    notes: str | None = None


class ProgressPhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    measured_at: date
    photo_type: str
    storage_path: str
    notes: str | None
