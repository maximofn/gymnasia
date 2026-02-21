import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AccountStatusEnum(str, enum.Enum):
    active = "active"
    pending_delete = "pending_delete"


class AIProviderEnum(str, enum.Enum):
    anthropic = "anthropic"
    openai = "openai"
    google = "google"


class GoalDomainEnum(str, enum.Enum):
    training = "training"
    diet = "diet"
    body = "body"
    wellness = "wellness"


class WorkoutSessionStatusEnum(str, enum.Enum):
    in_progress = "in_progress"
    finished = "finished"


class MealTypeEnum(str, enum.Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    snack = "snack"
    dinner = "dinner"
    other = "other"


class MediaKindEnum(str, enum.Enum):
    diet_photo = "diet_photo"
    diet_label = "diet_label"
    diet_menu = "diet_menu"
    exercise_machine_photo = "exercise_machine_photo"
    exercise_generated_image = "exercise_generated_image"
    exercise_generated_video = "exercise_generated_video"
    measurement_photo = "measurement_photo"


class MediaStatusEnum(str, enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    ready = "ready"
    failed = "failed"
    deleted = "deleted"


class ChatRoleEnum(str, enum.Enum):
    system = "system"
    user = "user"
    assistant = "assistant"


class MemoryDomainEnum(str, enum.Enum):
    global_ = "global"
    training = "training"
    diet = "diet"
    measurements = "measurements"


class JobTypeEnum(str, enum.Enum):
    diet_photo_estimation = "diet_photo_estimation"
    exercise_image_generation = "exercise_image_generation"
    exercise_video_generation = "exercise_video_generation"
    data_export = "data_export"


class JobStatusEnum(str, enum.Enum):
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"
    canceled = "canceled"


class SyncOpTypeEnum(str, enum.Enum):
    upsert = "upsert"
    delete = "delete"


class SyncStatusEnum(str, enum.Enum):
    pending = "pending"
    applied = "applied"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, default="ES")
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    account_status: Mapped[AccountStatusEnum] = mapped_column(
        Enum(AccountStatusEnum, name="account_status_enum"), nullable=False, default=AccountStatusEnum.active
    )
    delete_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduled_delete_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    ai_settings: Mapped["UserAISettings"] = relationship(back_populates="user", uselist=False)
    api_keys: Mapped[list["APIProviderKey"]] = relationship(back_populates="user")


class UserAISettings(Base):
    __tablename__ = "user_ai_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    monthly_limit_eur: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    warn_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=80)
    hard_block_on_limit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    chat_rate_limit_per_min: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="ai_settings")


