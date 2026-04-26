# LOCATION: backend/agents/moderator.py
# Moderator/Judge agent — scores each round, manages flow, delivers final verdict

from __future__ import annotations
import json, logging
from services.groq_client import chat, AGENT_MODELS
from models.schemas import AgentConfig, AgentScore, AgentRole, JudgeVerdict
from agents.scoring import score_turn
from agents.prompts import get_system_prompt, get_judge_verdict_prompt

logger = logging.getLogger(__name__)


async def run(
    config:      AgentConfig,
    topic:       str,
    round_num:   int,
    max_rounds:  int,
    transcript:  list[dict],
    is_personal: bool = False,
    context:     str | None = None,
    emit=None,
) -> tuple[str, AgentScore]:
    """
    Moderator scores the round and provides a summary.
    Returns (summary_content, score).
    """

    system_prompt = get_system_prompt(
        config=config,
        topic=topic,
        round_num=round_num,
        max_rounds=max_rounds,
        is_personal=is_personal,
        context=context,
    )

    # Get this round's turns
    this_round = [t for t in transcript if t["round"] == round_num]
    turns_text = "\n\n".join(
        f"[{t['agent_role'].upper()}]:\n{t['content'][:500]}"
        for t in this_round
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Score Round {round_num}:\n\n{turns_text}"},
    ]

    content, _ = await chat(
        messages=messages,
        model=config.model or AGENT_MODELS["moderator"],
        temperature=min(config.temperature, 0.4),
        max_tokens=400,
    )

    if emit:
        await emit("round_complete", {
            "round":   round_num,
            "summary": content,
        })

    agent_score = await score_turn(content, AgentRole.moderator, round_num)
    logger.info(f"[Moderator] Round {round_num} scored")
    return content, agent_score


async def deliver_verdict(
    topic:          str,
    transcript:     list[dict],
    consensus_score: float,
    is_personal:    bool,
    rounds:         int,
) -> JudgeVerdict:
    """
    Final verdict — called once the debate ends.
    Produces winner, recommendation, key arguments.
    """

    # Summarize last 10 turns
    summary_parts = [
        f"[Round {t['round']} — {t['agent_role']}]: {t['content'][:250]}..."
        for t in transcript[-10:]
    ]
    transcript_summary = "\n".join(summary_parts)

    # Aggregate scores per role
    scores: dict[str, dict] = {}
    for turn in transcript:
        r = turn["agent_role"]
        if r not in scores:
            scores[r] = {"logic": [], "evidence": [], "fallacies": 0}
        s = turn.get("score", {})
        scores[r]["logic"].append(s.get("logic_score", 50))
        scores[r]["evidence"].append(s.get("evidence_score", 50))
        scores[r]["fallacies"] += len(s.get("fallacies_detected", []))

    def avg(lst): return sum(lst) / len(lst) if lst else 0

    scores_str = "\n".join(
        f"{role}: avg_logic={avg(v['logic']):.0f}, avg_evidence={avg(v['evidence']):.0f}, "
        f"fallacies={v['fallacies']}"
        for role, v in scores.items()
    )

    messages = [{
        "role": "user",
        "content": get_judge_verdict_prompt(
            topic=topic,
            transcript_summary=transcript_summary,
            scores=scores_str,
            consensus_score=consensus_score,
            is_personal=is_personal,
            rounds=rounds,
            duration_sec=0,
        )
    }]

    raw, _ = await chat(
        messages=messages,
        model=AGENT_MODELS["judge"],
        temperature=0.3,
        max_tokens=900,
    )

    try:
        clean = raw.strip().removeprefix("```json").removesuffix("```").strip()
        data  = json.loads(clean)

        total_fallacies = {role: v["fallacies"] for role, v in scores.items()}

        return JudgeVerdict(
            winner                    = data.get("winner"),
            winner_name               = data.get("winner_name", "Draw"),
            summary                   = data.get("summary", ""),
            key_arguments             = data.get("key_arguments", []),
            consensus_reached         = data.get("consensus_reached", False),
            final_consensus_score     = consensus_score * 100,
            total_fallacies           = total_fallacies,
            recommendation            = data.get("recommendation", ""),
            confidence_in_verdict     = data.get("confidence_in_verdict", 75),
            debate_duration_sec       = 0,
            total_rounds              = rounds,
            personal_context_detected = is_personal,
        )
    except Exception as e:
        logger.error(f"[Moderator] Verdict parse failed: {e}\nRaw: {raw}")
        # Return a fallback verdict
        return JudgeVerdict(
            winner=None, winner_name="Draw",
            summary="The debate concluded without a clear winner.",
            key_arguments=[], consensus_reached=False,
            final_consensus_score=consensus_score * 100,
            total_fallacies={}, recommendation="Review the transcript for insights.",
            confidence_in_verdict=50, debate_duration_sec=0,
            total_rounds=rounds, personal_context_detected=is_personal,
        )