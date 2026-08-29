from __future__ import annotations
import os, time, logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)
_client = None

def get_client():
    global _client
    if _client is None:
        from groq import AsyncGroq
        key = os.environ.get("GROQ_API_KEY", "")
        if not key:
            raise RuntimeError("GROQ_API_KEY not set in backend/.env")
        _client = AsyncGroq(api_key=key)
    return _client

AGENT_MODELS = {
    "proponent":    "llama-3.3-70b-versatile",
    "opponent":     "llama-3.3-70b-versatile",
    "fact_checker": "llama-3.1-8b-instant",
    "moderator":    "llama-3.3-70b-versatile",
    "judge":        "llama-3.3-70b-versatile",
}

async def chat(
    messages:    list[dict],
    model:       str   = "llama-3.3-70b-versatile",
    temperature: float = 0.7,
    max_tokens:  int   = 1024,
    stop:        list[str] | None = None,
) -> tuple[str, dict]:
    start    = time.time()
    response = await get_client().chat.completions.create(
        model=model, messages=messages,
        temperature=temperature, max_tokens=max_tokens, stop=stop,
    )
    latency_ms = int((time.time() - start) * 1000)
    content    = response.choices[0].message.content or ""
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
    model:       str   = "llama-3.3-70b-versatile",
    temperature: float = 0.7,
    max_tokens:  int   = 1024,
) -> AsyncGenerator[str, None]:
    stream = await get_client().chat.completions.create(
        model=model, messages=messages,
        temperature=temperature, max_tokens=max_tokens, stream=True,
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