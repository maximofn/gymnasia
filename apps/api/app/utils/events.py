from uuid import UUID

from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import AuditLog, DomainEvent


async def log_event(
    db: AsyncSession,
    *,
    user_id: UUID,
    domain: str,
    action: str,
    entity_type: str,
    entity_id: UUID | None,
    payload: dict,
) -> None:
    await db.execute(
        insert(DomainEvent).values(
            user_id=user_id,
            domain=domain,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
        )
    )


async def log_audit(
    db: AsyncSession,
    *,
    user_id: UUID,
    table_name: str,
    record_id: UUID,
    action: str,
    changes: dict,
) -> None:
    await db.execute(
        insert(AuditLog).values(
            user_id=user_id,
            table_name=table_name,
            record_id=record_id,
            action=action,
            changes=changes,
        )
    )
