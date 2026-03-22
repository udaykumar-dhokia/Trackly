from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ingest, stats, organizations, api_keys, events, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.session import engine, init_db
    await init_db()
    yield
    await engine.dispose()


app = FastAPI(
    title="Trackly API",
    version="0.1.0",
    description="AI usage tracking — ingest, query, and manage LLM cost data.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router,        prefix=settings.api_prefix, tags=["ingest"])
app.include_router(stats.router,         prefix=settings.api_prefix, tags=["stats"])
app.include_router(organizations.router, prefix=settings.api_prefix, tags=["organizations"])
app.include_router(api_keys.router,      prefix=settings.api_prefix, tags=["api-keys"])
app.include_router(events.router,        prefix=settings.api_prefix, tags=["events"])
app.include_router(users.router,         prefix=settings.api_prefix, tags=["users"])


@app.get("/health", tags=["ops"])
async def health() -> dict:
    return {"status": "ok"}
