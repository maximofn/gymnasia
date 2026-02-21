from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    AgentMemoryEntry,
    ChatMessage,
    ChatRoleEnum,
    ChatThread,
    MemoryDomainEnum,
    User,
    UserAISettings,
)
from app.schemas import (
    AgentMemoryResponse,
    AgentMemoryUpsertRequest,
    ChatMessageCreateRequest,
    ChatMessageResponse,
    ChatThreadCreateRequest,
    ChatThreadResponse,
)
from app.services.ai_runtime import detect_safety_flags, generate_chat_reply, pick_active_provider

router = APIRouter(prefix="/chat", tags=["chat"])


def _uuid_or_404(raw_id: str) -> UUID:
    try:
        return UUID(raw_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Resource not found") from exc


def _thread_or_404(thread_id: str, user: User, db: Session) -> ChatThread:
    thread = (
        db.query(ChatThread)
        .filter(ChatThread.id == _uuid_or_404(thread_id), ChatThread.user_id == user.id)
        .first()
    )
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


def _to_message_response(row: ChatMessage) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=str(row.id),
        thread_id=str(row.thread_id),
        role=row.role,
        content=row.content,
        provider=row.provider,
        model=row.model,
        prompt_tokens=row.prompt_tokens,
        completion_tokens=row.completion_tokens,
        safety_flags=row.safety_flags,
        created_at=row.created_at,
    )


def _to_memory_response(row: AgentMemoryEntry) -> AgentMemoryResponse:
    return AgentMemoryResponse(
        id=str(row.id),
        domain=row.domain,
        memory_key=row.memory_key,
        memory_value=row.memory_value,
        source_chat_message_id=str(row.source_chat_message_id) if row.source_chat_message_id else None,
        created_at=row.created_at,
        updated_at=row.updated_at,
        deleted_at=row.deleted_at,
    )


@router.get("/threads", response_model=list[ChatThreadResponse])
def list_threads(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ChatThreadResponse]:
    threads = (
        db.query(ChatThread)
        .filter(ChatThread.user_id == user.id)
        .order_by(ChatThread.updated_at.desc())
        .all()
    )

    responses: list[ChatThreadResponse] = []
    for thread in threads:
        message_count = db.query(func.count(ChatMessage.id)).filter(ChatMessage.thread_id == thread.id).scalar() or 0
        last_message = (
            db.query(ChatMessage)
            .filter(ChatMessage.thread_id == thread.id)
            .order_by(ChatMessage.created_at.desc())
            .first()
        )
        responses.append(
            ChatThreadResponse(
                id=str(thread.id),
                title=thread.title,
                message_count=int(message_count),
                last_message_preview=(last_message.content[:140] if last_message else None),
                last_activity_at=(last_message.created_at if last_message else thread.updated_at),
                created_at=thread.created_at,
                updated_at=thread.updated_at,
            )
        )

    return responses


@router.post("/threads", response_model=ChatThreadResponse, status_code=status.HTTP_201_CREATED)
def create_thread(
    payload: ChatThreadCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatThreadResponse:
    thread = ChatThread(user_id=user.id, title=payload.title)
    db.add(thread)
    db.commit()
    db.refresh(thread)

    return ChatThreadResponse(
        id=str(thread.id),
        title=thread.title,
        message_count=0,
        last_message_preview=None,
        last_activity_at=None,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
    )


@router.get("/threads/{thread_id}/messages", response_model=list[ChatMessageResponse])
def list_messages(
    thread_id: str,
    limit: int = Query(default=100, ge=1, le=400),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatMessageResponse]:
    thread = _thread_or_404(thread_id, user, db)
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.thread_id == thread.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )
    return [_to_message_response(row) for row in rows]


