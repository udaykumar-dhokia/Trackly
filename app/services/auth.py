from __future__ import annotations

import hashlib
import os
import secrets
import uuid
from datetime import datetime, timezone

import bcrypt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import ApiKey


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.

    Returns:
        (raw_key, key_hash, key_prefix)

    raw_key   — returned to the user once, never stored.
    key_hash  — bcrypt hash stored in the DB.
    key_prefix — first 12 chars, stored and shown in dashboard.

    Format: tk_live_<32 random hex chars>
    Example: tk_live_a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5
    """
    random_part = secrets.token_hex(16)
    raw_key = f"tk_live_{random_part}"
    key_prefix = raw_key[:12]

    hashed = bcrypt.hashpw(raw_key.encode(), bcrypt.gensalt(rounds=12))
    key_hash = hashed.decode()

    return raw_key, key_hash, key_prefix


def verify_api_key(raw_key: str, key_hash: str) -> bool:
    """Constant-time comparison against stored bcrypt hash."""
    try:
        return bcrypt.checkpw(raw_key.encode(), key_hash.encode())
    except Exception:
        return False


async def get_key_by_prefix(session: AsyncSession, raw_key: str) -> ApiKey | None:
    """
    Look up an API key by prefix, then verify the full hash.
    Two-step: prefix narrows the DB query, bcrypt verify confirms.
    Avoids full-table scan while keeping the hash secret.
    """
    if not raw_key.startswith("tk_live_") or len(raw_key) < 12:
        return None

    prefix = raw_key[:12]

    stmt = (
        select(ApiKey)
        .where(ApiKey.key_prefix == prefix, ApiKey.is_active == True)
    )
    result = await session.execute(stmt)
    candidates = result.scalars().all()

    for key in candidates:
        if verify_api_key(raw_key, key.key_hash):
            return key

    return None


async def authenticate(
    session: AsyncSession,
    authorization_header: str | None,
) -> ApiKey | None:
    """
    Parse "Bearer tk_live_..." header, look up and verify the key.
    Updates last_used_at on success.
    Returns None if invalid or missing.
    """
    if not authorization_header:
        return None

    parts = authorization_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    raw_key = parts[1].strip()
    api_key = await get_key_by_prefix(session, raw_key)

    if api_key:
        await session.execute(
            update(ApiKey)
            .where(ApiKey.id == api_key.id)
            .values(last_used_at=datetime.now(timezone.utc))
        )

    return api_key
