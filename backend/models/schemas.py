# LOCATION: backend/models/schemas.py

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, Literal, Any
from datetime import datetime
from uuid import uuid4
from enum import Enum


class AgentRole(str, Enum):
    proponent    = "proponent"
    opponent     = "opponent"
    fact_checker = "fact_checker"
    moderator    = "moderator"

class AgentStatus(str, Enum):
    idle = "idle"; thinking = "thinking"; speaking = "speaking"
    searching = "searching"; computing = "computing"; done = "done"

class DebateStatus(str, Enum):
    configuring = "configuring"; initializing = "initializing"
    running = "running"; paused = "paused"; interrupted = "interrupted"
    consensus_reached = "consensus_reached"; max_rounds_reached = "max_rounds_reached"
    error = "error"

class DebateMode(str, Enum):
    adversarial = "adversarial"; collaborative = "collaborative"; socratic = "socratic"

class Temperament(str, Enum):
    aggressive = "aggressive"; balanced = "balanced"
    diplomatic = "diplomatic"; analytical = "analytical"

class FallacyType(str, Enum):
    ad_hominem = "ad_hominem"; straw_man = "straw_man"
    false_dichotomy = "false_dichotomy"; appeal_to_authority = "appeal_to_authority"
    circular_reasoning = "circular_reasoning"; slippery_slope = "slippery_slope"
    hasty_generalization = "hasty_generalization"; red_herring = "red_herring"
    false_analogy = "false_analogy"; appeal_to_emotion = "appeal_to_emotion"

class RedirectType(str, Enum):
    evidence = "evidence"; clarification = "clarification"
    challenge = "challenge"; redirect = "redirect"


class AgentConfig(BaseModel):
    id:              str         = Field(default_factory=lambda: str(uuid4()))
    role:            AgentRole
    name:            str
    model:           str         = "llama-3.3-70b-versatile"
    temperature:     float       = Field(0.7, ge=0.0, le=1.0)
    expertise_level: int         = Field(4, ge=1, le=5)
    temperament:     Temperament = Temperament.balanced
    system_prompt:   Optional[str] = None

class Fallacy(BaseModel):
    type:        FallacyType
    description: str
    severity:    Literal["low", "medium", "high"]
    quote:       str = ""

class AgentScore(BaseModel):
    logic_score:        float         = 0.0
    evidence_score:     float         = 0.0
    sentiment_score:    float         = 0.0
    fallacies_detected: list[Fallacy] = []
    total_score:        float         = 0.0
    confidence:         float         = 0.0
    stance_vector:      float         = 0.0

class ToolCall(BaseModel):
    id:          str             = Field(default_factory=lambda: str(uuid4()))
    tool:        str
    input:       dict[str, Any]  = {}
    output:      Optional[Any]   = None
    duration_ms: Optional[int]   = None
    status:      Literal["pending","running","success","error"] = "pending"
    error_msg:   Optional[str]   = None

class AgentState(BaseModel):
    config:          AgentConfig
    status:          AgentStatus   = AgentStatus.idle
    current_thought: Optional[str] = None
    tools_in_use:    list[str]     = []
    score:           AgentScore    = Field(default_factory=AgentScore)
    turn_count:      int           = 0

class DebateConfig(BaseModel):
    topic:                  str
    max_rounds:             int        = Field(5, ge=2, le=20)
    agents:                 list[AgentConfig]
    enable_web_search:      bool       = True
    enable_python_repl:     bool       = True
    enable_human_interrupt: bool       = True
    consensus_threshold:    float      = Field(0.85, ge=0.5, le=1.0)
    debate_mode:            DebateMode = DebateMode.adversarial
    context:                Optional[str] = None

class DebateTurn(BaseModel):
    id:           str       = Field(default_factory=lambda: str(uuid4()))
    debate_id:    str
    round:        int
    agent_role:   AgentRole
    agent_name:   str
    content:      str
    timestamp:    datetime  = Field(default_factory=datetime.utcnow)
    tool_calls:   list[ToolCall]       = []
    score:        AgentScore           = Field(default_factory=AgentScore)
    embedding:    Optional[list[float]] = None
    is_interrupt: bool      = False

class Debate(BaseModel):
    id:                        str          = Field(default_factory=lambda: str(uuid4()))
    user_id:                   Optional[str] = None
    config:                    DebateConfig
    status:                    DebateStatus  = DebateStatus.initializing
    created_at:                datetime      = Field(default_factory=datetime.utcnow)
    updated_at:                datetime      = Field(default_factory=datetime.utcnow)
    current_round:             int           = 0
    agents:                    dict[str, AgentState] = {}
    transcript:                list[DebateTurn]      = []
    consensus_score:           float         = 0.0
    winner_role:               Optional[AgentRole]  = None
    summary:                   Optional[str]        = None
    tags:                      list[str]     = []
    personal_context_detected: bool          = False

class JudgeVerdict(BaseModel):
    winner:                    Optional[AgentRole]
    winner_name:               str
    summary:                   str
    key_arguments:             list[str]
    consensus_reached:         bool
    final_consensus_score:     float
    total_fallacies:           dict[str, int]
    recommendation:            str
    confidence_in_verdict:     int
    debate_duration_sec:       int
    total_rounds:              int
    personal_context_detected: bool

class WSEventType(str, Enum):
    debate_started = "debate_started"; round_started = "round_started"
    agent_thinking = "agent_thinking"; agent_speaking = "agent_speaking"
    agent_tool_call = "agent_tool_call"; agent_tool_result = "agent_tool_result"
    turn_complete = "turn_complete"; round_complete = "round_complete"
    consensus_update = "consensus_update"; debate_paused = "debate_paused"
    debate_interrupted = "debate_interrupted"; debate_complete = "debate_complete"
    verdict_ready = "verdict_ready"; approval_required = "approval_required"
    error = "error"; ping = "ping"

class WSEvent(BaseModel):
    type:      WSEventType
    debate_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload:   Any      = None

class CreateDebateRequest(BaseModel):
    config:  DebateConfig
    user_id: Optional[str] = None

class InterruptRequest(BaseModel):
    debate_id: str; message: str; redirect_type: RedirectType

class ApprovalResponse(BaseModel):
    request_id: str; approved: bool; reason: Optional[str] = None

class DebateSummary(BaseModel):
    id:              str
    topic:           str
    status:          DebateStatus
    created_at:      datetime
    rounds:          int
    consensus_score: float
    winner_role:     Optional[AgentRole] = None
    tags:            list[str]           = []
    personal_context_detected: bool      = False

class ApiResponse(BaseModel):
    data: Any; error: Optional[str] = None; message: Optional[str] = None

class PaginatedResponse(BaseModel):
    data: list[Any]; total: int; page: int; limit: int; has_more: bool