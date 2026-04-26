# LOCATION: backend/agents/graph.py
# LangGraph state machine — the core debate orchestration engine
# Manages: agent turns, tool calls, consensus checking, interrupts, checkpointing

from __future__ import annotations
import json, logging, asyncio
from typing import TypedDict, Annotated, Any
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from models.schemas import (
    Debate, DebateTurn, AgentRole, AgentScore, ToolCall,
    WSEvent, WSEventType, JudgeVerdict, DebateStatus
)
from services import groq_client, redis_client, supabase_client
from agents import prompts, consensus
from agents.scoring import score_turn, detect_fallacies
from tools.web_search import web_search, fact_check
from tools.python_repl import execute_python

logger = logging.getLogger(__name__)


# ── LangGraph State ────────────────────────────────────────────

class DebateState(TypedDict):
    debate_id:       str
    debate:          dict                     # serialized Debate
    current_round:   int
    current_agent:   str                      # AgentRole value
    last_pro_stance: str
    last_opp_stance: str
    consensus_score: float
    should_end:      bool
    interrupt_data:  dict | None
    approval_queue:  list[dict]
    ws_callback:     Any                      # callable to emit WS events


# ── WebSocket emit helper ──────────────────────────────────────

async def emit(state: DebateState, event_type: WSEventType, payload: Any = None):
    cb = state.get("ws_callback")
    if cb:
        event = WSEvent(
            type=event_type,
            debate_id=state["debate_id"],
            payload=payload,
        )
        await cb(event)


# ── Tool execution with approval gate ─────────────────────────

async def run_tool_with_approval(
    state: DebateState,
    tool_name: str,
    tool_input: dict,
    agent_role: str,
    agent_name: str,
    requires_approval: bool = False,
) -> tuple[Any, ToolCall]:
    tc = ToolCall(tool=tool_name, input=tool_input, status="pending")

    # Notify frontend tool is being called
    await emit(state, WSEventType.agent_tool_call, {
        "agentRole": agent_role,
        "tool":      tool_name,
        "input":     tool_input,
        "status":    "calling",
        "turnId":    tc.id,
    })

    # High-stakes tools need approval
    if requires_approval:
        import uuid
        request_id = str(uuid.uuid4())
        request = {
            "id":        request_id,
            "tool":      tool_name,
            "agentRole": agent_role,
            "agentName": agent_name,
            "input":     tool_input,
            "timestamp": "now",
        }
        await redis_client.add_approval_request(state["debate_id"], request)
        await emit(state, WSEventType.approval_required, request)

        response = await redis_client.get_approval_response(state["debate_id"], request_id, timeout=60)
        if not response or not response.get("approved"):
            tc.status = "error"
            tc.error_msg = response.get("reason", "Rejected by user") if response else "Approval timed out"
            return None, tc

    # Execute tool
    tc.status = "running"
    import time
    start = time.time()
    try:
        if tool_name == "web_search":
            result = await web_search(tool_input.get("query", ""), max_results=tool_input.get("max_results", 5))
        elif tool_name == "fact_check":
            result = await fact_check(tool_input.get("claim", ""))
        elif tool_name == "python_repl":
            result = execute_python(tool_input.get("code", ""))
        else:
            result = {"error": f"Unknown tool: {tool_name}"}

        tc.status     = "success"
        tc.output     = result
        tc.duration_ms = int((time.time() - start) * 1000)

    except Exception as e:
        tc.status   = "error"
        tc.error_msg = str(e)
        result      = None

    # Notify frontend of result
    await emit(state, WSEventType.agent_tool_result, {
        "agentRole": agent_role,
        "tool":      tool_name,
        "status":    tc.status,
        "result":    tc.output,
        "durationMs": tc.duration_ms,
    })

    return result, tc


# ── Agent node factory ─────────────────────────────────────────

