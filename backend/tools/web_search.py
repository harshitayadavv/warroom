# LOCATION: backend/tools/web_search.py
# Tavily-powered live web search for debate agents

import os, logging
from typing import Any
from tavily import TavilyClient

logger = logging.getLogger(__name__)

_client: TavilyClient | None = None

def get_client() -> TavilyClient:
    global _client
    if _client is None:
        key = os.environ.get("TAVILY_API_KEY", "")
        if not key:
            raise RuntimeError("TAVILY_API_KEY not set — web search disabled")
        _client = TavilyClient(api_key=key)
    return _client


async def web_search(query: str, max_results: int = 5, search_depth: str = "basic") -> dict[str, Any]:
    """
    Search the web and return structured results.
    search_depth: "basic" (fast) or "advanced" (deep, costs more credits)
    Returns dict with keys: query, results, answer
    """
    import asyncio, functools

    try:
        client = get_client()
        loop   = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            functools.partial(
                client.search,
                query=query,
                max_results=max_results,
                search_depth=search_depth,
                include_answer=True,
                include_raw_content=False,
            )
        )
        return {
            "query":   query,
            "answer":  result.get("answer", ""),
            "results": [
                {
                    "title":   r.get("title", ""),
                    "url":     r.get("url", ""),
                    "content": r.get("content", "")[:500],  # truncate
                    "score":   r.get("score", 0),
                }
                for r in result.get("results", [])
            ],
        }
    except Exception as e:
        logger.error(f"[WebSearch] Failed: {e}")
        return {"query": query, "answer": "", "results": [], "error": str(e)}


async def fact_check(claim: str) -> dict[str, Any]:
    """
    Specifically designed for the Fact-Checker agent.
    Searches for evidence for AND against a specific claim.
    """
    for_results  = await web_search(f'evidence supporting: "{claim}"', max_results=3)
    against_results = await web_search(f'evidence against or debunking: "{claim}"', max_results=3)

    return {
        "claim":         claim,
        "supporting":    for_results["results"],
        "contradicting": against_results["results"],
        "verdict":       "unverified",  # will be determined by agent
    }