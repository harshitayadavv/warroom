from __future__ import annotations
import json, logging, asyncio
from typing import TypedDict, Any
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from models.schemas import (
    Debate, DebateTurn, AgentRole, AgentScore, ToolCall,
    WSEvent, WSEventType, JudgeVerdict, DebateStatus,
)
from services import groq_client, redis_client, supabase_client
from agents import prompts
from agents.scoring import score_turn, detect_fallacies
from agents.consensus import (
    compute_consensus_score, extract_stance,
    detect_personal_topic, is_consensus_reached,
)
import time
logger = logging.getLogger(__name__)


# ── WS Callback Registry ───────────────────────────────────────
# Functions are NOT msgpack-serializable, so we cannot store them
# in LangGraph state. Instead we keep a module-level dict keyed by
# debate_id. Nodes call get_ws_callback(debate_id) to retrieve it.

_WS_CALLBACKS: dict[str, Any] = {}

def register_ws_callback(debate_id: str, callback: Any) -> None:
    _WS_CALLBACKS[debate_id] = callback

def unregister_ws_callback(debate_id: str) -> None:
    _WS_CALLBACKS.pop(debate_id, None)

def get_ws_callback(debate_id: str) -> Any:
    return _WS_CALLBACKS.get(debate_id)


# ── camelCase serializer for WebSocket payloads ────────────────

def turn_to_ws(turn: DebateTurn) -> dict:
    d     = turn.model_dump(mode="json")
    score = d.get("score") or {}
    return {
        "id":          d.get("id"),
        "debateId":    d.get("debate_id"),
        "round":       d.get("round"),
        "agentRole":   d.get("agent_role"),
        "agentName":   d.get("agent_name"),
        "content":     d.get("content"),
        "isInterrupt": d.get("is_interrupt", False),
        "score": {
            "logicScore":        score.get("logic_score",    50),
            "evidenceScore":     score.get("evidence_score", 50),
            "totalScore":        score.get("total_score",    50),
            "sentimentScore":    score.get("sentiment_score", 0),
            "fallaciesDetected": score.get("fallacies_detected") or [],
        },
        "toolCalls": d.get("tool_calls", []),
        "createdAt": d.get("created_at"),
    }


# ── State ──────────────────────────────────────────────────────
# IMPORTANT: every value here must be msgpack-serializable.
# Primitives, dicts, lists only — NO functions, NO callables.

class DebateState(TypedDict):
    debate_id:       str
    debate:          dict
    current_round:   int
    current_agent:   str
    last_pro_stance: str
    last_opp_stance: str
    consensus_score: float
    should_end:      bool
    interrupt_data:  dict | None
    # ws_callback intentionally REMOVED — use get_ws_callback(debate_id)


# ── Emit ───────────────────────────────────────────────────────

async def emit(state: DebateState, event_type: WSEventType, payload: Any = None):
    cb = get_ws_callback(state["debate_id"])
    if cb:
        try:
            await cb(WSEvent(type=event_type, debate_id=state["debate_id"], payload=payload))
        except Exception as e:
            logger.warning(f"[WS emit] {e}")


# ── Fallacy rate-limit guard ───────────────────────────────────
# detect_fallacies uses llama-3.1-8b-instant which has a tiny TPM
# limit (6000). Running it every turn causes constant 429s and 8s
# timeouts that slow every round by ~8s. We only call it on rounds
# where the agent has already spoken at least once (round > 1) and
# only for proponent/opponent (not fact_checker/moderator).

_ROLES_WITH_FALLACY_CHECK = {AgentRole.proponent, AgentRole.opponent}

def _should_check_fallacies(role: AgentRole, round_num: int) -> bool:
    return role in _ROLES_WITH_FALLACY_CHECK and round_num >= 2


# ── Core agent turn ────────────────────────────────────────────

