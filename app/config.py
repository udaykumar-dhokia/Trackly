import os

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    database_url: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:1234@localhost:5432/trackly")

    api_prefix: str = "/api/v1"
    debug: bool = False
    admin_api_token: str | None = os.getenv("ADMIN_API_TOKEN")
    resend_api_key: str | None = os.getenv("RESEND_API_KEY")
    resend_from_email: str = os.getenv("RESEND_FROM_EMAIL", "Trackly <onboarding@resend.dev>")
    resend_audience_id: str | None = os.getenv("RESEND_AUDIENCE_ID")
    app_base_url: str = os.getenv("APP_BASE_URL", "https://tracklyai.in")
    support_email: str = os.getenv("SUPPORT_EMAIL", "support@tracklyai.in")

    max_batch_size: int = 100

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if value is None:
            return False

        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "yes", "on", "debug"}:
            return True
        if normalized in {"0", "false", "no", "off", "release", "prod", "production", ""}:
            return False
        return False


settings = Settings()
