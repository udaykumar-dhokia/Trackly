from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ingest, stats, organizations, api_keys, events, users
from app.services.rate_limit import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.session import engine, init_db
    await init_db()
    yield
    await engine.dispose()


app = FastAPI(
    title="Trackly API",
    version="0.1.2",
    description="AI usage tracking — ingest, query, and manage LLM cost data.",
    lifespan=lifespan,
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://192.168.1.44:3000",
        "https://trytrackly.vercel.app",
    ],
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