async def run_agent_turn(state: DebateState, role: AgentRole) -> dict:
    start_time = time.time()
    debate_data = state["debate"]
    debate_id   = state["debate_id"]
    round_num   = state["current_round"]
    max_rounds  = debate_data["config"]["max_rounds"]
    topic       = debate_data["config"]["topic"]
    is_personal = debate_data.get("personal_context_detected", False)
    context     = debate_data["config"].get("context")

    config_data = next(
        (a for a in debate_data["config"]["agents"] if a["role"] == role.value),
        None,
    )
    if not config_data:
        logger.error(f"No config for {role.value}")
        return state

    from models.schemas import AgentConfig
    config = AgentConfig(**config_data)

    # ── Pause check ──────────────────────────────────────────────
    if await redis_client.is_paused(debate_id):
        await emit(state, WSEventType.debate_paused, {})
        logger.info(f"[{role.value}] Paused — waiting for resume")
        for _ in range(600):
            await asyncio.sleep(1)
            if not await redis_client.is_paused(debate_id):
                logger.info(f"[{role.value}] Resumed")
                break

    # ── Interrupt check ──────────────────────────────────────────
    interrupt = await redis_client.get_interrupt(debate_id)
    if interrupt:
        await redis_client.clear_interrupt(debate_id)
        await emit(state, WSEventType.debate_interrupted, interrupt)
        state = {**state, "interrupt_data": interrupt}

    # ── Web search (disabled by default) ─────────────────────────
    tool_calls:  list[ToolCall] = []
    tool_context = ""

    enable_search = debate_data["config"].get("enable_web_search", False)
    do_search = (
        enable_search
        and round_num == 1
        and role in (AgentRole.proponent, AgentRole.opponent)
    )

    if do_search:
        try:
            from tools.web_search import web_search
            q = f"{topic} {'evidence for' if role == AgentRole.proponent else 'evidence against'} 2024 2025"
            await emit(state, WSEventType.agent_tool_call, {
                "agentRole": role.value, "tool": "web_search",
                "input": {"query": q}, "status": "calling",
            })
            result = await asyncio.wait_for(web_search(q, max_results=2), timeout=8.0)
            tc = ToolCall(tool="web_search", input={"query": q}, output=result, status="success")
            tool_calls.append(tc)
            if result.get("answer"):
                tool_context = f"\n\n[WEB SEARCH]\n{result['answer'][:250]}\n"
            await emit(state, WSEventType.agent_tool_call, {
                "agentRole": role.value, "tool": "web_search", "status": "success",
            })
        except Exception as e:
            logger.warning(f"[WebSearch] Skipped: {e}")

    # ── Build messages ───────────────────────────────────────────
    system_prompt = prompts.get_system_prompt(
        config=config, topic=topic, round_num=round_num,
        max_rounds=max_rounds, is_personal=is_personal, context=context,
    )
    messages = [{"role": "system", "content": system_prompt}]

    transcript = debate_data.get("transcript", [])
    for t in transcript[-6:]:
        r = "assistant" if t["agent_role"] == role.value else "user"
        messages.append({"role": r, "content": f"[{t['agent_role'].upper()} R{t['round']}]: {t['content'][:400]}"})

    if interrupt:
        messages.append({
            "role":    "user",
            "content": f"⚡ HUMAN INTERRUPT ({interrupt.get('redirect_type','').upper()}):\n{interrupt['message']}\nAddress this directly.",
        })

    user_msg = "Your turn. Make your argument now."
    if tool_context:
        user_msg = f"Research:{tool_context}\n\nNow make your argument using this."
    messages.append({"role": "user", "content": user_msg})

    # ── Notify thinking ──────────────────────────────────────────
    await emit(state, WSEventType.agent_thinking, {
        "agentRole":   role.value,
        "thought":     f"{config.name} is preparing...",
        "isStreaming": False,
    })

    # ── Stream response ──────────────────────────────────────────
    full_content = ""
    await emit(state, WSEventType.agent_speaking, {
        "agentRole": role.value, "content": "", "isStreaming": True,
    })

    try:
        async def _stream():
            nonlocal full_content
            async for chunk in groq_client.chat_stream(
                messages    = messages,
                model       = config.model or "openai/gpt-oss-120b",
                temperature = config.temperature,
                max_tokens  = 450,
            ):
                full_content += chunk
                await emit(state, WSEventType.agent_speaking, {
                    "agentRole": role.value, "content": chunk, "isStreaming": True,
                })

        await asyncio.wait_for(_stream(), timeout=45.0)

    except asyncio.TimeoutError:
        logger.error(f"[{role.value}] Stream timed out after 45s")
        if not full_content:
            full_content = f"[{config.name} response timed out — skipping turn]"
    except Exception as e:
        logger.error(f"[{role.value}] Stream error: {e}")
        if not full_content:
            full_content = f"[{config.name} encountered an error: {str(e)[:80]}]"

    # ── Score + fallacies IN PARALLEL ─────────────────────────────
    # Only run detect_fallacies when it makes sense (avoids TPM limit)
    try:
        if _should_check_fallacies(role, round_num):
            results = await asyncio.gather(
                score_turn(full_content, role, round_num),
                detect_fallacies(full_content),
                return_exceptions=True,
            )
            agent_score = results[0] if not isinstance(results[0], Exception) else AgentScore(logic_score=50, evidence_score=50, total_score=50)
            fallacies   = results[1] if not isinstance(results[1], Exception) else []
        else:
            agent_score = await score_turn(full_content, role, round_num)
            fallacies   = []

        if isinstance(agent_score, Exception):
            agent_score = AgentScore(logic_score=50, evidence_score=50, total_score=50)

        agent_score.fallacies_detected = fallacies
        agent_score.total_score = round((agent_score.logic_score + agent_score.evidence_score) / 2, 1)

    except Exception:
        agent_score = AgentScore(logic_score=50, evidence_score=50, total_score=50)

    # ── Embedding (best-effort, only pro/opp) ────────────────────
    embedding: list[float] | None = None
    if role in (AgentRole.proponent, AgentRole.opponent):
        try:
            stance    = await asyncio.wait_for(extract_stance(full_content), timeout=5.0)
            embedding = await asyncio.wait_for(groq_client.embed_text(stance), timeout=5.0)
            embedding = embedding if len(embedding) > 0 else None
            if embedding:
                if role == AgentRole.proponent:
                    state = {**state, "last_pro_stance": stance}
                else:
                    state = {**state, "last_opp_stance": stance}
        except Exception:
            embedding = None

    # ── Build turn ───────────────────────────────────────────────
    turn = DebateTurn(
        debate_id    = debate_id,
        round        = round_num,
        agent_role   = role,
        agent_name   = config.name,
        content      = full_content,
        tool_calls   = tool_calls,
        score        = agent_score,
        embedding    = embedding,
        is_interrupt = bool(interrupt),
    )

    # Save to DB
    try:
        await supabase_client.save_turn(turn)
    except Exception as e:
        logger.error(f"[DB] save_turn failed: {e}")

    # Update internal state (snake_case)
    debate_data["transcript"] = debate_data.get("transcript", []) + [turn.model_dump(mode="json")]

    # Update agent score so frontend live metrics work
    if "agents" in debate_data and role.value in debate_data["agents"]:
        debate_data["agents"][role.value]["score"] = agent_score.model_dump(mode="json")
        debate_data["agents"][role.value]["turnCount"] = (
            debate_data["agents"][role.value].get("turnCount", 0) + 1
        )
    end_time = time.time()
    duration = round(end_time - start_time, 2)
    logger.info(f"[METRICS] {role.value} | round={round_num} | duration={duration}s | tokens={len(full_content.split())}")
    # Broadcast turn_complete with camelCase payload
    await emit(state, WSEventType.turn_complete, turn_to_ws(turn))

    return {**state, "debate": debate_data}


