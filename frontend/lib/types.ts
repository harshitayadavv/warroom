// LOCATION: frontend/lib/types.ts
// Added: StreamingState (used by debateStore.ts)

// ═══════════════════════════════════════════════════════════
// WARROOM — Core Type Definitions
// ═══════════════════════════════════════════════════════════

// ── Agent Types ─────────────────────────────────────────────

export type AgentRole = 'proponent' | 'opponent' | 'fact_checker' | 'moderator'
export type AgentStatus = 'idle' | 'thinking' | 'speaking' | 'searching' | 'computing' | 'done'

export interface AgentConfig {
  id: string
  role: AgentRole
  name: string
  model: string
  temperature: number
  expertiseLevel: 1 | 2 | 3 | 4 | 5
  temperament: 'aggressive' | 'balanced' | 'diplomatic' | 'analytical'
  systemPrompt?: string
  avatar?: string
}

export interface AgentState {
  config: AgentConfig
  status: AgentStatus
  currentThought?: string
  toolsInUse: string[]
  score: AgentScore
  lastAction?: string
  turnCount: number
}

export interface AgentScore {
  logicScore: number
  evidenceScore: number
  sentimentScore: number
  fallaciesDetected: Fallacy[]
  totalScore: number
}

// ── Streaming State ──────────────────────────────────────────
// Used by debateStore.ts and useDebate.ts

export interface StreamingState {
  agentRole?: AgentRole
  thought:    string
  speech:     string
  isThinking: boolean
  isSpeaking: boolean
}

// ── Debate Types ─────────────────────────────────────────────

export type DebateStatus =
  | 'configuring'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'interrupted'
  | 'consensus_reached'
  | 'max_rounds_reached'
  | 'error'

export interface DebateConfig {
  topic: string
  maxRounds: number
  agents: AgentConfig[]
  enableWebSearch: boolean
  enablePythonRepl: boolean
  enableHumanInterrupt: boolean
  consensusThreshold: number
  debateMode: 'adversarial' | 'collaborative' | 'socratic'
  context?: string
}

export interface Debate {
  id: string
  config: DebateConfig
  status: DebateStatus
  createdAt: string
  updatedAt: string
  currentRound: number
  agents: Record<AgentRole, AgentState>
  transcript: DebateTurn[]
  consensusScore: number
  consensusVector?: number[]
  winnerRole?: AgentRole
  summary?: string
  tags?: string[]
}

export interface DebateTurn {
  id: string
  debateId: string
  round: number
  agentRole: AgentRole
  agentName: string
  content: string
  timestamp: string
  toolCalls: ToolCall[]
  score: AgentScore
  embedding?: number[]
  isInterrupt?: boolean
  interruptBy?: 'user' | 'fact_checker'
}

// ── Checkpoint Types ──────────────────────────────────────────

export interface Checkpoint {
  id: string
  debateId: string
  round: number
  label: string
  createdAt: string
  stateSnapshot?: Record<string, unknown>
}

// ── Streaming / WebSocket Types ───────────────────────────────

export type WSEventType =
  | 'debate_started'
  | 'round_started'
  | 'agent_thinking'
  | 'agent_speaking'
  | 'agent_tool_call'
  | 'agent_tool_result'
  | 'turn_complete'
  | 'round_complete'
  | 'consensus_update'
  | 'debate_paused'
  | 'debate_interrupted'
  | 'debate_complete'
  | 'error'
  | 'ping'

export interface WSEvent {
  type: WSEventType
  debateId: string
  timestamp: string
  payload: unknown
}

export interface ThinkingEvent {
  agentRole: AgentRole
  thought: string
  isStreaming: boolean
}

export interface SpeakingEvent {
  agentRole: AgentRole
  content: string
  isStreaming: boolean
  turnId: string
}

export interface ToolCallEvent {
  agentRole: AgentRole
  tool: string
  input: Record<string, unknown>
  status: 'calling' | 'complete' | 'error'
  result?: unknown
}

export interface ConsensusUpdateEvent {
  score: number
  delta: number
  convergingAgents: AgentRole[]
}

// ── Tool Types ────────────────────────────────────────────────

export interface ToolCall {
  id: string
  tool: ToolName
  input: Record<string, unknown>
  output?: unknown
  durationMs?: number
  status: 'pending' | 'running' | 'success' | 'error'
  errorMessage?: string
}

export type ToolName =
  | 'web_search'
  | 'python_repl'
  | 'fact_check'
  | 'vector_similarity'
  | 'argument_score'

// ── Fallacy Types ─────────────────────────────────────────────

export interface Fallacy {
  type: FallacyType
  description: string
  severity: 'low' | 'medium' | 'high'
  quote: string
}

export type FallacyType =
  | 'ad_hominem'
  | 'straw_man'
  | 'false_dichotomy'
  | 'appeal_to_authority'
  | 'circular_reasoning'
  | 'slippery_slope'
  | 'hasty_generalization'
  | 'red_herring'
  | 'false_analogy'
  | 'appeal_to_emotion'

// ── Graph/Visualization Types ──────────────────────────────────

export interface GraphNode {
  id: string
  type: 'agent' | 'tool' | 'consensus' | 'interrupt' | 'start' | 'end'
  label: string
  status: 'idle' | 'active' | 'complete' | 'error'
  agentRole?: AgentRole
  position: { x: number; y: number }
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label?: string
  isActive?: boolean
  animating?: boolean
}

// ── API Response Types ─────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface CreateDebateRequest {
  config: DebateConfig
}

export interface InterruptRequest {
  debateId: string
  message: string
  redirectType: 'evidence' | 'clarification' | 'challenge' | 'redirect'
}

// ── History Types ──────────────────────────────────────────────

export interface DebateSummary {
  id: string
  topic: string
  status: DebateStatus
  createdAt: string
  duration?: number
  rounds: number
  consensusScore: number
  winnerRole?: AgentRole
  tags?: string[]
  personal_context_detected?: boolean
}

// ── UI State Types ─────────────────────────────────────────────

export interface DebateUIState {
  selectedTurnId?: string
  showGraph: boolean
  showScoring: boolean
  showAgentConfig: boolean
  interruptModalOpen: boolean
  streamingAgentRole?: AgentRole
  graphLayout: 'horizontal' | 'vertical' | 'radial'
}