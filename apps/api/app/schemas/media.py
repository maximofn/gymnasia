from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MediaAssetCreate(BaseModel):
    source_type: str = Field(pattern="^(exercise_machine|meal|body|recipe|other)$")
    source_id: UUID | None = None
    storage_path: str
    mime_type: str


class MediaAssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_type: str
    source_id: UUID | None
    storage_path: str
    mime_type: str
    generator: str
    status: str
    created_at: datetime


class MediaGenerateRequest(BaseModel):
    source_asset_id: UUID
    generator: str = Field(pattern="^(google_nano_banana|veo3)$")
    prompt: str


class MediaGenerateResponse(BaseModel):
    generation_id: UUID
    status: str
    output_path: str | None = None
