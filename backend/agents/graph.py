# LOCATION: backend/agents/graph.py
# Rewritten for speed:
# - Web search is OPTIONAL and only happens round 1 + every 3 rounds
# - Scoring + fallacy detection run in PARALLEL (asyncio.gather)
# - Embedding is skipped if sentence-transformers not installed
# - Pause check is fast (Redis GET, not a blocking loop shown to user)
# - Each turn targets < 5 seconds total

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
from agents.consensus import compute_consensus_score, extract_stance, detect_personal_topic, is_consensus_reached

logger = logging.getLogger(__name__)


# ── State ──────────────────────────────────────────────────────

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
    ws_callback:     Any


# ── Emit helper ────────────────────────────────────────────────

async def emit(state: DebateState, event_type: WSEventType, payload: Any = None):
    cb = state.get("ws_callback")
    if cb:
        try:
            event = WSEvent(type=event_type, debate_id=state["debate_id"], payload=payload)
            await cb(event)
        except Exception as e:
            logger.warning(f"[WS] Emit failed: {e}")


# ── Core agent turn ────────────────────────────────────────────

async def run_agent_turn(state: DebateState, role: AgentRole) -> dict:
    debate_data = state["debate"]
    debate_id   = state["debate_id"]
    round_num   = state["current_round"]
    max_rounds  = debate_data["config"]["max_rounds"]
    topic       = debate_data["config"]["topic"]
    is_personal = debate_data.get("personal_context_detected", False)
    context     = debate_data["config"].get("context")

    # Find agent config
    config_data = next(
        (a for a in debate_data["config"]["agents"] if a["role"] == role.value),
        None
    )
    if not config_data:
        logger.error(f"No config for role {role.value}")
        return state

    from models.schemas import AgentConfig
    config = AgentConfig(**config_data)

    # ── Check pause ──────────────────────────────────────────────
    if await redis_client.is_paused(debate_id):
        await emit(state, WSEventType.debate_paused, {})
        # Wait up to 5 minutes for resume
        for _ in range(300):
            await asyncio.sleep(1)
            if not await redis_client.is_paused(debate_id):
                break
        else:
            return state  # timed out

    # ── Check interrupt ──────────────────────────────────────────
    interrupt = await redis_client.get_interrupt(debate_id)
    if interrupt:
        await redis_client.clear_interrupt(debate_id)
        await emit(state, WSEventType.debate_interrupted, interrupt)
        state = {**state, "interrupt_data": interrupt}

    # ── Optional web search (not every turn — too slow) ──────────
    tool_calls: list[ToolCall] = []
    tool_context = ""

    enable_search = debate_data["config"].get("enable_web_search", False)
    # Only search on round 1 and every 3rd round to keep things fast
    should_search = enable_search and (round_num == 1 or round_num % 3 == 0)

    if should_search and role in (AgentRole.proponent, AgentRole.opponent):
        try:
            from tools.web_search import web_search
            query = f"{topic} {'supporting evidence 2024 2025' if role == AgentRole.proponent else 'counter-arguments evidence 2024 2025'}"

            await emit(state, WSEventType.agent_tool_call, {
                "agentRole": role.value, "tool": "web_search",
                "input": {"query": query}, "status": "calling",
            })

            import time
            start  = time.time()
            result = await asyncio.wait_for(web_search(query, max_results=3), timeout=8.0)
            ms     = int((time.time() - start) * 1000)

            tc = ToolCall(tool="web_search", input={"query": query},
                          output=result, duration_ms=ms, status="success")
            tool_calls.append(tc)

            if result.get("answer"):
                tool_context = f"\n\n[WEB SEARCH RESULTS]\nQuery: {query}\nSummary: {result['answer'][:300]}\n"

            await emit(state, WSEventType.agent_tool_result, {
                "agentRole": role.value, "tool": "web_search",
                "status": "success", "durationMs": ms,
            })
        except Exception as e:
            logger.warning(f"[WebSearch] Skipped: {e}")

    # ── Fact-checker: only searches when there's a claim to check ─
    if role == AgentRole.fact_checker:
        last_pro = next(
            (t for t in reversed(debate_data.get("transcript", [])) if t["agent_role"] == "proponent"),
            None
        )
        if last_pro and enable_search:
            try:
                from tools.web_search import fact_check
                claim = last_pro["content"][:300]
                result = await asyncio.wait_for(fact_check(claim), timeout=8.0)
                tc = ToolCall(tool="fact_check", input={"claim": claim},
                              output=result, status="success")
                tool_calls.append(tc)
                if result.get("supporting") or result.get("contradicting"):
                    sup = "; ".join(r["content"][:100] for r in result["supporting"][:2])
                    con = "; ".join(r["content"][:100] for r in result["contradicting"][:2])
                    tool_context = f"\n\n[FACT CHECK]\nSupporting: {sup}\nContradicting: {con}\n"
            except Exception as e:
                logger.warning(f"[FactCheck] Skipped: {e}")

    # ── Build messages ───────────────────────────────────────────
    system_prompt = prompts.get_system_prompt(
        config=config, topic=topic, round_num=round_num,
        max_rounds=max_rounds, is_personal=is_personal, context=context,
    )
    messages = [{"role": "system", "content": system_prompt}]

    transcript = debate_data.get("transcript", [])
    for turn in transcript[-6:]:
        msg_role = "assistant" if turn["agent_role"] == role.value else "user"
        messages.append({
            "role":    msg_role,
            "content": f"[{turn['agent_role'].upper()} R{turn['round']}]: {turn['content'][:500]}"
        })

    if interrupt:
        messages.append({
            "role":    "user",
            "content": f"⚡ HUMAN INTERRUPT ({interrupt.get('redirect_type','').upper()}):\n{interrupt['message']}\nAddress this in your response."
        })

    user_msg = "Your turn."
    if tool_context:
        user_msg = f"Research findings:{tool_context}\n\nNow make your argument."
    messages.append({"role": "user", "content": user_msg})

    # ── Stream response ──────────────────────────────────────────
    await emit(state, WSEventType.agent_thinking, {
        "agentRole":  role.value,
        "thought":    f"{config.name} is preparing argument...",
        "isStreaming": False,
    })

    full_content = ""
    await emit(state, WSEventType.agent_speaking, {
        "agentRole": role.value, "content": "", "isStreaming": True,
    })

    try:
        async for chunk in groq_client.chat_stream(
            messages    = messages,
            model       = config.model or groq_client.AGENT_MODELS.get(role.value, "llama-3.3-70b-versatile"),
            temperature = config.temperature,
            max_tokens  = 500,
        ):
            full_content += chunk
            await emit(state, WSEventType.agent_speaking, {
                "agentRole": role.value, "content": chunk, "isStreaming": True,
            })
    except Exception as e:
        logger.error(f"[{role.value}] Stream error: {e}")
        full_content = f"[Agent error: {str(e)[:100]}]"

    # ── Score + detect fallacies IN PARALLEL (saves ~2s per turn) ─
    try:
        agent_score, fallacies = await asyncio.gather(
            score_turn(full_content, role, round_num),
            detect_fallacies(full_content),
            return_exceptions=True,
        )
        if isinstance(agent_score, Exception):
            agent_score = AgentScore(logic_score=50, evidence_score=50, total_score=50)
        if isinstance(fallacies, Exception):
            fallacies = []
        agent_score.fallacies_detected = fallacies
        agent_score.total_score = round((agent_score.logic_score + agent_score.evidence_score) / 2, 1)
    except Exception:
        agent_score = AgentScore(logic_score=50, evidence_score=50, total_score=50)

    # ── Embedding (non-blocking, best-effort) ────────────────────
    embedding: list[float] | None = None
    if role in (AgentRole.proponent, AgentRole.opponent):
        try:
            stance    = await asyncio.wait_for(extract_stance(full_content), timeout=5.0)
            embedding = await asyncio.wait_for(groq_client.embed_text(stance), timeout=5.0)
            if len(embedding) > 0:
                if role == AgentRole.proponent:
                    state = {**state, "last_pro_stance": stance}
                else:
                    state = {**state, "last_opp_stance": stance}
        except Exception:
            embedding = None

    # ── Build + save turn ────────────────────────────────────────
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

    try:
        await supabase_client.save_turn(turn)
    except Exception as e:
        logger.error(f"[DB] Failed to save turn: {e}")

    # Update transcript in state
    debate_data["transcript"] = debate_data.get("transcript", []) + [turn.model_dump(mode="json")]

    # Update agent score in debate state
    if "agents" in debate_data and role.value in debate_data["agents"]:
        debate_data["agents"][role.value]["score"] = agent_score.model_dump(mode="json")

    await emit(state, WSEventType.turn_complete, turn.model_dump(mode="json"))

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
    await emit(state, WSEventType.round_started, {"round": new_round})
    logger.info(f"[Graph] Round {new_round} started")
    return {**state, "current_round": new_round}