# ── Agent nodes ────────────────────────────────────────────────

async def proponent_node(state: DebateState) -> dict:
    return await run_agent_turn(state, AgentRole.proponent)

async def opponent_node(state: DebateState) -> dict:
    return await run_agent_turn(state, AgentRole.opponent)

async def fact_checker_node(state: DebateState) -> dict:
    return await run_agent_turn(state, AgentRole.fact_checker)

async def moderator_node(state: DebateState) -> dict:
    return await run_agent_turn(state, AgentRole.moderator)


# ── Round start ────────────────────────────────────────────────

async def round_start_node(state: DebateState) -> dict:
    new_round = state["current_round"] + 1
    logger.info(f"[Graph] ── Round {new_round} starting ──")
    logger.info(f"[METRICS] ROUND_START | debate={state['debate_id']} | round={new_round} | ts={time.time()}")
async def round_start_node(state: DebateState) -> dict:
    new_round = state["current_round"] + 1
    logger.info(f"[Graph] ── Round {new_round} starting ──")
    logger.info(f"[METRICS] ROUND_START | debate={state['debate_id']} | round={new_round} | ts={time.time()}")

    try:
        await supabase_client.update_debate_status(
            state["debate_id"],
            DebateStatus.running.value,
            {"current_round": new_round},
        )
    except Exception as e:
        logger.warning(f"[DB] round update failed: {e}")

    await emit(state, WSEventType.round_started, {"round": new_round})
    return {**state, "current_round": new_round}

    await emit(state, WSEventType.round_started, {"round": new_round})
    return {**state, "current_round": new_round}


