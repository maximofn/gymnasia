from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import SyncOperation, SyncStatusEnum, User
from app.schemas import SyncBulkUpsertRequest, SyncOperationResponse

router = APIRouter(prefix="/sync", tags=["sync"])


def _to_response(row: SyncOperation) -> SyncOperationResponse:
    return SyncOperationResponse(
        id=str(row.id),
        device_id=row.device_id,
        entity_type=row.entity_type,
        entity_id=str(row.entity_id) if row.entity_id else None,
        op_type=row.op_type,
        payload=row.payload,
        client_updated_at=row.client_updated_at,
        server_received_at=row.server_received_at,
        status=row.status,
        retries=row.retries,
        last_error=row.last_error,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.post("/operations/bulk", response_model=list[SyncOperationResponse])
def bulk_push_operations(
    payload: SyncBulkUpsertRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SyncOperationResponse]:
    rows: list[SyncOperation] = []

    for operation in payload.operations:
        entity_id = operation.entity_id

        latest = (
            db.query(SyncOperation)
            .filter(
                SyncOperation.user_id == user.id,
                SyncOperation.entity_type == operation.entity_type,
                SyncOperation.entity_id == entity_id,
                SyncOperation.status == SyncStatusEnum.applied,
            )
            .order_by(SyncOperation.client_updated_at.desc())
            .first()
        )

        status = SyncStatusEnum.applied
        error: str | None = None
        if latest and operation.client_updated_at < latest.client_updated_at:
            status = SyncStatusEnum.failed
            error = "Stale operation rejected by last-write-wins"

        row = SyncOperation(
            user_id=user.id,
            device_id=payload.device_id,
            entity_type=operation.entity_type,
            entity_id=entity_id,
            op_type=operation.op_type,
            payload=operation.payload,
            client_updated_at=operation.client_updated_at,
            server_received_at=datetime.now(UTC),
            status=status,
            retries=0,
            last_error=error,
        )
        db.add(row)
        rows.append(row)

    db.commit()
    for row in rows:
        db.refresh(row)
    return [_to_response(row) for row in rows]


@router.get("/operations", response_model=list[SyncOperationResponse])
def list_operations(
    status: SyncStatusEnum | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SyncOperationResponse]:
    query = db.query(SyncOperation).filter(SyncOperation.user_id == user.id)
    if status is not None:
        query = query.filter(SyncOperation.status == status)

    rows = query.order_by(SyncOperation.created_at.desc()).limit(limit).all()
    return [_to_response(row) for row in rows]


@router.post("/operations/{operation_id}/retry", response_model=SyncOperationResponse)
def retry_operation(
    operation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SyncOperationResponse:
    try:
        operation_uuid = UUID(operation_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Operation not found") from exc

    row = (
        db.query(SyncOperation)
        .filter(SyncOperation.id == operation_uuid, SyncOperation.user_id == user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Operation not found")

    row.retries += 1
    if row.retries > 5:
        row.status = SyncStatusEnum.failed
        row.last_error = "Max retries exceeded"
    else:
        row.status = SyncStatusEnum.applied
        row.last_error = None

    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_response(row)