async def run_agent_turn(state: DebateState, role: AgentRole) -> dict:
    """Core logic for any agent's turn."""
    debate_data = state["debate"]
    debate_id   = state["debate_id"]
    config_data = next((a for a in debate_data["config"]["agents"] if a["role"] == role.value), None)
    if not config_data:
        return state

    from models.schemas import AgentConfig
    config = AgentConfig(**config_data)

    is_personal = debate_data.get("personal_context_detected", False)
    topic       = debate_data["config"]["topic"]
    round_num   = state["current_round"]
    max_rounds  = debate_data["config"]["max_rounds"]

    # Check for pause/interrupt
    if await redis_client.is_paused(debate_id):
        await emit(state, WSEventType.debate_paused, {})
        # Wait for resume
        while await redis_client.is_paused(debate_id):
            await asyncio.sleep(1)

    interrupt = await redis_client.get_interrupt(debate_id)
    if interrupt:
        await redis_client.clear_interrupt(debate_id)
        await emit(state, WSEventType.debate_interrupted, interrupt)
        state = {**state, "interrupt_data": interrupt}

    # Notify frontend — agent is thinking
    await emit(state, WSEventType.agent_thinking, {
        "agentRole":   role.value,
        "thought":     f"Preparing {role.value} argument for round {round_num}...",
        "isStreaming":  False,
    })

    # Build message history from transcript
    messages = build_message_history(state, role, config, topic, round_num, max_rounds, is_personal, interrupt)

    # Collect tool calls
    tool_calls: list[ToolCall] = []
    tool_context = ""

    # Proponent/Opponent can do web search
    if role in (AgentRole.proponent, AgentRole.opponent) and debate_data["config"].get("enable_web_search"):
        search_query = f"{topic} evidence {'supporting' if role == AgentRole.proponent else 'against'} 2024 2025"
        result, tc = await run_tool_with_approval(
            state, "web_search", {"query": search_query, "max_results": 3},
            role.value, config.name, requires_approval=False,
        )
        tool_calls.append(tc)
        if result and result.get("answer"):
            tool_context = f"\n\nWEB SEARCH RESULTS:\nQuery: {search_query}\nAnswer: {result['answer']}\nSources: {', '.join(r['url'] for r in result.get('results', [])[:2])}\n"

    # Fact-Checker runs fact_check on previous claim
    if role == AgentRole.fact_checker:
        last_turn = get_last_agent_content(state, AgentRole.proponent)
        if last_turn:
            result, tc = await run_tool_with_approval(
                state, "fact_check", {"claim": last_turn[:300]},
                role.value, config.name,
                requires_approval=debate_data["config"].get("enable_human_interrupt", True),
            )
            tool_calls.append(tc)
            if result:
                tool_context = f"\n\nFACT-CHECK RESULTS:\n{json.dumps(result, indent=2)[:800]}\n"

    # Add tool context to messages
    if tool_context:
        messages[-1]["content"] += tool_context

    # Stream the agent's response
    full_content = ""
    await emit(state, WSEventType.agent_speaking, {
        "agentRole":  role.value,
        "content":    "",
        "isStreaming": True,
    })

    async for chunk in groq_client.chat_stream(
        messages=messages,
        model=config.model,
        temperature=config.temperature,
        max_tokens=600,
    ):
        full_content += chunk
        await emit(state, WSEventType.agent_speaking, {
            "agentRole":  role.value,
            "content":    chunk,
            "isStreaming": True,
        })

    # Score the turn
    agent_score = await score_turn(full_content, role, round_num)
    fallacies   = await detect_fallacies(full_content)
    agent_score.fallacies_detected = fallacies

    # Build embedding for consensus tracking
    embedding = []
    if role in (AgentRole.proponent, AgentRole.opponent):
        stance    = await consensus.extract_stance(full_content)
        embedding = await groq_client.embed_text(stance)

        if role == AgentRole.proponent:
            state = {**state, "last_pro_stance": stance}
        else:
            state = {**state, "last_opp_stance": stance}

    # Build turn object
    turn = DebateTurn(
        debate_id    = debate_id,
        round        = round_num,
        agent_role   = role,
        agent_name   = config.name,
        content      = full_content,
        tool_calls   = tool_calls,
        score        = agent_score,
        embedding    = embedding if len(embedding) > 0 else None,
        is_interrupt = bool(interrupt),
    )

    # Persist turn
    await supabase_client.save_turn(turn)

    # Append to transcript in state
    debate_data["transcript"] = debate_data.get("transcript", []) + [turn.model_dump(mode="json")]

    # Emit turn complete
    await emit(state, WSEventType.turn_complete, turn.model_dump(mode="json"))

    return {**state, "debate": debate_data}


