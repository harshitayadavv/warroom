# LOCATION: backend/agents/scoring.py
# Scores each agent turn: logic, evidence, sentiment, fallacy detection

import json, logging
from models.schemas import AgentScore, Fallacy, FallacyType, AgentRole
from services.groq_client import chat

logger = logging.getLogger(__name__)

SCORING_MODEL = "llama-3.1-8b-instant"  # fast model for background scoring


async def score_turn(content: str, role: AgentRole, round_num: int) -> AgentScore:
    """Score a single agent turn using a fast Groq model."""
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a debate scoring system. Score the given argument strictly and objectively. "
                    "Respond ONLY with valid JSON — no markdown, no explanation."
                )
            },
            {
                "role": "user",
                "content": f"""Score this debate argument:

AGENT: {role.value}
ROUND: {round_num}
CONTENT: {content[:1500]}

Respond with ONLY this JSON:
{{
  "logic_score": <0-100, how logically structured and valid the argument is>,
  "evidence_score": <0-100, how well-supported with facts/data>,
  "sentiment_score": <-1.0 to 1.0, emotional tone: -1=very negative, 0=neutral, +1=very positive>,
  "confidence": <0-100, the agent's apparent self-confidence in their position>,
  "stance_vector": <-1.0 to 1.0, position on the topic: -1=strongly oppose, +1=strongly support>
}}"""
            }
        ]

        raw, _ = await chat(
            messages   = messages,
            model      = SCORING_MODEL,
            temperature = 0.1,
            max_tokens = 150,
        )

        data = json.loads(raw.strip().removeprefix("```json").removesuffix("```").strip())

        score = AgentScore(
            logic_score     = float(data.get("logic_score", 50)),
            evidence_score  = float(data.get("evidence_score", 50)),
            sentiment_score = float(data.get("sentiment_score", 0)),
            confidence      = float(data.get("confidence", 50)),
            stance_vector   = float(data.get("stance_vector", 0)),
        )
        score.total_score = round((score.logic_score + score.evidence_score) / 2, 1)
        return score

    except Exception as e:
        logger.warning(f"[Scoring] Failed to score turn: {e}")
        return AgentScore(logic_score=50, evidence_score=50, total_score=50)


async def detect_fallacies(content: str) -> list[Fallacy]:
    """Detect logical fallacies in agent content using fast Groq model."""
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a logical fallacy detector. Analyze the argument for fallacies. "
                    "Respond ONLY with valid JSON — no markdown, no preamble."
                )
            },
            {
                "role": "user",
                "content": f"""Detect logical fallacies in this argument:

{content[:1200]}

Respond with ONLY this JSON (empty array if none found):
[
  {{
    "type": "ad_hominem" | "straw_man" | "false_dichotomy" | "appeal_to_authority" | "circular_reasoning" | "slippery_slope" | "hasty_generalization" | "red_herring" | "false_analogy" | "appeal_to_emotion",
    "description": "brief explanation of the fallacy",
    "severity": "low" | "medium" | "high",
    "quote": "the exact phrase from the argument that contains the fallacy (max 100 chars)"
  }}
]"""
            }
        ]

        raw, _ = await chat(
            messages   = messages,
            model      = SCORING_MODEL,
            temperature = 0.1,
            max_tokens = 300,
        )

        clean = raw.strip().removeprefix("```json").removesuffix("```").strip()
        data  = json.loads(clean)

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

    except Exception as e:
        logger.warning(f"[Scoring] Fallacy detection failed: {e}")
        return []