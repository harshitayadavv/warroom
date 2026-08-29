# LOCATION: backend/agents/consensus.py
# Consensus Engine — uses vector embeddings to mathematically measure
# argument convergence between Proponent and Opponent

import numpy as np
import logging
from services.groq_client import embed_text

logger = logging.getLogger(__name__)


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two embedding vectors."""
    a = np.array(vec_a)
    b = np.array(vec_b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


async def compute_consensus_score(
    proponent_stance: str,
    opponent_stance: str,
) -> tuple[float, list[float], list[float]]:
    """
    Embed both agents' latest stances and compute cosine similarity.
    Returns (score_0_to_1, proponent_embedding, opponent_embedding).
    Score of 1.0 = identical stance = full consensus.
    Score of 0.0 = completely opposite stances.
    """
    try:
        pro_emb = await embed_text(proponent_stance)
        opp_emb = await embed_text(opponent_stance)
        raw_similarity = cosine_similarity(pro_emb, opp_emb)

        # Cosine similarity ranges -1 to 1, normalize to 0-1
        normalized = (raw_similarity + 1) / 2

        logger.info(f"[Consensus] Raw cosine: {raw_similarity:.3f} → Normalized: {normalized:.3f}")
        return normalized, pro_emb, opp_emb

    except Exception as e:
        logger.error(f"[Consensus] Embedding failed: {e}")
        return 0.0, [], []


async def detect_personal_topic(topic: str) -> bool:
    """
    Detect if a debate topic is personal/life decision vs factual/world topic.
    Personal topics: "should I buy a dog", "should I quit my job"
    Factual topics: "nuclear energy is essential", "AI should be regulated"

    Uses a simple keyword heuristic + Groq classification.
    """
    personal_signals = [
        "should i", "should we", "my ", "i want", "i am", "i'm", "my life",
        "my job", "my family", "my relationship", "buy a", "get a", "move to",
        "quit", "leave", "start a", "my career", "my health", "my money",
    ]
    topic_lower = topic.lower()
    if any(signal in topic_lower for signal in personal_signals):
        return True
    return False


async def extract_stance(agent_content: str) -> str:
    """
    Extract just the stance/position from an agent's full response.
    Used for cleaner embedding (removes rhetoric, keeps core position).
    """
    from services.groq_client import chat

    messages = [
        {
            "role": "system",
            "content": (
                "Extract the core position/stance from this debate argument in 1-2 sentences. "
                "Remove rhetoric, examples, and evidence. Just the fundamental claim. "
                "Respond with ONLY the stance sentence(s), nothing else."
            )
        },
        {"role": "user", "content": agent_content[:2000]},
    ]
    stance, _ = await chat(
        messages=messages,
        model="openai/gpt-oss-20b",  # fast model for extraction
        temperature=0.1,
        max_tokens=100,
    )
    return stance.strip()


def is_consensus_reached(score: float, threshold: float) -> bool:
    return score >= threshold