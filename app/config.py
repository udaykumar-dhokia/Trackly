from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # database_url: str = "postgresql+asyncpg://postgres:1234@localhost:5432/trackly"
    database_url: str = "postgresql+asyncpg://neondb_owner:npg_GMDmZ2aS3YFR@ep-super-waterfall-amq6sf25-pooler.c-5.us-east-1.aws.neon.tech/neondb"

    api_prefix: str = "/v1"
    debug: bool = False

    max_batch_size: int = 100


settings = Settings()