# ── Consensus check ────────────────────────────────────────────

async def consensus_node(state: DebateState) -> dict:
    debate_data = state["debate"]
    threshold   = debate_data["config"].get("consensus_threshold", 0.85)
    round_num   = state["current_round"]
    max_rounds  = debate_data["config"]["max_rounds"]
    prev_score  = state.get("consensus_score", 0.0)
    score       = prev_score
    logger.info(f"[METRICS] ROUND_END | debate={state['debate_id']} | round={round_num} | ts={time.time()}")
    pro = state.get("last_pro_stance", "")
    opp = state.get("last_opp_stance", "")
    if pro and opp:
        try:
            new_score, _, _ = await asyncio.wait_for(
                compute_consensus_score(pro, opp), timeout=6.0
            )
            score = new_score
        except Exception:
            pass

    debate_data["consensus_score"] = score
    should_end = is_consensus_reached(score, threshold) or round_num >= max_rounds

    await emit(state, WSEventType.consensus_update, {
        "score": score,
        "delta": score - prev_score,
        "convergingAgents": ["proponent", "opponent"] if score > 0.7 else [],
    })

    try:
        await supabase_client.update_debate_status(
            state["debate_id"],
            DebateStatus.running.value,
            {"consensus_score": score, "current_round": round_num},
        )
    except Exception as e:
        logger.warning(f"[DB] consensus update failed: {e}")

    try:
        await supabase_client.save_checkpoint(
            debate_id = state["debate_id"],
            round_num = round_num,
            state     = {
                "debate":          debate_data,
                "current_round":   round_num,
                "last_pro_stance": pro,
                "last_opp_stance": opp,
                "consensus_score": score,
            },
            label = f"Round {round_num} — {score:.0%}",
        )
    except Exception as e:
        logger.warning(f"[Checkpoint] Failed: {e}")

    return {**state, "consensus_score": score, "should_end": should_end, "debate": debate_data}


# ── Judge ──────────────────────────────────────────────────────

