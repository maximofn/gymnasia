from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SoftDeleteResponse(BaseModel):
    id: UUID
    deleted_at: datetime
