# LOCATION: backend/services/groq_client.py

from __future__ import annotations
import os, time, logging, asyncio
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.5-flash"

AGENT_MODELS = {
    "proponent":    DEFAULT_MODEL,
    "opponent":     DEFAULT_MODEL,
    "fact_checker": DEFAULT_MODEL,
    "moderator":    DEFAULT_MODEL,
    "judge":        DEFAULT_MODEL,
}

_api_key: str | None = None


def get_api_key() -> str:
    global _api_key
    if _api_key is None:
        _api_key = os.environ.get("GEMINI_API_KEY", "")
        if not _api_key:
            raise RuntimeError("GEMINI_API_KEY not set in environment")
    return _api_key


async def chat(
    messages:    list[dict],
    model:       str   = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens:  int   = 1024,
    stop:        list[str] | None = None,
) -> tuple[str, dict]:
    """Call Gemini via simple HTTP request — no SDK needed."""
    import httpx

    api_key = get_api_key()
    start   = time.time()

    # Build prompt from messages
    system_parts = [m["content"] for m in messages if m["role"] == "system"]
    user_parts   = [m["content"] for m in messages if m["role"] != "system"]

    system_text = "\n\n".join(system_parts)
    user_text   = "\n\n".join(user_parts)

    # Combine system + user into single prompt for simplicity
    full_prompt = f"{system_text}\n\n{user_text}".strip() if system_text else user_text

    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": full_prompt}]}
        ],
        "generationConfig": {
            "temperature":     temperature,
            "maxOutputTokens": max_tokens,
        }
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    def _call():
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()

    loop   = asyncio.get_event_loop()
    data   = await loop.run_in_executor(None, _call)

    latency_ms = int((time.time() - start) * 1000)

    try:
        content = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        content = ""
        logger.warning(f"[Gemini] Unexpected response: {data}")

    usage_meta = data.get("usageMetadata", {})
    usage = {
        "prompt_tokens":     usage_meta.get("promptTokenCount",     0),
        "completion_tokens": usage_meta.get("candidatesTokenCount", 0),
        "total_tokens":      usage_meta.get("totalTokenCount",      0),
        "latency_ms":        latency_ms,
    }
    logger.info(f"[Gemini] {model} | {usage['total_tokens']} tok | {latency_ms}ms")
    return content, usage


async def chat_stream(
    messages:    list[dict],
    model:       str   = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens:  int   = 1024,
) -> AsyncGenerator[str, None]:
    """Get full response then yield in chunks for typing effect."""
    content, _ = await chat(
        messages    = messages,
        model       = model,
        temperature = temperature,
        max_tokens  = max_tokens,
    )

    if not content:
        content = "[Agent produced no response]"

    chunk_size = 20
    for i in range(0, len(content), chunk_size):
        yield content[i:i + chunk_size]


async def embed_text(text: str) -> list[float]:
    try:
        from sentence_transformers import SentenceTransformer
        import functools
        if not hasattr(embed_text, "_model"):
            embed_text._model = SentenceTransformer("all-MiniLM-L6-v2")
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, functools.partial(embed_text._model.encode, text, convert_to_list=True)
        )
    except ImportError:
        return [0.0] * 384