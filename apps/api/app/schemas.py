from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models import (
    AIProviderEnum,
    ChatRoleEnum,
    GoalDomainEnum,
    JobStatusEnum,
    JobTypeEnum,
    MealTypeEnum,
    MediaKindEnum,
    MediaStatusEnum,
    MemoryDomainEnum,
    SyncOpTypeEnum,
    SyncStatusEnum,
    WorkoutSessionStatusEnum,
)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    birth_date: date


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyEmailRequest(BaseModel):
    token: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    email_verified_at: datetime | None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AIKeyUpsertRequest(BaseModel):
    provider: AIProviderEnum
    api_key: str = Field(min_length=10)


class AIKeyPatchRequest(BaseModel):
    api_key: str = Field(min_length=10)


class AIKeyResponse(BaseModel):
    provider: AIProviderEnum
    key_fingerprint: str
    is_active: bool
    last_tested_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AIKeyTestRequest(BaseModel):
    provider: AIProviderEnum


class AIKeyTestResponse(BaseModel):
    provider: AIProviderEnum
    success: bool
    tested_at: datetime
    message: str


class GoalUpsertRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    domain: GoalDomainEnum
    target_value: float | None = None
    target_unit: str | None = Field(default=None, max_length=32)
    start_date: date = Field(default_factory=date.today)
    end_date: date | None = None
    notes: str | None = None


class GoalResponse(BaseModel):
    id: str
    title: str
    domain: GoalDomainEnum
    target_value: float | None
    target_unit: str | None
    start_date: date
    end_date: date | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class WorkoutSetPayload(BaseModel):
    reps_fixed: int | None = Field(default=None, ge=1)
    reps_min: int | None = Field(default=None, ge=1)
    reps_max: int | None = Field(default=None, ge=1)
    rest_mmss: str = Field(pattern=r"^[0-5][0-9]:[0-5][0-9]$")
    weight_kg: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_reps_mode(self) -> "WorkoutSetPayload":
        fixed = self.reps_fixed is not None
        range_mode = self.reps_min is not None and self.reps_max is not None

        if fixed == range_mode:
            raise ValueError("Use reps_fixed OR reps_min/reps_max")

        if range_mode and self.reps_min and self.reps_max and self.reps_min > self.reps_max:
            raise ValueError("reps_min cannot be greater than reps_max")
        return self


class WorkoutSetResponse(WorkoutSetPayload):
    id: str
    position: int
    inherited_from_last_session: bool | None = None
    completed_at: datetime | None = None


class WorkoutExercisePayload(BaseModel):
    exercise_name_snapshot: str = Field(min_length=1, max_length=200)
    muscle_group_snapshot: str | None = Field(default=None, max_length=120)
    notes: str | None = None
    sets: list[WorkoutSetPayload] = Field(default_factory=list)


class WorkoutExerciseResponse(BaseModel):
    id: str
    position: int
    exercise_name_snapshot: str
    muscle_group_snapshot: str | None
    notes: str | None
    sets: list[WorkoutSetResponse]


class WorkoutTemplateCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    notes: str | None = None
    exercises: list[WorkoutExercisePayload] = Field(default_factory=list)


class WorkoutTemplatePatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = None
    is_archived: bool | None = None
    exercises: list[WorkoutExercisePayload] | None = None


class WorkoutTemplateCloneRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)


class WorkoutTemplateReorderRequest(BaseModel):
    template_ids: list[str] = Field(min_length=1)


class WorkoutExerciseReorderRequest(BaseModel):
    exercise_ids: list[str] = Field(min_length=1)


class WorkoutSetReorderRequest(BaseModel):
    set_ids: list[str] = Field(min_length=1)


class WorkoutTemplateResponse(BaseModel):
    id: str
    name: str
    notes: str | None
    position: int
    is_archived: bool
    exercises: list[WorkoutExerciseResponse]
    created_at: datetime
    updated_at: datetime


class WorkoutSessionPatchRequest(BaseModel):
    notes: str | None = None
    exercises: list[WorkoutExercisePayload] | None = None


class WorkoutSessionFinishRequest(BaseModel):
    notes: str | None = None


class WorkoutSessionApplyTemplateUpdatesRequest(BaseModel):
    confirm: bool = True


class WorkoutSessionResponse(BaseModel):
    id: str
    template_id: str | None
    status: WorkoutSessionStatusEnum
    started_at: datetime
    ended_at: datetime | None
    notes: str | None
    applied_changes_to_template: bool
    exercises: list[WorkoutExerciseResponse]


class DietItemPayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    grams: float | None = Field(default=None, ge=0)
    serving_count: float | None = Field(default=None, ge=0)
    calories_kcal: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    calories_protein_kcal: float | None = None
    calories_carbs_kcal: float | None = None
    calories_fat_kcal: float | None = None


class DietItemResponse(DietItemPayload):
    id: str
    created_by_ai: bool


class DietMealPayload(BaseModel):
    meal_type: MealTypeEnum
    title: str | None = Field(default=None, max_length=120)
    items: list[DietItemPayload] = Field(default_factory=list)