class APIProviderKey(Base):
    __tablename__ = "api_provider_keys"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_api_provider_keys_user_provider"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[AIProviderEnum] = mapped_column(Enum(AIProviderEnum, name="ai_provider_enum"), nullable=False)
    key_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    key_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="api_keys")


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        Index(
            "ux_goals_single_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[GoalDomainEnum] = mapped_column(Enum(GoalDomainEnum, name="goal_domain_enum"), nullable=False)
    target_value: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    target_unit: Mapped[str | None] = mapped_column(String(32), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkoutTemplate(Base):
    __tablename__ = "workout_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkoutTemplateExercise(Base):
    __tablename__ = "workout_template_exercises"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workout_template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_templates.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    exercise_name_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    muscle_group_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkoutTemplateSet(Base):
    __tablename__ = "workout_template_sets"
    __table_args__ = (
        CheckConstraint(
            "(reps_fixed IS NOT NULL AND reps_min IS NULL AND reps_max IS NULL) OR "
            "(reps_fixed IS NULL AND reps_min IS NOT NULL AND reps_max IS NOT NULL AND reps_min <= reps_max)",
            name="ck_workout_template_sets_reps_mode",
        ),
        CheckConstraint("rest_mmss ~ '^[0-5][0-9]:[0-5][0-9]$'", name="ck_workout_template_sets_rest_mmss"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_template_exercises.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reps_fixed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reps_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reps_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rest_mmss: Mapped[str] = mapped_column(String(5), nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_templates.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[WorkoutSessionStatusEnum] = mapped_column(
        Enum(WorkoutSessionStatusEnum, name="workout_session_status_enum"),
        nullable=False,
        default=WorkoutSessionStatusEnum.in_progress,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    applied_changes_to_template: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkoutSessionExercise(Base):
    __tablename__ = "workout_session_exercises"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workout_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False
    )
    source_template_exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_template_exercises.id", ondelete="SET NULL"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    exercise_name_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    muscle_group_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class WorkoutSessionSet(Base):
    __tablename__ = "workout_session_sets"
    __table_args__ = (
        CheckConstraint(
            "(reps_fixed IS NOT NULL AND reps_min IS NULL AND reps_max IS NULL) OR "
            "(reps_fixed IS NULL AND reps_min IS NOT NULL AND reps_max IS NOT NULL AND reps_min <= reps_max)",
            name="ck_workout_session_sets_reps_mode",
        ),
        CheckConstraint("rest_mmss ~ '^[0-5][0-9]:[0-5][0-9]$'", name="ck_workout_session_sets_rest_mmss"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_session_exercises.id", ondelete="CASCADE"), nullable=False
    )
    source_template_set_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workout_template_sets.id", ondelete="SET NULL"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reps_fixed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reps_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reps_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rest_mmss: Mapped[str] = mapped_column(String(5), nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    inherited_from_last_session: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class DietDay(Base):
    __tablename__ = "diet_days"
    __table_args__ = (UniqueConstraint("user_id", "day_date", name="uq_diet_days_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    day_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class DietMeal(Base):
    __tablename__ = "diet_meals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("diet_days.id", ondelete="CASCADE"), nullable=False)
    meal_type: Mapped[MealTypeEnum] = mapped_column(Enum(MealTypeEnum, name="meal_type_enum"), nullable=False)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class DietItem(Base):
    __tablename__ = "diet_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("diet_meals.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    grams: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    serving_count: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    calories_kcal: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    protein_g: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    carbs_g: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    fat_g: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    calories_protein_kcal: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    calories_carbs_kcal: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    calories_fat_kcal: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    created_by_ai: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class BodyMeasurement(Base):
    __tablename__ = "body_measurements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    weight_kg: Mapped[float | None] = mapped_column(Numeric(8, 3), nullable=True)
    circumferences_cm: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class MediaAsset(Base):
    __tablename__ = "media_assets"
    __table_args__ = (UniqueConstraint("storage_bucket", "storage_path", name="uq_media_assets_storage_path"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[MediaKindEnum] = mapped_column(Enum(MediaKindEnum, name="media_kind_enum"), nullable=False)
    status: Mapped[MediaStatusEnum] = mapped_column(
        Enum(MediaStatusEnum, name="media_status_enum"), nullable=False, default=MediaStatusEnum.uploaded
    )
    storage_bucket: Mapped[str] = mapped_column(Text, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retention_delete_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class DietItemEstimate(Base):
    __tablename__ = "diet_item_estimates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    diet_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diet_items.id", ondelete="SET NULL"), nullable=True
    )
    media_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[AIProviderEnum] = mapped_column(Enum(AIProviderEnum, name="ai_provider_enum"), nullable=False)
    confidence_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    estimate_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ExerciseMediaLink(Base):
    __tablename__ = "exercise_media_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    exercise_name: Mapped[str] = mapped_column(Text, nullable=False)
    machine_photo_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    generated_image_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    generated_video_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class BackgroundJob(Base):
    __tablename__ = "background_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[JobTypeEnum] = mapped_column(Enum(JobTypeEnum, name="job_type_enum"), nullable=False)
    status: Mapped[JobStatusEnum] = mapped_column(
        Enum(JobStatusEnum, name="job_status_enum"), nullable=False, default=JobStatusEnum.queued
    )
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    run_after: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ChatThread(Base):
    __tablename__ = "chat_threads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_threads.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[ChatRoleEnum] = mapped_column(Enum(ChatRoleEnum, name="chat_role_enum"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[AIProviderEnum | None] = mapped_column(
        Enum(AIProviderEnum, name="ai_provider_enum"), nullable=True
    )
    model: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    safety_flags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AgentMemoryEntry(Base):
    __tablename__ = "agent_memory_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    domain: Mapped[MemoryDomainEnum] = mapped_column(
        Enum(MemoryDomainEnum, name="memory_domain_enum"), nullable=False
    )
    memory_key: Mapped[str] = mapped_column(Text, nullable=False)
    memory_value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    source_chat_message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SyncOperation(Base):
    __tablename__ = "sync_operations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    device_id: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    op_type: Mapped[SyncOpTypeEnum] = mapped_column(Enum(SyncOpTypeEnum, name="sync_op_type_enum"), nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    client_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    server_received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    status: Mapped[SyncStatusEnum] = mapped_column(
        Enum(SyncStatusEnum, name="sync_status_enum"), nullable=False, default=SyncStatusEnum.pending
    )
    retries: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class DataExportRequest(Base):
    __tablename__ = "data_export_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, default="requested")
    export_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


Index("ix_api_provider_keys_user_id", APIProviderKey.user_id)
Index("ix_workout_templates_user_position", WorkoutTemplate.user_id, WorkoutTemplate.position)
Index(
    "ix_workout_template_exercises_template_position",
    WorkoutTemplateExercise.workout_template_id,
    WorkoutTemplateExercise.position,
)
Index("ix_workout_template_sets_exercise_position", WorkoutTemplateSet.template_exercise_id, WorkoutTemplateSet.position)
Index("ix_workout_sessions_user_started", WorkoutSession.user_id, WorkoutSession.started_at)
Index(
    "ix_workout_session_exercises_session_position",
    WorkoutSessionExercise.workout_session_id,
    WorkoutSessionExercise.position,
)
Index("ix_workout_session_sets_exercise_position", WorkoutSessionSet.session_exercise_id, WorkoutSessionSet.position)
Index("ix_diet_meals_day_position", DietMeal.day_id, DietMeal.position)
Index("ix_diet_items_meal_id", DietItem.meal_id)
Index("ix_body_measurements_user_measured_at", BodyMeasurement.user_id, BodyMeasurement.measured_at)
Index("ix_media_assets_user_kind", MediaAsset.user_id, MediaAsset.kind)
Index("ix_diet_item_estimates_item", DietItemEstimate.diet_item_id)
Index("ix_background_jobs_status_run_after", BackgroundJob.status, BackgroundJob.run_after)
Index("ix_chat_threads_user", ChatThread.user_id)
Index("ix_chat_messages_thread_created", ChatMessage.thread_id, ChatMessage.created_at)
Index(
    "ux_agent_memory_user_domain_key_active",
    AgentMemoryEntry.user_id,
    AgentMemoryEntry.domain,
    AgentMemoryEntry.memory_key,
    unique=True,
    postgresql_where=text("deleted_at is null"),
)
Index("ix_sync_ops_user_status_created", SyncOperation.user_id, SyncOperation.status, SyncOperation.created_at)
