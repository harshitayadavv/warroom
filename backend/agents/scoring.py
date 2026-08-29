# LOCATION: backend/agents/scoring.py

import asyncio, json, logging, re
from models.schemas import AgentScore, Fallacy, FallacyType, AgentRole
from services.groq_client import chat

logger = logging.getLogger(__name__)

# openai/gpt-oss-20b is a reasoning model — it wraps output in <think>...</think>
# before the actual JSON. We must strip that block before parsing.
SCORING_MODEL = "openai/gpt-oss-20b"


def _strip_think_tags(text: str) -> str:
    """Remove <think>...</think> blocks that reasoning models prepend to output."""
    # Remove everything between <think> and </think> including the tags
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    return cleaned.strip()


def _extract_json(text: str) -> str:
    """Extract JSON object or array from text, handling think tags and markdown."""
    # First strip think tags
    text = _strip_think_tags(text)
    # Strip markdown code fences
    text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return text


async def score_turn(content: str, role: AgentRole, round_num: int) -> AgentScore:
    try:
        messages = [
            {
                "role": "system",
                "content": "Score this debate argument. Respond ONLY with JSON, no markdown, no explanation, no think tags.",
            },
            {
                "role": "user",
                "content": (
                    f"AGENT: {role.value} | ROUND: {round_num}\n"
                    f"ARGUMENT: {content[:600]}\n\n"
                    f"Return ONLY this JSON object:\n"
                    f'{{"logic_score":0-100,"evidence_score":0-100,"sentiment_score":-1.0to1.0}}'
                ),
            },
        ]

        raw, _ = await asyncio.wait_for(
            chat(messages=messages, model=SCORING_MODEL, temperature=0.1, max_tokens=200),
            timeout=10.0,
        )

        clean = _extract_json(raw)
        start = clean.find('{')
        end   = clean.rfind('}') + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON object found")
        data = json.loads(clean[start:end])

        score = AgentScore(
            logic_score     = float(data.get("logic_score",    65)),
            evidence_score  = float(data.get("evidence_score", 65)),
            sentiment_score = float(data.get("sentiment_score", 0)),
        )
        score.total_score = round((score.logic_score + score.evidence_score) / 2, 1)
        return score

    except asyncio.TimeoutError:
        logger.warning("[Scoring] score_turn timed out — using defaults")
        return AgentScore(logic_score=65, evidence_score=65, total_score=65)
    except Exception as e:
        logger.warning(f"[Scoring] score_turn failed: {e}")
        return AgentScore(logic_score=65, evidence_score=65, total_score=65)


async def detect_fallacies(content: str) -> list[Fallacy]:
    """Only called for proponent/opponent on round >= 2 (guarded in graph.py)."""
    try:
        messages = [
            {
                "role": "system",
                "content": "Detect logical fallacies. Respond ONLY with a JSON array, no markdown, no think tags.",
            },
            {
                "role": "user",
                "content": (
                    f"Find fallacies (return [] if none):\n{content[:500]}\n\n"
                    f'Return ONLY: [{{"type":"ad_hominem","description":"brief","severity":"low","quote":"phrase"}}]'
                ),
            },
        ]

        raw, _ = await asyncio.wait_for(
            chat(messages=messages, model=SCORING_MODEL, temperature=0.1, max_tokens=200),
            timeout=10.0,
        )

        clean = _extract_json(raw)
        start = clean.find('[')
        end   = clean.rfind(']') + 1
        if start == -1 or end == 0:
            return []
        data = json.loads(clean[start:end])

        fallacies = []
        for item in data:
            try:
                fallacies.append(Fallacy(
                    type        = FallacyType(item["type"]),
                    description = item.get("description", ""),
                    severity    = item.get("severity", "low"),
                    quote       = item.get("quote", "")[:150],
                ))
            except Exception:
                continue
        return fallacies

    except asyncio.TimeoutError:
        logger.warning("[Scoring] detect_fallacies timed out")
        return []
    except Exception as e:
        logger.warning(f"[Scoring] detect_fallacies failed: {e}")
        return []