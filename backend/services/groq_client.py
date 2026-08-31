# LOCATION: backend/services/groq_client.py

from __future__ import annotations
import os, re, time, logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)
_client = None

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
            raise RuntimeError("GROQ_API_KEY not set")
        _client = AsyncGroq(api_key=key)
    return _client


def _strip_think(text: str) -> str:
    # Handle both closed <think>...</think> and unclosed <think>... 
    # Remove closed think blocks first
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    # Remove any remaining unclosed <think> block (everything after <think>)
    cleaned = re.sub(r'<think>.*', '', cleaned, flags=re.DOTALL).strip()
    # If nothing left, extract content after </think> as fallback
    if not cleaned:
        after_close = text.split('</think>')
        if len(after_close) > 1:
            cleaned = after_close[-1].strip()
    if not cleaned:
        # Last resort: strip everything up to and including last </think>
        parts = text.rsplit('</think>', 1)
        if len(parts) > 1:
            cleaned = parts[1].strip()
    return cleaned


async def chat(
    messages:    list[dict],
    model:       str   = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens:  int   = 1024,
    stop:        list[str] | None = None,
) -> tuple[str, dict]:
    start    = time.time()
    response = await get_client().chat.completions.create(
        model       = model,
        messages    = messages,
        temperature = temperature,
        max_tokens  = max_tokens,
        stop        = stop,
    )
    latency_ms = int((time.time() - start) * 1000)
    raw        = response.choices[0].message.content or ""
    content    = _strip_think(raw)
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
    # Collect full response first, strip think tags, then re-yield in chunks
    stream = await get_client().chat.completions.create(
        model       = model,
        messages    = messages,
        temperature = temperature,
        max_tokens  = max_tokens,
        stream      = True,
    )

    full = ""
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            full += delta

    clean = _strip_think(full)
    if not clean:
        clean = "[Agent produced no response]"

    # Re-yield in 15-char chunks for typing effect
    chunk_size = 15
    for i in range(0, len(clean), chunk_size):
        yield clean[i:i + chunk_size]


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
# v2-buffer-strip
