from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ingest, stats, organizations, api_keys, events, users, feedback, admin, emails
from app.services.rate_limit import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.session import engine, init_db
    from app.services.cache import close_redis_client
    await init_db()
    yield
    await close_redis_client()
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
        "https://tracklyai.in",
        "https://www.tracklyai.in"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefixes = []
for prefix in (settings.api_prefix, "/v1"):
    if prefix not in api_prefixes:
        api_prefixes.append(prefix)

for prefix in api_prefixes:
    app.include_router(ingest.router,        prefix=prefix, tags=["ingest"])
    app.include_router(stats.router,         prefix=prefix, tags=["stats"])
    app.include_router(organizations.router, prefix=prefix, tags=["organizations"])
    app.include_router(api_keys.router,      prefix=prefix, tags=["api-keys"])
    app.include_router(events.router,        prefix=prefix, tags=["events"])
    app.include_router(users.router,         prefix=prefix, tags=["users"])
    app.include_router(feedback.router,      prefix=prefix, tags=["feedback"])
    app.include_router(admin.router,         prefix=prefix, tags=["admin"])
    app.include_router(emails.router,        prefix=prefix, tags=["emails"])


@app.get("/health", tags=["ops"])
async def health() -> dict:
    return {"status": "ok"}