class DietMealResponse(BaseModel):
    id: str
    meal_type: MealTypeEnum
    title: str | None
    position: int
    items: list[DietItemResponse]


class DietDayUpsertRequest(BaseModel):
    notes: str | None = None
    meals: list[DietMealPayload] = Field(default_factory=list)


class DietDayResponse(BaseModel):
    id: str
    day_date: date
    notes: str | None
    meals: list[DietMealResponse]


class BodyMeasurementCreateRequest(BaseModel):
    measured_at: datetime | None = None
    weight_kg: float | None = Field(default=None, ge=0)
    circumferences_cm: dict[str, float] = Field(default_factory=dict)
    notes: str | None = None
    photo_asset_id: str | None = None


class BodyMeasurementPatchRequest(BaseModel):
    measured_at: datetime | None = None
    weight_kg: float | None = Field(default=None, ge=0)
    circumferences_cm: dict[str, float] | None = None
    notes: str | None = None
    photo_asset_id: str | None = None


class BodyMeasurementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    measured_at: datetime
    weight_kg: float | None
    circumferences_cm: dict[str, float]
    notes: str | None
    photo_asset_id: str | None
    created_at: datetime
    updated_at: datetime


class MediaUploadIntentRequest(BaseModel):
    kind: MediaKindEnum
    mime_type: str | None = None
    size_bytes: int | None = Field(default=None, ge=1)
    file_name: str | None = None
    bucket: str = Field(default="gymnasia-media", min_length=1, max_length=120)


class MediaAssetResponse(BaseModel):
    id: str
    kind: MediaKindEnum
    status: MediaStatusEnum
    storage_bucket: str
    storage_path: str
    mime_type: str | None
    size_bytes: int | None
    retention_delete_at: datetime | None
    created_at: datetime
    updated_at: datetime


class MediaUploadIntentResponse(BaseModel):
    asset: MediaAssetResponse
    upload_url: str
    signed_read_url: str


class MediaSignedUrlResponse(BaseModel):
    asset_id: str
    signed_url: str
    expires_in_seconds: int


class DietPhotoEstimateRequest(BaseModel):
    asset_id: str
    day_date: date = Field(default_factory=date.today)
    meal_type: MealTypeEnum = MealTypeEnum.lunch
    item_name_override: str | None = None


class DietPhotoEstimateResponse(BaseModel):
    provider: AIProviderEnum
    confidence_percent: float
    meal_type: MealTypeEnum
    day_date: date
    item: DietItemResponse


class ExerciseMediaLinkCreateRequest(BaseModel):
    exercise_name: str = Field(min_length=1, max_length=200)
    machine_photo_asset_id: str | None = None


class ExerciseMediaLinkResponse(BaseModel):
    id: str
    exercise_name: str
    machine_photo_asset_id: str | None
    generated_image_asset_id: str | None
    generated_video_asset_id: str | None
    created_at: datetime
    updated_at: datetime


class ExerciseMediaGenerateRequest(BaseModel):
    prompt: str | None = Field(default=None, max_length=1200)


class BackgroundJobResponse(BaseModel):
    id: str
    type: JobTypeEnum
    status: JobStatusEnum
    payload: dict
    result: dict | None
    attempts: int
    max_attempts: int
    run_after: datetime
    last_error: str | None
    created_at: datetime
    updated_at: datetime


class ChatThreadCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=240)


class ChatThreadResponse(BaseModel):
    id: str
    title: str | None
    message_count: int
    last_message_preview: str | None
    last_activity_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ChatMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=6000)


class ChatMessageResponse(BaseModel):
    id: str
    thread_id: str
    role: ChatRoleEnum
    content: str
    provider: AIProviderEnum | None
    model: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    safety_flags: dict | None
    created_at: datetime


class AgentMemoryUpsertRequest(BaseModel):
    value: dict


class AgentMemoryResponse(BaseModel):
    id: str
    domain: MemoryDomainEnum
    memory_key: str
    memory_value: dict
    source_chat_message_id: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class SyncOperationInput(BaseModel):
    entity_type: str = Field(min_length=1, max_length=120)
    entity_id: str | None = None
    op_type: SyncOpTypeEnum
    payload: dict | None = None
    client_updated_at: datetime


class SyncBulkUpsertRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=180)
    operations: list[SyncOperationInput] = Field(default_factory=list)


class SyncOperationResponse(BaseModel):
    id: str
    device_id: str
    entity_type: str
    entity_id: str | None
    op_type: SyncOpTypeEnum
    payload: dict | None
    client_updated_at: datetime
    server_received_at: datetime
    status: SyncStatusEnum
    retries: int
    last_error: str | None
    created_at: datetime
    updated_at: datetime


class DataExportRequestResponse(BaseModel):
    id: str
    status: str
    export_path: str | None
    requested_at: datetime
    fulfilled_at: datetime | None
    expires_at: datetime | None


class AccountDeleteRequest(BaseModel):
    grace_days: int = Field(default=30, ge=1, le=60)


class AccountStatusResponse(BaseModel):
    user_id: str
    account_status: str
    delete_requested_at: datetime | None
    scheduled_delete_at: datetime | None
