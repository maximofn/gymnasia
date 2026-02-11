from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db_session
from app.models.core import ChatMessage, ChatThread
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageOut,
    ChatThreadCreate,
    ChatThreadOut,
    TranscriptionResponse,
)
from app.services.agent import SectionAgentService
from app.utils.auth import get_current_user_id
from app.utils.events import log_event

router = APIRouter()
agent_service = SectionAgentService()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def get_thread_or_404(db: AsyncSession, user_id: UUID, thread_id: UUID) -> ChatThread:
    thread = (
        await db.execute(
            select(ChatThread).where(
                ChatThread.id == thread_id,
                ChatThread.user_id == user_id,
                ChatThread.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Hilo no encontrado")
    return thread


@router.get("/threads", response_model=list[ChatThreadOut])
async def list_threads(
    section: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[ChatThread]:
    stmt = select(ChatThread).where(ChatThread.user_id == user_id, ChatThread.deleted_at.is_(None))
    if section:
        stmt = stmt.where(ChatThread.section == section)

    return (await db.execute(stmt.order_by(ChatThread.created_at.desc()))).scalars().all()


@router.post("/threads", response_model=ChatThreadOut, status_code=status.HTTP_201_CREATED)
async def create_thread(
    payload: ChatThreadCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> ChatThread:
    thread = ChatThread(user_id=user_id, section=payload.section, title=payload.title)
    db.add(thread)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="chat",
        action="thread.create",
        entity_type="chat_threads",
        entity_id=thread.id,
        payload=payload.model_dump(),
    )

    await db.commit()
    await db.refresh(thread)
    return thread


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> None:
    thread = await get_thread_or_404(db, user_id, thread_id)
    thread.deleted_at = utc_now()
    await db.commit()


@router.get("/threads/{thread_id}/messages", response_model=list[ChatMessageOut])
async def list_messages(
    thread_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[ChatMessage]:
    await get_thread_or_404(db, user_id, thread_id)
    return (
        await db.execute(
            select(ChatMessage)
            .where(
                ChatMessage.thread_id == thread_id,
                ChatMessage.user_id == user_id,
            )
            .order_by(ChatMessage.created_at.asc())
        )
    ).scalars().all()


@router.post("/threads/{thread_id}/messages", response_model=list[ChatMessageOut])
async def send_message(
    thread_id: UUID,
    payload: ChatMessageCreate,
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> list[ChatMessage]:
    thread = await get_thread_or_404(db, user_id, thread_id)

    user_message = ChatMessage(
        user_id=user_id,
        thread_id=thread.id,
        role="user",
        content=payload.content,
        provider=payload.provider,
        model=payload.model,
    )
    db.add(user_message)
    await db.flush()

    agent_reply = await agent_service.respond(
        section=thread.section,
        user_message=payload.content,
        provider=payload.provider,
        model=payload.model,
    )

    assistant_message = ChatMessage(
        user_id=user_id,
        thread_id=thread.id,
        role="assistant",
        content=agent_reply.text,
        provider=agent_reply.provider,
        model=agent_reply.model,
    )
    db.add(assistant_message)
    await db.flush()

    await log_event(
        db,
        user_id=user_id,
        domain="chat",
        action="message.exchange",
        entity_type="chat_messages",
        entity_id=assistant_message.id,
        payload={
            "thread_id": str(thread.id),
            "section": thread.section,
            "provider": agent_reply.provider,
            "model": agent_reply.model,
        },
    )

    await db.commit()
    await db.refresh(user_message)
    await db.refresh(assistant_message)

    return [user_message, assistant_message]


@router.post("/threads/{thread_id}/audio", response_model=TranscriptionResponse)
async def transcribe_audio(
    thread_id: UUID,
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    user_id: UUID = Depends(get_current_user_id),
) -> TranscriptionResponse:
    thread = await get_thread_or_404(db, user_id, thread_id)

    # Placeholder de transcripcion: integra Whisper real en esta capa.
    transcript = f"Audio recibido ({audio.filename}) para seccion {thread.section}."

    user_message = ChatMessage(
        user_id=user_id,
        thread_id=thread.id,
        role="user",
        content=transcript,
        audio_path=f"uploads/audio/{audio.filename}",
    )
    db.add(user_message)

    await log_event(
        db,
        user_id=user_id,
        domain="chat",
        action="audio.transcribed",
        entity_type="chat_messages",
        entity_id=user_message.id,
        payload={"thread_id": str(thread.id), "filename": audio.filename},
    )

    await db.commit()

    return TranscriptionResponse(transcript=transcript)
