# LOCATION: backend/services/supabase_client.py

import os, logging
from supabase import create_client, Client
from models.schemas import Debate, DebateTurn, JudgeVerdict

logger = logging.getLogger(__name__)
_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
    return _client


async def save_debate(debate: Debate) -> dict:
    sb   = get_supabase()
    data = {
        "id":                        debate.id,
        "user_id":                   debate.user_id,
        "topic":                     debate.config.topic,
        "status":                    debate.status.value,
        "config":                    debate.config.model_dump(mode="json"),
        "consensus_score":           debate.consensus_score,
        "current_round":             debate.current_round,
        "max_rounds":                debate.config.max_rounds,
        "winner_role":               debate.winner_role.value if debate.winner_role else None,
        "summary":                   debate.summary,
        "tags":                      debate.tags,
        "personal_context_detected": debate.personal_context_detected,
    }
    result = sb.table("debates").upsert(data).execute()
    return result.data[0] if result.data else {}


async def get_debate(debate_id: str) -> dict | None:
    try:
        result = get_supabase().table("debates").select("*").eq("id", debate_id).single().execute()
        return result.data
    except Exception as e:
        logger.error(f"[DB] get_debate failed: {e}")
        return None


async def list_debates(user_id: str, page: int = 1, limit: int = 20) -> tuple[list[dict], int]:
    sb     = get_supabase()
    offset = (page - 1) * limit
    result = (
        sb.table("debates")
        .select("id,topic,status,consensus_score,current_round,max_rounds,winner_role,tags,personal_context_detected,created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    count  = sb.table("debates").select("id", count="exact").eq("user_id", user_id).execute()
    return result.data or [], count.count or 0


async def update_debate_status(debate_id: str, status: str, extra: dict = {}):
    get_supabase().table("debates").update({"status": status, **extra}).eq("id", debate_id).execute()


async def delete_debate(debate_id: str):
    sb = get_supabase()
    sb.table("debate_turns").delete().eq("debate_id", debate_id).execute()
    sb.table("checkpoints").delete().eq("debate_id", debate_id).execute()
    sb.table("debates").delete().eq("id", debate_id).execute()


async def save_turn(turn: DebateTurn) -> dict:
    sb   = get_supabase()
    data = {
        "id":           turn.id,
        "debate_id":    turn.debate_id,
        "round":        turn.round,
        "agent_role":   turn.agent_role.value,
        "agent_name":   turn.agent_name,
        "content":      turn.content,
        "tool_calls":   [tc.model_dump(mode="json") for tc in turn.tool_calls],
        "score":        turn.score.model_dump(mode="json"),
        "embedding":    turn.embedding,
        "is_interrupt": turn.is_interrupt,
    }
    result = sb.table("debate_turns").insert(data).execute()
    return result.data[0] if result.data else {}


async def get_turns(debate_id: str) -> list[dict]:
    result = (
        get_supabase()
        .table("debate_turns")
        .select("*")
        .eq("debate_id", debate_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


async def save_checkpoint(debate_id: str, round_num: int, state: dict, label: str | None = None) -> dict:
    result = get_supabase().table("checkpoints").insert({
        "debate_id": debate_id, "round": round_num,
        "state_snapshot": state, "label": label,
    }).execute()
    return result.data[0] if result.data else {}


async def get_checkpoint(checkpoint_id: str) -> dict | None:
    try:
        result = get_supabase().table("checkpoints").select("*").eq("id", checkpoint_id).single().execute()
        return result.data
    except Exception:
        return None


async def list_checkpoints(debate_id: str) -> list[dict]:
    result = (
        get_supabase().table("checkpoints")
        .select("*").eq("debate_id", debate_id).order("round").execute()
    )
    return result.data or []


async def save_verdict(debate_id: str, verdict: JudgeVerdict):
    get_supabase().table("debates").update({
        "summary":     verdict.summary,
        "winner_role": verdict.winner.value if verdict.winner else None,
        "status":      "consensus_reached" if verdict.consensus_reached else "max_rounds_reached",
    }).eq("id", debate_id).execute()