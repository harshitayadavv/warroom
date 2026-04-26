# LOCATION: backend/agents/fact_checker.py
# Fact-Checker agent — neutral auditor
# Validates claims, detects fallacies, issues penalty scores
# Uses web search to verify/refute specific claims

from __future__ import annotations
from services.groq_client import chat_stream, AGENT_MODELS
from models.schemas import AgentConfig, AgentScore, AgentRole, ToolCall
from agents.scoring import score_turn, detect_fallacies
from agents.prompts import get_system_prompt
import logging, uuid, time

logger = logging.getLogger(__name__)


async def run(
    config:             AgentConfig,
    topic:              str,
    round_num:          int,
    max_rounds:         int,
    transcript:         list[dict],
    is_personal:        bool = False,
    context:            str | None = None,
    enable_web_search:  bool = True,
    emit=None,
) -> tuple[str, AgentScore, list[ToolCall]]:
    """
    Run the fact-checker agent for one turn.
    Returns (full_content, score, tool_calls_list).
    """

    # Get the last proponent and opponent turns to audit
    last_pro = next((t for t in reversed(transcript) if t["agent_role"] == "proponent"), None)
    last_opp = next((t for t in reversed(transcript) if t["agent_role"] == "opponent"), None)

    tool_calls: list[ToolCall] = []
    fact_check_results = ""

    # Run web search to verify the most recent claim
    if enable_web_search and last_pro:
        claim_to_check = last_pro["content"][:400]
        if emit:
            await emit("agent_tool_call", {
                "agentRole": "fact_checker",
                "tool":      "fact_check",
                "input":     {"claim": claim_to_check[:100] + "..."},
                "status":    "calling",
            })
        try:
            from tools.web_search import fact_check
            start  = time.time()
            result = await fact_check(claim_to_check)
            duration_ms = int((time.time() - start) * 1000)

            tc = ToolCall(
                tool="fact_check",
                input={"claim": claim_to_check[:200]},
                output=result,
                duration_ms=duration_ms,
                status="success",
            )
            tool_calls.append(tc)

            if result.get("supporting") or result.get("contradicting"):
                supporting   = "\n".join(f"  • {r['content'][:150]}" for r in result["supporting"][:2])
                contradicting = "\n".join(f"  • {r['content'][:150]}" for r in result["contradicting"][:2])
                fact_check_results = (
                    f"\nFACT-CHECK RESULTS for Proponent's claim:\n"
                    f"Supporting evidence:\n{supporting or '  None found'}\n"
                    f"Contradicting evidence:\n{contradicting or '  None found'}\n"
                )
            if emit:
                await emit("agent_tool_result", {
                    "agentRole":  "fact_checker",
                    "tool":       "fact_check",
                    "status":     "success",
                    "durationMs": duration_ms,
                })
        except Exception as e:
            logger.warning(f"[FactChecker] Web search failed: {e}")

    system_prompt = get_system_prompt(
        config=config,
        topic=topic,
        round_num=round_num,
        max_rounds=max_rounds,
        is_personal=is_personal,
        context=context,
    )

    messages = [{"role": "system", "content": system_prompt}]

    # Build audit context
    audit_content = ""
    if last_pro:
        audit_content += f"\nPROPONENT SAID (Round {last_pro['round']}):\n{last_pro['content']}\n"
    if last_opp:
        audit_content += f"\nOPPONENT SAID (Round {last_opp['round']}):\n{last_opp['content']}\n"
    if fact_check_results:
        audit_content += fact_check_results

    messages.append({
        "role":    "user",
        "content": f"Audit these arguments:{audit_content}\n\nProvide your fact-check report now."
    })

    full_content = ""
    if emit:
        await emit("agent_speaking", {
            "agentRole":  "fact_checker",
            "content":    "",
            "isStreaming": True,
        })

    async for chunk in chat_stream(
        messages=messages,
        model=config.model or AGENT_MODELS["fact_checker"],
        temperature=min(config.temperature, 0.3),  # fact-checker stays cold
        max_tokens=500,
    ):
        full_content += chunk
        if emit:
            await emit("agent_speaking", {
                "agentRole":  "fact_checker",
                "content":    chunk,
                "isStreaming": True,
            })

    agent_score = await score_turn(full_content, AgentRole.fact_checker, round_num)
    agent_score.total_score = agent_score.evidence_score  # fact-checker scored on accuracy only

    logger.info(f"[FactChecker] Round {round_num} | Tools: {len(tool_calls)}")

    return full_content, agent_score, tool_calls