# ── Consensus ──────────────────────────────────────────────────

async def consensus_node(state: DebateState) -> dict:
    debate_data = state["debate"]
    threshold   = debate_data["config"].get("consensus_threshold", 0.85)
    round_num   = state["current_round"]
    max_rounds  = debate_data["config"]["max_rounds"]

    prev_score  = state.get("consensus_score", 0.0)
    score       = prev_score

    pro = state.get("last_pro_stance", "")
    opp = state.get("last_opp_stance", "")
    if pro and opp:
        try:
            new_score, _, _ = await asyncio.wait_for(
                compute_consensus_score(pro, opp), timeout=8.0
            )
            score = new_score
        except Exception:
            pass

    debate_data["consensus_score"] = score
    should_end = is_consensus_reached(score, threshold) or round_num >= max_rounds

    await emit(state, WSEventType.consensus_update, {
        "score":            score,
        "delta":            score - prev_score,
        "convergingAgents": ["proponent", "opponent"] if score > 0.7 else [],
    })

    # Save checkpoint
    try:
        await supabase_client.save_checkpoint(
            debate_id = state["debate_id"],
            round_num = round_num,
            state     = {
                "debate": debate_data,
                "current_round": round_num,
                "last_pro_stance": pro,
                "last_opp_stance": opp,
                "consensus_score": score,
            },
            label = f"Round {round_num} — {score:.0%} consensus",
        )
    except Exception as e:
        logger.warning(f"[Checkpoint] Failed: {e}")

    # Update debate status in DB
    try:
        await supabase_client.update_debate_status(
            state["debate_id"],
            DebateStatus.running.value,
            {"consensus_score": score, "current_round": round_num},
        )
    except Exception as e:
        logger.warning(f"[DB] Status update failed: {e}")

    return {**state, "consensus_score": score, "should_end": should_end, "debate": debate_data}


