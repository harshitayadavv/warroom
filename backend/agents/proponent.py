# LOCATION: backend/agents/proponent.py
# Proponent agent — argues FOR the proposition
# Works for both factual topics AND personal life decisions

from __future__ import annotations
from services.groq_client import chat_stream, AGENT_MODELS
from models.schemas import AgentConfig, DebateTurn, AgentScore, AgentRole
from agents.scoring import score_turn, detect_fallacies
from agents.prompts import get_system_prompt
import logging

logger = logging.getLogger(__name__)


async def run(
    config:      AgentConfig,
    topic:       str,
    round_num:   int,
    max_rounds:  int,
    transcript:  list[dict],
    is_personal: bool = False,
    context:     str | None = None,
    interrupt:   dict | None = None,
    tool_results: str = "",
    emit=None,
) -> tuple[str, AgentScore, list]:
    """
    Run the proponent agent for one turn.
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

    # Add recent transcript as context (last 6 turns)
    for turn in transcript[-6:]:
        role_label = "assistant" if turn["agent_role"] == "proponent" else "user"
        messages.append({
            "role":    role_label,
            "content": f"[{turn['agent_role'].upper()} — Round {turn['round']}]:\n{turn['content']}"
        })

    # Inject human interrupt if present
    if interrupt:
        messages.append({
            "role":    "user",
            "content": (
                f"⚡ HUMAN INTERRUPT ({interrupt.get('redirect_type','evidence').upper()}):\n"
                f"{interrupt['message']}\n\n"
                f"You MUST address this in your response."
            )
        })

    # Inject tool results (web search etc.)
    user_prompt = "Your turn. Make your strongest argument now."
    if tool_results:
        user_prompt = f"RESEARCH FINDINGS:\n{tool_results}\n\nNow make your argument using this evidence."
    messages.append({"role": "user", "content": user_prompt})

    # Stream response
    full_content = ""
    if emit:
        await emit("agent_speaking", {
            "agentRole": "proponent",
            "content": "",
            "isStreaming": True,
        })

    async for chunk in chat_stream(
        messages=messages,
        model=config.model or AGENT_MODELS["proponent"],
        temperature=config.temperature,
        max_tokens=600,
    ):
        full_content += chunk
        if emit:
            await emit("agent_speaking", {
                "agentRole":  "proponent",
                "content":    chunk,
                "isStreaming": True,
            })

    # Score
    agent_score = await score_turn(full_content, AgentRole.proponent, round_num)
    fallacies   = await detect_fallacies(full_content)
    agent_score.fallacies_detected = fallacies
    agent_score.total_score = round((agent_score.logic_score + agent_score.evidence_score) / 2, 1)

    logger.info(
        f"[Proponent] Round {round_num} complete | "
        f"Logic:{agent_score.logic_score:.0f} Evidence:{agent_score.evidence_score:.0f} "
        f"Fallacies:{len(fallacies)}"
    )

    return full_content, agent_score, []