@router.post("/threads/{thread_id}/messages", response_model=list[ChatMessageResponse], status_code=status.HTTP_201_CREATED)
def send_message(
    thread_id: str,
    payload: ChatMessageCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatMessageResponse]:
    thread = _thread_or_404(thread_id, user, db)

    provider = pick_active_provider(db, user.id)
    if provider is None:
        raise HTTPException(status_code=409, detail="AI disabled. Configure an active BYOK key first.")

    settings = db.query(UserAISettings).filter(UserAISettings.user_id == user.id).first()
    rate_limit = settings.chat_rate_limit_per_min if settings else 10

    since = datetime.now(UTC) - timedelta(minutes=1)
    sent_last_minute = (
        db.query(func.count(ChatMessage.id))
        .join(ChatThread, ChatThread.id == ChatMessage.thread_id)
        .filter(
            ChatThread.user_id == user.id,
            ChatMessage.role == ChatRoleEnum.user,
            ChatMessage.created_at >= since,
        )
        .scalar()
        or 0
    )
    if int(sent_last_minute) >= int(rate_limit):
        raise HTTPException(status_code=429, detail="Chat rate limit exceeded")

    user_message = ChatMessage(
        thread_id=thread.id,
        role=ChatRoleEnum.user,
        content=payload.content,
        provider=None,
        model=None,
        prompt_tokens=max(1, len(payload.content.split())),
        completion_tokens=None,
        safety_flags=None,
    )
    db.add(user_message)
    db.flush()

    safety_flags = detect_safety_flags(payload.content)
    reply = generate_chat_reply(payload.content, safety_flags, provider)

    assistant_message = ChatMessage(
        thread_id=thread.id,
        role=ChatRoleEnum.assistant,
        content=reply,
        provider=provider,
        model=f"{provider.value}-v1-local",
        prompt_tokens=max(1, len(payload.content.split())),
        completion_tokens=max(1, len(reply.split())),
        safety_flags={"flags": safety_flags} if safety_flags else None,
    )
    db.add(assistant_message)

    memory_entry = (
        db.query(AgentMemoryEntry)
        .filter(
            AgentMemoryEntry.user_id == user.id,
            AgentMemoryEntry.domain == MemoryDomainEnum.global_,
            AgentMemoryEntry.memory_key == "last_user_intent",
            AgentMemoryEntry.deleted_at.is_(None),
        )
        .first()
    )
    if memory_entry is None:
        memory_entry = AgentMemoryEntry(
            user_id=user.id,
            domain=MemoryDomainEnum.global_,
            memory_key="last_user_intent",
            memory_value={"text": payload.content[:400]},
            source_chat_message_id=user_message.id,
        )
    else:
        memory_entry.memory_value = {"text": payload.content[:400]}
        memory_entry.source_chat_message_id = user_message.id
        memory_entry.deleted_at = None
    db.add(memory_entry)

    thread.updated_at = datetime.now(UTC)
    db.add(thread)

    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)

    return [_to_message_response(user_message), _to_message_response(assistant_message)]


@router.get("/memory", response_model=list[AgentMemoryResponse])
def list_memory(
    domain: MemoryDomainEnum | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AgentMemoryResponse]:
    query = db.query(AgentMemoryEntry).filter(
        AgentMemoryEntry.user_id == user.id,
        AgentMemoryEntry.deleted_at.is_(None),
    )
    if domain is not None:
        query = query.filter(AgentMemoryEntry.domain == domain)

    rows = query.order_by(AgentMemoryEntry.updated_at.desc()).all()
    return [_to_memory_response(row) for row in rows]


@router.put("/memory/{domain}/{memory_key}", response_model=AgentMemoryResponse)
def upsert_memory(
    domain: MemoryDomainEnum,
    memory_key: str,
    payload: AgentMemoryUpsertRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentMemoryResponse:
    entry = (
        db.query(AgentMemoryEntry)
        .filter(
            AgentMemoryEntry.user_id == user.id,
            AgentMemoryEntry.domain == domain,
            AgentMemoryEntry.memory_key == memory_key,
        )
        .first()
    )

    if entry is None:
        entry = AgentMemoryEntry(
            user_id=user.id,
            domain=domain,
            memory_key=memory_key,
            memory_value=payload.value,
            source_chat_message_id=None,
            deleted_at=None,
        )
    else:
        entry.memory_value = payload.value
        entry.deleted_at = None

    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _to_memory_response(entry)


@router.delete("/memory/{domain}/{memory_key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(
    domain: MemoryDomainEnum,
    memory_key: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    entry = (
        db.query(AgentMemoryEntry)
        .filter(
            AgentMemoryEntry.user_id == user.id,
            AgentMemoryEntry.domain == domain,
            AgentMemoryEntry.memory_key == memory_key,
            AgentMemoryEntry.deleted_at.is_(None),
        )
        .first()
    )
    if entry is None:
        return

    entry.deleted_at = datetime.now(UTC)
    db.add(entry)
    db.commit()
