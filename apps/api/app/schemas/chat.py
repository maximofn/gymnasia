from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatThreadCreate(BaseModel):
    section: str = Field(pattern="^(training|diet|measures|general)$")
    title: str = Field(min_length=1, max_length=140)


class ChatThreadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    section: str
    title: str
    created_at: datetime


class ChatMessageCreate(BaseModel):
    content: str = Field(min_length=1)
    provider: str | None = None
    model: str | None = None


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    thread_id: UUID
    role: str
    content: str
    provider: str | None
    model: str | None
    created_at: datetime


class TranscriptionResponse(BaseModel):
    transcript: str
