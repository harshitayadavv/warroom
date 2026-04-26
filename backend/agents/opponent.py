# LOCATION: backend/agents/opponent.py
# Opponent agent — argues AGAINST the proposition
# Finds weaknesses, counter-evidence, and alternative framings

from __future__ import annotations
from services.groq_client import chat_stream, AGENT_MODELS
from models.schemas import AgentConfig, AgentScore, AgentRole
from agents.scoring import score_turn, detect_fallacies
from agents.prompts import get_system_prompt
import logging

logger = logging.getLogger(__name__)


async def run(
    config:       AgentConfig,
    topic:        str,
    round_num:    int,
    max_rounds:   int,
    transcript:   list[dict],
    is_personal:  bool = False,
    context:      str | None = None,
    interrupt:    dict | None = None,
    tool_results: str = "",
    emit=None,
) -> tuple[str, AgentScore, list]:
    """
    Run the opponent agent for one turn.
    Returns (full_content, score, tool_calls_list).
    """

    system_prompt = get_system_prompt(
        config=config,
        topic=topic,
        round_num=round_num,
        max_rounds=max_rounds,
        is_personal=is_personal,
        context=context,
    )

    messages = [{"role": "system", "content": system_prompt}]

    # Last 6 turns as context
    for turn in transcript[-6:]:
        role_label = "assistant" if turn["agent_role"] == "opponent" else "user"
        messages.append({
            "role":    role_label,
            "content": f"[{turn['agent_role'].upper()} — Round {turn['round']}]:\n{turn['content']}"
        })

    if interrupt:
        messages.append({
            "role":    "user",
            "content": (
                f"⚡ HUMAN INTERRUPT ({interrupt.get('redirect_type','challenge').upper()}):\n"
                f"{interrupt['message']}\n\n"
                f"Address this directly in your counter-argument."
            )
        })

    user_prompt = "Your turn. Identify the weakest point in the Proponent's argument and attack it."
    if tool_results:
        user_prompt = f"COUNTER-EVIDENCE FOUND:\n{tool_results}\n\nUse this to dismantle the Proponent's position."
    messages.append({"role": "user", "content": user_prompt})

    full_content = ""
    if emit:
        await emit("agent_speaking", {
            "agentRole":  "opponent",
            "content":    "",
            "isStreaming": True,
        })

    async for chunk in chat_stream(
        messages=messages,
        model=config.model or AGENT_MODELS["opponent"],
        temperature=config.temperature,
        max_tokens=600,
    ):
        full_content += chunk
        if emit:
            await emit("agent_speaking", {
                "agentRole":  "opponent",
                "content":    chunk,
                "isStreaming": True,
            })

    agent_score = await score_turn(full_content, AgentRole.opponent, round_num)
    fallacies   = await detect_fallacies(full_content)
    agent_score.fallacies_detected = fallacies
    agent_score.total_score = round((agent_score.logic_score + agent_score.evidence_score) / 2, 1)

    logger.info(
        f"[Opponent] Round {round_num} complete | "
        f"Logic:{agent_score.logic_score:.0f} Evidence:{agent_score.evidence_score:.0f} "
        f"Fallacies:{len(fallacies)}"
    )

    return full_content, agent_score, []