async def judge_node(state: DebateState) -> dict:
    debate_data = state["debate"]
    transcript  = debate_data.get("transcript", [])

    summary_parts = [
        f"[R{t['round']} {t['agent_role']}]: {t['content'][:200]}"
        for t in transcript[-8:]
    ]

    scores: dict[str, dict] = {}
    for t in transcript:
        r = t["agent_role"]
        if r not in scores:
            scores[r] = {"logic": [], "evidence": [], "fallacies": 0}
        s = t.get("score", {})
        scores[r]["logic"].append(s.get("logic_score", 50))
        scores[r]["evidence"].append(s.get("evidence_score", 50))
        scores[r]["fallacies"] += len(s.get("fallacies_detected", []))

    def avg(lst): return round(sum(lst) / len(lst), 1) if lst else 50

    scores_str = "\n".join(
        f"{r}: logic={avg(v['logic'])} evidence={avg(v['evidence'])} fallacies={v['fallacies']}"
        for r, v in scores.items()
    )

    try:
        raw, _ = await groq_client.chat(
            messages=[{"role": "user", "content": prompts.get_judge_verdict_prompt(
                topic              = debate_data["config"]["topic"],
                transcript_summary = "\n".join(summary_parts),
                scores             = scores_str,
                consensus_score    = state["consensus_score"],
                is_personal        = debate_data.get("personal_context_detected", False),
                rounds             = state["current_round"],
                duration_sec       = 0,
            )}],
            model       = "openai/gpt-oss-120b",
            temperature = 0.3,
            max_tokens  = 900,
        )
        clean        = raw.strip().removeprefix("```json").removesuffix("```").strip()
        verdict_data = json.loads(clean)

        verdict = JudgeVerdict(
            winner                    = verdict_data.get("winner"),
            winner_name               = verdict_data.get("winner_name", "Draw"),
            summary                   = verdict_data.get("summary", ""),
            key_arguments             = verdict_data.get("key_arguments", []),
            consensus_reached         = state["consensus_score"] >= debate_data["config"].get("consensus_threshold", 0.85),
            final_consensus_score     = state["consensus_score"] * 100,
            total_fallacies           = {r: v["fallacies"] for r, v in scores.items()},
            recommendation            = verdict_data.get("recommendation", ""),
            confidence_in_verdict     = verdict_data.get("confidence_in_verdict", 75),
            debate_duration_sec       = 0,
            total_rounds              = state["current_round"],
            personal_context_detected = debate_data.get("personal_context_detected", False),
        )

        await supabase_client.save_verdict(state["debate_id"], verdict)
        await emit(state, WSEventType.verdict_ready, verdict.model_dump(mode="json"))

        debate_data["status"]      = "consensus_reached" if verdict.consensus_reached else "max_rounds_reached"
        debate_data["winner_role"] = verdict_data.get("winner")

    except Exception as e:
        logger.error(f"[Judge] Failed: {e}")
        debate_data["status"] = "max_rounds_reached"
        await emit(state, WSEventType.error, {"message": f"Judge error: {str(e)[:100]}"})

    await emit(state, WSEventType.debate_complete, debate_data)
    return {**state, "debate": debate_data}


# ── Routing ────────────────────────────────────────────────────

def should_continue(state: DebateState) -> str:
    return "end" if state.get("should_end") else "continue"


# ── Build graph ────────────────────────────────────────────────

def build_debate_graph():
    g = StateGraph(DebateState)
    g.add_node("round_start",  round_start_node)
    g.add_node("proponent",    proponent_node)
    g.add_node("opponent",     opponent_node)
    g.add_node("fact_checker", fact_checker_node)
    g.add_node("moderator",    moderator_node)
    g.add_node("consensus",    consensus_node)
    g.add_node("judge",        judge_node)

    g.set_entry_point("round_start")
    g.add_edge("round_start",  "proponent")
    g.add_edge("proponent",    "opponent")
    g.add_edge("opponent",     "fact_checker")
    g.add_edge("fact_checker", "moderator")
    g.add_edge("moderator",    "consensus")
    g.add_conditional_edges("consensus", should_continue, {
        "continue": "round_start",
        "end":      "judge",
    })
    g.add_edge("judge", END)

    return g.compile(checkpointer=MemorySaver())