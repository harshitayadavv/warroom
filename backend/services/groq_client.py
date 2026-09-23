# LOCATION: backend/services/groq_client.py
# Uses google-genai (new SDK) instead of deprecated google-generativeai

from __future__ import annotations
import os, time, logging, asyncio
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.5-flash-lite"

AGENT_MODELS = {
    "proponent":    DEFAULT_MODEL,
    "opponent":     DEFAULT_MODEL,
    "fact_checker": DEFAULT_MODEL,
    "moderator":    DEFAULT_MODEL,
    "judge":        DEFAULT_MODEL,
}

_client = None

def get_client():
    global _client
    if _client is None:
        from google import genai
        key = os.environ.get("GEMINI_API_KEY", "")
        if not key:
            raise RuntimeError("GEMINI_API_KEY not set in environment")
        _client = genai.Client(api_key=key)
    return _client


def _build_contents(messages: list[dict]) -> tuple[str, list]:
    """Convert OpenAI-format messages to google-genai format.
    Returns (system_instruction, contents_list)
    """
    from google.genai import types

    system_instruction = ""
    contents = []

    for msg in messages:
        role    = msg["role"]
        content = msg["content"]
        if role == "system":
            system_instruction = content
        elif role == "user":
            contents.append(types.Content(
                role  = "user",
                parts = [types.Part(text=content)],
            ))
        elif role == "assistant":
            contents.append(types.Content(
                role  = "model",
                parts = [types.Part(text=content)],
            ))

    return system_instruction, contents


async def chat(
    messages:    list[dict],
    model:       str   = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens:  int   = 1024,
    stop:        list[str] | None = None,
) -> tuple[str, dict]:
    from google.genai import types

    client = get_client()
    start  = time.time()

    system_instruction, contents = _build_contents(messages)

    config = types.GenerateContentConfig(
        temperature       = temperature,
        max_output_tokens = max_tokens,
        system_instruction= system_instruction or None,
    )

    def _call():
        response = client.models.generate_content(
            model    = model,
            contents = contents,
            config   = config,
        )
        return response

    loop     = asyncio.get_event_loop()
    response = await loop.run_in_executor(None, _call)

    latency_ms = int((time.time() - start) * 1000)
    content    = response.text or ""

    usage = {
        "prompt_tokens":     getattr(response.usage_metadata, "prompt_token_count",      0),
        "completion_tokens": getattr(response.usage_metadata, "candidates_token_count",  0),
        "total_tokens":      getattr(response.usage_metadata, "total_token_count",       0),
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
    """Get full response, yield in chunks for typing effect."""
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