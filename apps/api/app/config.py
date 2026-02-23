import base64
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Gymnasia API"
    env: str = "development"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/gymnasia"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30
    app_encryption_key: str = Field(default="Gb4rgMXQBYQ94SQ8kuk6uwGhOrkeJpX6FdQ3Df7osbo=")
    internal_admin_token: str = "change-admin-token"
    auto_create_tables: bool = True
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:19006,http://127.0.0.1:19006,http://localhost:8081,http://127.0.0.1:8081"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("app_encryption_key")
    @classmethod
    def validate_encryption_key(cls, value: str) -> str:
        try:
            decoded = base64.urlsafe_b64decode(value.encode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            raise ValueError("APP_ENCRYPTION_KEY must be urlsafe base64-encoded.") from exc

        if len(decoded) != 32:
            raise ValueError("APP_ENCRYPTION_KEY must decode to 32 bytes.")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
