# LOCATION: backend/services/groq_client.py

from __future__ import annotations
import os, re, time, logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)
_client = None

# ── Single model for everything ───────────────────────────────────────────────
# qwen/qwen3.6-27b with reasoning_effort="none" completely disables <think> tags.
# This is documented by Groq — the qwen3 family is the only one that supports
# fully disabling reasoning. gpt-oss-120b cannot disable thinking at all.
DEFAULT_MODEL = "qwen/qwen3.6-27b"

AGENT_MODELS = {
    "proponent":    DEFAULT_MODEL,
    "opponent":     DEFAULT_MODEL,
    "fact_checker": DEFAULT_MODEL,
    "moderator":    DEFAULT_MODEL,
    "judge":        DEFAULT_MODEL,
}


def get_client():
    global _client
    if _client is None:
        from groq import AsyncGroq
        key = os.environ.get("GROQ_API_KEY", "")
        if not key:
            raise RuntimeError("GROQ_API_KEY not set in backend/.env")
        _client = AsyncGroq(api_key=key)
    return _client


def _strip_think(text: str) -> str:
    """Remove <think>...</think> blocks. Safety net in case reasoning_effort=none
    doesn't fully suppress them on some requests."""
    return re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()


async def chat(
    messages:         list[dict],
    model:            str   = DEFAULT_MODEL,
    temperature:      float = 0.7,
    max_tokens:       int   = 1024,
    stop:             list[str] | None = None,
) -> tuple[str, dict]:
    start    = time.time()
    response = await get_client().chat.completions.create(
        model            = model,
        messages         = messages,
        temperature      = temperature,
        max_tokens       = max_tokens,
        stop             = stop,
        reasoning_effort = "none",   # disables <think> for qwen3 family
    )
    latency_ms = int((time.time() - start) * 1000)
    content    = _strip_think(response.choices[0].message.content or "")
    usage      = {
        "prompt_tokens":     response.usage.prompt_tokens,
        "completion_tokens": response.usage.completion_tokens,
        "total_tokens":      response.usage.total_tokens,
        "latency_ms":        latency_ms,
    }
    logger.info(f"[Groq] {model} | {usage['total_tokens']} tok | {latency_ms}ms")
    return content, usage


async def chat_stream(
    messages:    list[dict],
    model:       str   = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens:  int   = 1024,
) -> AsyncGenerator[str, None]:
    stream = await get_client().chat.completions.create(
        model            = model,
        messages         = messages,
        temperature      = temperature,
        max_tokens       = max_tokens,
        stream           = True,
        reasoning_effort = "none",   # disables <think> for qwen3 family
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


async def embed_text(text: str) -> list[float]:
    try:
        from sentence_transformers import SentenceTransformer
        import asyncio, functools
        if not hasattr(embed_text, "_model"):
            embed_text._model = SentenceTransformer("all-MiniLM-L6-v2")
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, functools.partial(embed_text._model.encode, text, convert_to_list=True)
        )
    except ImportError:
        return [0.0] * 384