# ── Individual agent nodes ─────────────────────────────────────

async def proponent_node(state: DebateState) -> dict:
    return await run_agent_turn(state, AgentRole.proponent)

async def opponent_node(state: DebateState) -> dict:
    return await run_agent_turn(state, AgentRole.opponent)

async def fact_checker_node(state: DebateState) -> dict:
    return await run_agent_turn(state, AgentRole.fact_checker)

async def moderator_node(state: DebateState) -> dict:
    return await run_agent_turn(state, AgentRole.moderator)


# ── Consensus check node ───────────────────────────────────────

async def consensus_node(state: DebateState) -> dict:
    debate_data = state["debate"]
    threshold   = debate_data["config"].get("consensus_threshold", 0.85)
    round_num   = state["current_round"]
    max_rounds  = debate_data["config"]["max_rounds"]

    pro_stance = state.get("last_pro_stance", "")
    opp_stance = state.get("last_opp_stance", "")

    score = state.get("consensus_score", 0.0)

    if pro_stance and opp_stance:
        new_score, _, _ = await consensus.compute_consensus_score(pro_stance, opp_stance)
        score = new_score

    debate_data["consensus_score"] = score
    should_end = consensus.is_consensus_reached(score, threshold) or round_num >= max_rounds

    await emit(state, WSEventType.consensus_update, {
        "score":             score,
        "delta":             score - state.get("consensus_score", 0.0),
        "convergingAgents":  ["proponent", "opponent"] if score > 0.7 else [],
    })

    # Save checkpoint every round
    await supabase_client.save_checkpoint(
        debate_id=state["debate_id"],
        round_num=round_num,
        state={
            "debate":          debate_data,
            "current_round":   round_num,
            "last_pro_stance": pro_stance,
            "last_opp_stance": opp_stance,
            "consensus_score": score,
        },
        label=f"Round {round_num} — consensus {score:.0%}",
    )

    return {**state, "consensus_score": score, "should_end": should_end, "debate": debate_data}


# ── Round counter node ─────────────────────────────────────────

async def round_start_node(state: DebateState) -> dict:
    new_round = state["current_round"] + 1
    await emit(state, WSEventType.round_started, {"round": new_round})
    return {**state, "current_round": new_round}


# ── Routing functions ──────────────────────────────────────────

def should_continue(state: DebateState) -> str:
    if state.get("should_end"):
        return "end"
    return "continue"


# ── Judge verdict node ─────────────────────────────────────────

async def judge_node(state: DebateState) -> dict:
    debate_data = state["debate"]

    # Summarize transcript for judge
    transcript = debate_data.get("transcript", [])
    summary_parts = []
    for t in transcript[-10:]:  # last 10 turns
        summary_parts.append(f"[Round {t['round']} — {t['agent_role']}]: {t['content'][:200]}...")
    transcript_summary = "\n".join(summary_parts)

    # Compute final scores per agent
    scores: dict[str, dict] = {}
    for turn in transcript:
        role = turn["agent_role"]
        if role not in scores:
            scores[role] = {"logic": [], "evidence": [], "fallacies": 0}
        scores[role]["logic"].append(turn["score"]["logic_score"])
        scores[role]["evidence"].append(turn["score"]["evidence_score"])
        scores[role]["fallacies"] += len(turn["score"]["fallacies_detected"])

    scores_str = "\n".join(
        f"{role}: avg_logic={sum(v['logic'])/len(v['logic']):.0f}, avg_evidence={sum(v['evidence'])/len(v['evidence']):.0f}, fallacies={v['fallacies']}"
        for role, v in scores.items() if v["logic"]
    )

    messages = [{
        "role": "user",
        "content": prompts.get_judge_verdict_prompt(
            topic              = debate_data["config"]["topic"],
            transcript_summary = transcript_summary,
            scores             = scores_str,
            consensus_score    = state["consensus_score"],
            is_personal        = debate_data.get("personal_context_detected", False),
            rounds             = state["current_round"],
            duration_sec       = 0,
        )
    }]

    content, _ = await groq_client.chat(
        messages   = messages,
        model      = "llama-3.3-70b-versatile",
        temperature = 0.3,
        max_tokens = 800,
    )

    try:
        # Strip any accidental markdown fences
        clean = content.strip().removeprefix("```json").removesuffix("```").strip()
        verdict_data = json.loads(clean)

        # Build total fallacy counts
        total_fallacies = {role: v["fallacies"] for role, v in scores.items()}

        verdict = JudgeVerdict(
            winner                  = verdict_data.get("winner"),
            winner_name             = verdict_data.get("winner_name", "Draw"),
            summary                 = verdict_data.get("summary", ""),
            key_arguments           = verdict_data.get("key_arguments", []),
            consensus_reached       = verdict_data.get("consensus_reached", False),
            final_consensus_score   = state["consensus_score"] * 100,
            total_fallacies         = total_fallacies,
            recommendation          = verdict_data.get("recommendation", ""),
            confidence_in_verdict   = verdict_data.get("confidence_in_verdict", 75),
            debate_duration_sec     = 0,
            total_rounds            = state["current_round"],
            personal_context_detected = debate_data.get("personal_context_detected", False),
        )

        await supabase_client.save_verdict(state["debate_id"], verdict)
        await emit(state, WSEventType.verdict_ready, verdict.model_dump())

        debate_data["status"] = "consensus_reached" if verdict.consensus_reached else "max_rounds_reached"
        debate_data["winner_role"] = verdict.winner

    except Exception as e:
        logger.error(f"[Judge] Verdict parsing failed: {e}\nRaw: {content}")
        await emit(state, WSEventType.error, {"message": "Judge verdict failed to parse"})

    await emit(state, WSEventType.debate_complete, debate_data)
    return {**state, "debate": debate_data}


