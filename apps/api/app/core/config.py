from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Gymnasia API"
    environment: str = "development"
    debug: bool = True
    api_prefix: str = "/api/v1"

    database_url: str = Field(default="postgresql+asyncpg://postgres:postgres@localhost:5432/gymnasia")

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""

    default_llm_provider: str = "openai"
    default_llm_model: str = "gpt-4.1-mini"
    audio_transcription_model: str = "whisper-1"

    media_retention_days: int = 180
    default_dev_user_id: str = "00000000-0000-0000-0000-000000000001"
    auto_create_tables: bool = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
