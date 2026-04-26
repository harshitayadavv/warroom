# LOCATION: backend/routers/debates.py

import asyncio, logging
from uuid import uuid4
from fastapi import APIRouter, HTTPException, BackgroundTasks, Header
from typing import Optional

from models.schemas import (
    CreateDebateRequest, InterruptRequest, ApprovalResponse,
    Debate, DebateStatus, AgentState, AgentScore,
    ApiResponse, PaginatedResponse, DebateSummary,
)
from services import supabase_client, redis_client
from agents.graph import build_debate_graph
from agents.consensus import detect_personal_topic
from routers.ws import manager, make_ws_callback

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/debates", tags=["debates"])

# Running debate tasks registry
_running_debates: dict[str, asyncio.Task] = {}


def _get_user_id(authorization: str | None) -> str | None:
    """Extract user_id from Bearer token via Supabase."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.removeprefix("Bearer ").strip()
    try:
        from services.supabase_client import get_supabase
        result = get_supabase().auth.get_user(token)
        return result.user.id if result.user else None
    except Exception:
        return None


# ── Create ─────────────────────────────────────────────────────

@router.post("", response_model=ApiResponse)
async def create_debate(
    request:       CreateDebateRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
):
    user_id    = _get_user_id(authorization) or request.user_id
    debate_id  = str(uuid4())
    is_personal = await detect_personal_topic(request.config.topic)

    agents = {
        cfg.role.value: AgentState(config=cfg, score=AgentScore())
        for cfg in request.config.agents
    }

    debate = Debate(
        id=debate_id, user_id=user_id,
        config=request.config, agents=agents,
        personal_context_detected=is_personal,
    )

    await supabase_client.save_debate(debate)
    background_tasks.add_task(run_debate_task, debate)

    return ApiResponse(data=debate.model_dump(mode="json"), message="Debate initialized")


async def run_debate_task(debate: Debate):
    debate_id = debate.id
    try:
        graph       = build_debate_graph()
        ws_callback = make_ws_callback(debate_id)

        initial_state = {
            "debate_id":       debate_id,
            "debate":          debate.model_dump(mode="json"),
            "current_round":   0,
            "current_agent":   "proponent",
            "last_pro_stance": "",
            "last_opp_stance": "",
            "consensus_score": 0.0,
            "should_end":      False,
            "interrupt_data":  None,
            "approval_queue":  [],
            "ws_callback":     ws_callback,
        }

        await supabase_client.update_debate_status(debate_id, DebateStatus.running.value)
        config = {"configurable": {"thread_id": debate_id}}
        await graph.ainvoke(initial_state, config=config)

    except asyncio.CancelledError:
        await supabase_client.update_debate_status(debate_id, DebateStatus.paused.value)
    except Exception as e:
        logger.error(f"[Debate {debate_id}] Error: {e}", exc_info=True)
        await supabase_client.update_debate_status(
            debate_id, DebateStatus.error.value,
            {"summary": f"Error: {str(e)[:200]}"},
        )
    finally:
        _running_debates.pop(debate_id, None)


# ── Read ───────────────────────────────────────────────────────

@router.get("/{debate_id}", response_model=ApiResponse)
async def get_debate(debate_id: str):
    data = await supabase_client.get_debate(debate_id)
    if not data:
        raise HTTPException(status_code=404, detail="Debate not found")
    return ApiResponse(data=data)


@router.get("", response_model=PaginatedResponse)
async def list_debates(
    page:          int = 1,
    limit:         int = 20,
    authorization: Optional[str] = Header(None),
):
    user_id = _get_user_id(authorization)
    if not user_id:
        return PaginatedResponse(data=[], total=0, page=1, limit=limit, has_more=False)

    debates, total = await supabase_client.list_debates(user_id, page, limit)
    summaries = [
        DebateSummary(
            id=d["id"], topic=d["topic"], status=d["status"],
            created_at=d["created_at"],
            rounds=d.get("current_round", 0),
            consensus_score=d.get("consensus_score", 0.0),
            winner_role=d.get("winner_role"),
            tags=d.get("tags", []),
            personal_context_detected=d.get("personal_context_detected", False),
        )
        for d in debates
    ]
    return PaginatedResponse(
        data=summaries, total=total, page=page, limit=limit,
        has_more=(page * limit) < total,
    )


# ── Delete ─────────────────────────────────────────────────────

@router.delete("/{debate_id}")
async def delete_debate(debate_id: str):
    task = _running_debates.get(debate_id)
    if task:
        task.cancel()
    await supabase_client.delete_debate(debate_id)
    await redis_client.delete_debate_state(debate_id)
    return {"message": "Deleted"}


# ── Control ────────────────────────────────────────────────────

@router.post("/{debate_id}/pause", response_model=ApiResponse)
async def pause_debate(debate_id: str):
    await redis_client.set_pause_flag(debate_id)
    await supabase_client.update_debate_status(debate_id, DebateStatus.paused.value)
    return ApiResponse(data={"status": "paused"})


@router.post("/{debate_id}/resume", response_model=ApiResponse)
async def resume_debate(debate_id: str):
    await redis_client.clear_pause_flag(debate_id)
    await supabase_client.update_debate_status(debate_id, DebateStatus.running.value)
    return ApiResponse(data={"status": "running"})


@router.post("/{debate_id}/interrupt", response_model=ApiResponse)
async def interrupt_debate(debate_id: str, request: InterruptRequest):
    await redis_client.set_interrupt(debate_id, {
        "message":       request.message,
        "redirect_type": request.redirect_type.value,
    })
    return ApiResponse(data={"status": "interrupted"})


@router.post("/{debate_id}/approve", response_model=ApiResponse)
async def approve_tool(debate_id: str, response: ApprovalResponse):
    await redis_client.set_approval_response(
        debate_id=debate_id,
        request_id=response.request_id,
        response={"approved": response.approved, "reason": response.reason},
    )
    return ApiResponse(data={"approved": response.approved})


@router.post("/{debate_id}/force-consensus", response_model=ApiResponse)
async def force_consensus(debate_id: str):
    state = await redis_client.get_debate_state(debate_id) or {}
    state["should_end"] = True
    await redis_client.set_debate_state(debate_id, state)
    return ApiResponse(data={"message": "Consensus forced"})


# ── Checkpoints ────────────────────────────────────────────────

@router.get("/{debate_id}/checkpoints", response_model=ApiResponse)
async def list_checkpoints(debate_id: str):
    cps = await supabase_client.list_checkpoints(debate_id)
    return ApiResponse(data=cps)


@router.post("/{debate_id}/checkpoints/{checkpoint_id}/restore", response_model=ApiResponse)
async def restore_checkpoint(debate_id: str, checkpoint_id: str):
    cp = await supabase_client.get_checkpoint(checkpoint_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    task = _running_debates.pop(debate_id, None)
    if task:
        task.cancel()
    await redis_client.set_debate_state(debate_id, cp["state_snapshot"])
    return ApiResponse(data={"message": f"Restored to round {cp['round']}"})


@router.post("/{debate_id}/checkpoints/{checkpoint_id}/fork", response_model=ApiResponse)
async def fork_checkpoint(
    debate_id:     str,
    checkpoint_id: str,
    background_tasks: BackgroundTasks,
    new_topic:     Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    cp = await supabase_client.get_checkpoint(checkpoint_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Checkpoint not found")

    user_id    = _get_user_id(authorization)
    snapshot   = cp["state_snapshot"]
    old_config = snapshot.get("debate", {}).get("config", {})
    if new_topic:
        old_config["topic"] = new_topic

    from models.schemas import DebateConfig, AgentConfig
    new_id = str(uuid4())
    config = DebateConfig(**old_config)
    debate = Debate(id=new_id, user_id=user_id, config=config,
                    current_round=cp["round"],
                    personal_context_detected=await detect_personal_topic(config.topic))

    await supabase_client.save_debate(debate)
    background_tasks.add_task(run_debate_task, debate)
    return ApiResponse(data={"newDebateId": new_id})