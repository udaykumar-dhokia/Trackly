from __future__ import annotations

import json
import logging
from typing import Any

from redis import RedisError
from redis import asyncio as redis

from app.config import settings

logger = logging.getLogger(__name__)

LANDING_USERS_CACHE_KEY = "landing:global-users"
LANDING_FEEDBACK_CACHE_KEY = "landing:verified-feedback"

_redis_client: redis.Redis | None = None
_redis_disabled = False


def _build_redis_client() -> redis.Redis | None:
    if not settings.redis_host or not settings.redis_port:
        return None

    return redis.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        decode_responses=True,
        username=settings.redis_username,
        password=settings.redis_password,
    )


async def get_redis_client() -> redis.Redis | None:
    global _redis_client, _redis_disabled

    if _redis_disabled:
        return None

    if _redis_client is None:
        _redis_client = _build_redis_client()
        if _redis_client is None:
            _redis_disabled = True
            return None

    return _redis_client


async def get_cache_json(key: str) -> Any | None:
    client = await get_redis_client()
    if client is None:
        return None

    try:
        cached_value = await client.get(key)
    except RedisError:
        logger.exception("Redis GET failed for key %s", key)
        return None

    if cached_value is None:
        return None

    try:
        return json.loads(cached_value)
    except json.JSONDecodeError:
        logger.warning("Invalid cached JSON for key %s; evicting.", key)
        await delete_cache_key(key)
        return None


async def set_cache_json(key: str, value: Any, ttl_seconds: int) -> None:
    client = await get_redis_client()
    if client is None:
        return

    try:
        await client.set(key, json.dumps(value), ex=ttl_seconds)
    except (RedisError, TypeError, ValueError):
        logger.exception("Redis SET failed for key %s", key)


async def delete_cache_key(key: str) -> None:
    client = await get_redis_client()
    if client is None:
        return

    try:
        await client.delete(key)
    except RedisError:
        logger.exception("Redis DELETE failed for key %s", key)


async def close_redis_client() -> None:
    global _redis_client

    if _redis_client is None:
        return

    try:
        await _redis_client.aclose()
    except RedisError:
        logger.exception("Redis close failed.")
    finally:
        _redis_client = None
