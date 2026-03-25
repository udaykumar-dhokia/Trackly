from pydantic_settings import BaseSettings, SettingsConfigDict
import os

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

    max_batch_size: int = 100


settings = Settings()
