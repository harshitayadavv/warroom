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
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    if not cleaned:
        match = re.search(r'<think>(.*?)</think>', text, flags=re.DOTALL)
        if match:
            inner = match.group(1).strip()
            for marker in ['answer:', 'response:', 'argument:', 'reply:']:
                idx = inner.lower().find(marker)
                if idx != -1:
                    return inner[idx + len(marker):].strip()
            return inner
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