# ── Build the LangGraph ────────────────────────────────────────

def build_debate_graph():
    graph = StateGraph(DebateState)

    graph.add_node("round_start",   round_start_node)
    graph.add_node("proponent",     proponent_node)
    graph.add_node("opponent",      opponent_node)
    graph.add_node("fact_checker",  fact_checker_node)
    graph.add_node("moderator",     moderator_node)
    graph.add_node("consensus",     consensus_node)
    graph.add_node("judge",         judge_node)

    graph.set_entry_point("round_start")

    graph.add_edge("round_start",  "proponent")
    graph.add_edge("proponent",    "opponent")
    graph.add_edge("opponent",     "fact_checker")
    graph.add_edge("fact_checker", "moderator")
    graph.add_edge("moderator",    "consensus")

    graph.add_conditional_edges(
        "consensus",
        should_continue,
        {"continue": "round_start", "end": "judge"},
    )
    graph.add_edge("judge", END)

    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)


# ── Helpers ────────────────────────────────────────────────────

def build_message_history(
    state: DebateState,
    role: AgentRole,
    config,
    topic: str,
    round_num: int,
    max_rounds: int,
    is_personal: bool,
    interrupt: dict | None,
) -> list[dict]:
    context = state["debate"]["config"].get("context")
    system_prompt = prompts.get_system_prompt(
        config=config, topic=topic, round_num=round_num,
        max_rounds=max_rounds, is_personal=is_personal, context=context,
    )
    messages = [{"role": "system", "content": system_prompt}]

    # Add last few turns as context (most recent 6)
    transcript = state["debate"].get("transcript", [])
    for turn in transcript[-6:]:
        turn_role = "assistant" if turn["agent_role"] == role.value else "user"
        messages.append({
            "role":    turn_role,
            "content": f"[{turn['agent_role'].upper()} — Round {turn['round']}]:\n{turn['content']}"
        })

    # Inject interrupt
    if interrupt:
        messages.append({
            "role":    "user",
            "content": f"⚡ HUMAN INTERRUPT ({interrupt.get('redirect_type', 'evidence').upper()}):\n{interrupt['message']}\n\nYou MUST address this directive in your next response."
        })

    # Current turn prompt
    messages.append({"role": "user", "content": f"It is your turn. Round {round_num}. Respond now."})
    return messages


def get_last_agent_content(state: DebateState, role: AgentRole) -> str | None:
    transcript = state["debate"].get("transcript", [])
    for turn in reversed(transcript):
        if turn["agent_role"] == role.value:
            return turn["content"]
    return None