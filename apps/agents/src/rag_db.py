"""Postgres client for the agents service.

Connects as the `axon_app` role (DATABASE_URL_APP) so RLS policies apply.
Every query that touches tenant-scoped tables must run inside
`org_scope(org_id, conn)` which sets `app.current_org_id` for that txn.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from functools import lru_cache
from urllib.parse import urlparse

import asyncpg


def _pool_url() -> str:
    url = os.environ.get("DATABASE_URL_APP") or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "neither DATABASE_URL_APP nor DATABASE_URL is set; cannot run RAG queries",
        )
    # asyncpg rejects the postgresql+driver:// style; strip the +driver part.
    parsed = urlparse(url)
    scheme = parsed.scheme.split("+")[0]
    return parsed._replace(scheme=scheme).geturl()


_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            _pool_url(), min_size=1, max_size=5, command_timeout=30
        )
    return _pool


@lru_cache(maxsize=1)
def _is_valid_uuid_pattern() -> str:
    return r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"


@asynccontextmanager
async def org_scope(org_id: str):
    """Yield an asyncpg connection inside a transaction that has
    `app.current_org_id` set. RLS policies resolve to this GUC."""
    import re

    if not re.match(_is_valid_uuid_pattern(), org_id.lower()):
        raise ValueError("org_id must be a UUID")
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("SELECT set_config('app.current_org_id', $1, true)", org_id)
            yield conn