# ── Judge ──────────────────────────────────────────────────────

async def judge_node(state: DebateState) -> dict:
    debate_data = state["debate"]
    transcript  = debate_data.get("transcript", [])

    # Summarize for verdict
    summary_parts = [
        f"[R{t['round']} {t['agent_role']}]: {t['content'][:250]}"
        for t in transcript[-8:]
    ]
    transcript_summary = "\n".join(summary_parts)

    # Aggregate scores
    scores: dict[str, dict] = {}
    for t in transcript:
        r = t["agent_role"]
        if r not in scores:
            scores[r] = {"logic": [], "evidence": [], "fallacies": 0}
        s = t.get("score", {})
        scores[r]["logic"].append(s.get("logic_score", 50))
        scores[r]["evidence"].append(s.get("evidence_score", 50))
        scores[r]["fallacies"] += len(s.get("fallacies_detected", []))

    def avg(lst): return sum(lst) / len(lst) if lst else 50

    scores_str = "\n".join(
        f"{r}: logic={avg(v['logic']):.0f} evidence={avg(v['evidence']):.0f} fallacies={v['fallacies']}"
        for r, v in scores.items()
    )

    messages = [{"role": "user", "content": prompts.get_judge_verdict_prompt(
        topic=debate_data["config"]["topic"],
        transcript_summary=transcript_summary,
        scores=scores_str,
        consensus_score=state["consensus_score"],
        is_personal=debate_data.get("personal_context_detected", False),
        rounds=state["current_round"],
        duration_sec=0,
    )}]

    try:
        raw, _ = await groq_client.chat(
            messages=messages,
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=900,
        )
        clean        = raw.strip().removeprefix("```json").removesuffix("```").strip()
        verdict_data = json.loads(clean)
        total_fallacies = {r: v["fallacies"] for r, v in scores.items()}

        verdict = JudgeVerdict(
            winner                    = verdict_data.get("winner"),
            winner_name               = verdict_data.get("winner_name", "Draw"),
            summary                   = verdict_data.get("summary", ""),
            key_arguments             = verdict_data.get("key_arguments", []),
            consensus_reached         = state["consensus_score"] >= debate_data["config"].get("consensus_threshold", 0.85),
            final_consensus_score     = state["consensus_score"] * 100,
            total_fallacies           = total_fallacies,
            recommendation            = verdict_data.get("recommendation", ""),
            confidence_in_verdict     = verdict_data.get("confidence_in_verdict", 75),
            debate_duration_sec       = 0,
            total_rounds              = state["current_round"],
            personal_context_detected = debate_data.get("personal_context_detected", False),
        )

        await supabase_client.save_verdict(state["debate_id"], verdict)
        await emit(state, WSEventType.verdict_ready, verdict.model_dump(mode="json"))

        debate_data["status"]      = "consensus_reached" if verdict.consensus_reached else "max_rounds_reached"
        debate_data["winner_role"] = verdict.winner

    except Exception as e:
        logger.error(f"[Judge] Failed: {e}")
        debate_data["status"] = "max_rounds_reached"

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