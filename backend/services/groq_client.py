# LOCATION: backend/services/groq_client.py
# Switched from Groq to Google Gemini API
# - No model deprecations
# - No <think> tags
# - Free tier: 15 RPM, 1M tokens/day on gemini-1.5-flash
# - Excellent debate quality

from __future__ import annotations
import os, time, logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-1.5-flash"

AGENT_MODELS = {
    "proponent":    DEFAULT_MODEL,
    "opponent":     DEFAULT_MODEL,
    "fact_checker": DEFAULT_MODEL,
    "moderator":    DEFAULT_MODEL,
    "judge":        DEFAULT_MODEL,
}

_genai = None

def get_client():
    global _genai
    if _genai is None:
        import google.generativeai as genai
        key = os.environ.get("GEMINI_API_KEY", "")
        if not key:
            raise RuntimeError("GEMINI_API_KEY not set in environment")
        genai.configure(api_key=key)
        _genai = genai
    return _genai


def _messages_to_gemini(messages: list[dict]) -> tuple[str, list[dict]]:
    """Convert OpenAI-format messages to Gemini format.
    Returns (system_instruction, gemini_history)
    """
    system_instruction = ""
    history = []

    for msg in messages:
        role    = msg["role"]
        content = msg["content"]

        if role == "system":
            system_instruction = content
        elif role == "user":
            history.append({"role": "user", "parts": [content]})
        elif role == "assistant":
            history.append({"role": "model", "parts": [content]})

    return system_instruction, history


async def chat(
    messages:    list[dict],
    model:       str   = DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens:  int   = 1024,
    stop:        list[str] | None = None,
) -> tuple[str, dict]:
    import asyncio
    import google.generativeai as genai

    get_client()  # ensure configured

    start = time.time()

    system_instruction, history = _messages_to_gemini(messages)

    generation_config = genai.GenerationConfig(
        temperature      = temperature,
        max_output_tokens= max_tokens,
    )

    gmodel = genai.GenerativeModel(
        model_name            = model,
        system_instruction    = system_instruction or None,
        generation_config     = generation_config,
    )

    # Run in executor since Gemini SDK is sync
    def _call():
        if len(history) == 0:
            return gmodel.generate_content("Hello")
        # Last message is the user prompt
        last = history[-1]["parts"][0]
        chat_history = history[:-1]
        if chat_history:
            session  = gmodel.start_chat(history=chat_history)
            response = session.send_message(last)
        else:
            response = gmodel.generate_content(last)
        return response

    loop     = asyncio.get_event_loop()
    response = await loop.run_in_executor(None, _call)

    latency_ms = int((time.time() - start) * 1000)
    content    = response.text or ""

    usage = {
        "prompt_tokens":     getattr(response.usage_metadata, "prompt_token_count",     0),
        "completion_tokens": getattr(response.usage_metadata, "candidates_token_count", 0),
        "total_tokens":      getattr(response.usage_metadata, "total_token_count",      0),
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
    """Get full response from Gemini, yield in chunks for typing effect."""
    content, _ = await chat(
        messages    = messages,
        model       = model,
        temperature = temperature,
        max_tokens  = max_tokens,
    )

    if not content:
        content = "[Agent produced no response]"

    # Yield in chunks to simulate typing effect
    chunk_size = 20
    for i in range(0, len(content), chunk_size):
        yield content[i:i + chunk_size]


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