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
    """Remove <think>...</think> blocks from reasoning model output."""
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    # If stripping think tags leaves nothing, return the content inside think tags
    if not cleaned:
        match = re.search(r'<think>(.*?)</think>', text, flags=re.DOTALL)
        if match:
            return match.group(1).strip()
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
    """
    Stream tokens, suppressing <think> blocks entirely.
    Tokens inside <think>...</think> are buffered and discarded.
    Tokens outside are yielded immediately to the frontend.
    """
    stream = await get_client().chat.completions.create(
        model       = model,
        messages    = messages,
        temperature = temperature,
        max_tokens  = max_tokens,
        stream      = True,
    )

    in_think  = False
    buf       = ""

    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if not delta:
            continue

        buf += delta

        # Process buffer character by character to handle tags split across chunks
        while buf:
            if in_think:
                end = buf.find('</think>')
                if end != -1:
                    # Found closing tag — exit think mode, discard up to and including tag
                    buf      = buf[end + len('</think>'):]
                    in_think = False
                else:
                    # Still inside think block — discard entire buffer and wait for more
                    buf = ""
                    break
            else:
                start_idx = buf.find('<think>')
                if start_idx != -1:
                    # Yield everything before the think tag
                    before = buf[:start_idx]
                    if before:
                        yield before
                    buf      = buf[start_idx + len('<think>'):]
                    in_think = True
                else:
                    # No think tag — check if buffer might be a partial tag
                    # Keep last 8 chars in buffer in case tag is split across chunks
                    if len(buf) > 8:
                        yield buf[:-8]
                        buf = buf[-8:]
                    break

    # Yield any remaining buffer content
    if buf and not in_think:
        yield buf


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