from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Creates database tables if they do not exist."""
    async with engine.begin() as conn:
        from app.models import orm
        await conn.run_sync(Base.metadata.create_all)
        await _apply_schema_backfills(conn)

    async with AsyncSessionLocal() as session:
        try:
            from app.services.pricing_catalog import sync_pricing_catalog

            await sync_pricing_catalog(session)
            await session.commit()
        except Exception:
            await session.rollback()


async def _apply_schema_backfills(conn) -> None:
    await conn.execute(
        text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT")
    )
    await conn.execute(
        text("ALTER TABLE traces ADD COLUMN IF NOT EXISTS insights JSONB")
    )
