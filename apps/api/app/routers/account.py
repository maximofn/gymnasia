from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import AccountStatusEnum, BackgroundJob, DataExportRequest, JobStatusEnum, JobTypeEnum, User
from app.schemas import AccountDeleteRequest, AccountStatusResponse, BackgroundJobResponse, DataExportRequestResponse

router = APIRouter(prefix="/account", tags=["account"])
settings = get_settings()


def _to_export_response(row: DataExportRequest) -> DataExportRequestResponse:
    return DataExportRequestResponse(
        id=str(row.id),
        status=row.status,
        export_path=row.export_path,
        requested_at=row.requested_at,
        fulfilled_at=row.fulfilled_at,
        expires_at=row.expires_at,
    )


@router.get("/status", response_model=AccountStatusResponse)
def account_status(user: User = Depends(get_current_user)) -> AccountStatusResponse:
    return AccountStatusResponse(
        user_id=str(user.id),
        account_status=user.account_status.value,
        delete_requested_at=user.delete_requested_at,
        scheduled_delete_at=user.scheduled_delete_at,
    )


@router.post("/delete-request", response_model=AccountStatusResponse)
def request_account_delete(
    payload: AccountDeleteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccountStatusResponse:
    now = datetime.now(UTC)
    user.account_status = AccountStatusEnum.pending_delete
    user.delete_requested_at = now
    user.scheduled_delete_at = now + timedelta(days=payload.grace_days)
    db.add(user)
    db.commit()
    db.refresh(user)

    return AccountStatusResponse(
        user_id=str(user.id),
        account_status=user.account_status.value,
        delete_requested_at=user.delete_requested_at,
        scheduled_delete_at=user.scheduled_delete_at,
    )


@router.post("/cancel-delete", response_model=AccountStatusResponse)
def cancel_account_delete(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccountStatusResponse:
    user.account_status = AccountStatusEnum.active
    user.delete_requested_at = None
    user.scheduled_delete_at = None
    db.add(user)
    db.commit()
    db.refresh(user)

    return AccountStatusResponse(
        user_id=str(user.id),
        account_status=user.account_status.value,
        delete_requested_at=user.delete_requested_at,
        scheduled_delete_at=user.scheduled_delete_at,
    )


@router.post("/export-request", response_model=BackgroundJobResponse, status_code=status.HTTP_201_CREATED)
def request_export(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BackgroundJobResponse:
    export_request = DataExportRequest(
        user_id=user.id,
        status="requested",
    )
    db.add(export_request)
    db.flush()

    job = BackgroundJob(
        user_id=user.id,
        type=JobTypeEnum.data_export,
        status=JobStatusEnum.running,
        payload={"export_request_id": str(export_request.id)},
        attempts=1,
        max_attempts=5,
    )
    db.add(job)
    db.flush()

    export_request.status = "ready"
    export_request.export_path = f"exports/{user.id}/{export_request.id}.json"
    export_request.fulfilled_at = datetime.now(UTC)
    export_request.expires_at = datetime.now(UTC) + timedelta(days=30)
    db.add(export_request)

    job.status = JobStatusEnum.done
    job.result = {
        "export_path": export_request.export_path,
        "expires_at": export_request.expires_at.isoformat() if export_request.expires_at else None,
    }
    db.add(job)

    db.commit()
    db.refresh(job)

    return BackgroundJobResponse(
        id=str(job.id),
        type=job.type,
        status=job.status,
        payload=job.payload,
        result=job.result,
        attempts=job.attempts,
        max_attempts=job.max_attempts,
        run_after=job.run_after,
        last_error=job.last_error,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.get("/export-requests", response_model=list[DataExportRequestResponse])
def list_export_requests(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[DataExportRequestResponse]:
    rows = (
        db.query(DataExportRequest)
        .filter(DataExportRequest.user_id == user.id)
        .order_by(DataExportRequest.requested_at.desc())
        .all()
    )
    return [_to_export_response(row) for row in rows]


@router.get("/export-requests/{request_id}", response_model=DataExportRequestResponse)
def get_export_request(
    request_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DataExportRequestResponse:
    try:
        request_uuid = UUID(request_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Export request not found") from exc

    row = (
        db.query(DataExportRequest)
        .filter(DataExportRequest.id == request_uuid, DataExportRequest.user_id == user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Export request not found")

    return _to_export_response(row)


@router.post("/internal/process-due-deletes")
def process_due_deletes(
    x_admin_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    if not x_admin_token or x_admin_token != settings.internal_admin_token:
        raise HTTPException(status_code=401, detail="Invalid admin token")

    now = datetime.now(UTC)
    due_users = (
        db.query(User)
        .filter(
            User.account_status == AccountStatusEnum.pending_delete,
            User.scheduled_delete_at.is_not(None),
            User.scheduled_delete_at <= now,
        )
        .all()
    )

    deleted = 0
    for user in due_users:
        db.delete(user)
        deleted += 1

    db.commit()
    return {"deleted_users": deleted, "processed_at": now.isoformat()}
