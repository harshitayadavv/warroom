# LOCATION: backend/services/redis_client.py
# Redis for ephemeral debate state caching between WS events
# Falls back gracefully if Redis is not running

import os, json, logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

_redis = None

async def get_redis():
    global _redis
    if _redis is None:
        try:
            import aioredis
            _redis = await aioredis.from_url(
                os.environ.get("REDIS_URL", "redis://localhost:6379"),
                encoding="utf-8",
                decode_responses=True,
            )
            await _redis.ping()
            logger.info("[Redis] Connected")
        except Exception as e:
            logger.warning(f"[Redis] Not available — running without cache: {e}")
            _redis = FallbackCache()
    return _redis


async def set_debate_state(debate_id: str, state: dict, ttl: int = 86400):
    r = await get_redis()
    await r.set(f"debate:{debate_id}:state", json.dumps(state), ex=ttl)

async def get_debate_state(debate_id: str) -> Optional[dict]:
    r = await get_redis()
    raw = await r.get(f"debate:{debate_id}:state")
    return json.loads(raw) if raw else None

async def delete_debate_state(debate_id: str):
    r = await get_redis()
    await r.delete(f"debate:{debate_id}:state")

async def set_pause_flag(debate_id: str):
    r = await get_redis()
    await r.set(f"debate:{debate_id}:paused", "1", ex=3600)

async def clear_pause_flag(debate_id: str):
    r = await get_redis()
    await r.delete(f"debate:{debate_id}:paused")

async def is_paused(debate_id: str) -> bool:
    r = await get_redis()
    return bool(await r.get(f"debate:{debate_id}:paused"))

async def set_interrupt(debate_id: str, interrupt_data: dict):
    r = await get_redis()
    await r.set(f"debate:{debate_id}:interrupt", json.dumps(interrupt_data), ex=3600)

async def get_interrupt(debate_id: str) -> Optional[dict]:
    r = await get_redis()
    raw = await r.get(f"debate:{debate_id}:interrupt")
    return json.loads(raw) if raw else None

async def clear_interrupt(debate_id: str):
    r = await get_redis()
    await r.delete(f"debate:{debate_id}:interrupt")

async def add_approval_request(debate_id: str, request: dict):
    r = await get_redis()
    await r.rpush(f"debate:{debate_id}:approvals", json.dumps(request))
    await r.expire(f"debate:{debate_id}:approvals", 3600)

async def get_approval_response(debate_id: str, request_id: str, timeout: int = 60) -> Optional[dict]:
    """Block-wait for a human approval response."""
    r = await get_redis()
    key = f"debate:{debate_id}:approval_response:{request_id}"
    # Poll every 0.5s up to timeout
    import asyncio
    for _ in range(timeout * 2):
        raw = await r.get(key)
        if raw:
            await r.delete(key)
            return json.loads(raw)
        await asyncio.sleep(0.5)
    return None  # timed out — treat as rejected

async def set_approval_response(debate_id: str, request_id: str, response: dict):
    r = await get_redis()
    await r.set(
        f"debate:{debate_id}:approval_response:{request_id}",
        json.dumps(response),
        ex=120,
    )


class FallbackCache:
    """In-memory fallback when Redis is unavailable."""
    def __init__(self):
        self._store: dict[str, Any] = {}

    async def set(self, key: str, value: str, ex: int = 3600):
        self._store[key] = value

    async def get(self, key: str) -> Optional[str]:
        return self._store.get(key)

    async def delete(self, key: str):
        self._store.pop(key, None)

    async def rpush(self, key: str, value: str):
        if key not in self._store:
            self._store[key] = []
        self._store[key].append(value)

    async def expire(self, key: str, seconds: int):
        pass  # no-op in fallback

    async def ping(self):
        return True