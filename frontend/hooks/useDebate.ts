'use client'
// LOCATION: frontend/hooks/useDebate.ts
// ROOT FIX: debate_started never arrives on WS because the WS connects
// AFTER the debate is already running. We accept an initialDebate prop
// from the REST load so state is never null when turn_complete arrives.

import { useState, useCallback, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Debate, AgentRole, DebateTurn, AgentState, AgentScore } from '@/lib/types'

export interface StreamingState {
  agentRole?: AgentRole
  thought:    string
  speech:     string
  isThinking: boolean
  isSpeaking: boolean
}

const EMPTY: StreamingState = { thought: '', speech: '', isThinking: false, isSpeaking: false }

// ─── Normalizers ────────────────────────────────────────────────────────────

function normalizeScore(s: any): AgentScore {
  if (!s) return { logicScore: 0, evidenceScore: 0, sentimentScore: 0, fallaciesDetected: [], totalScore: 0 }
  return {
    logicScore:        s.logic_score        ?? s.logicScore        ?? 0,
    evidenceScore:     s.evidence_score     ?? s.evidenceScore     ?? 0,
    sentimentScore:    s.sentiment_score    ?? s.sentimentScore    ?? 0,
    totalScore:        s.total_score        ?? s.totalScore        ?? 0,
    fallaciesDetected: s.fallacies_detected ?? s.fallaciesDetected ?? [],
  }
}

function normalizeAgentState(a: any): AgentState {
  const cfg = a.config ?? {}
  return {
    config: {
      id:             cfg.id             ?? '',
      role:           cfg.role           ?? '',
      name:           cfg.name           ?? '',
      model:          cfg.model          ?? '',
      temperature:    cfg.temperature    ?? 0.7,
      expertiseLevel: cfg.expertise_level ?? cfg.expertiseLevel ?? 4,
      temperament:    cfg.temperament    ?? 'balanced',
      systemPrompt:   cfg.system_prompt  ?? cfg.systemPrompt,
    },
    status:         a.status           ?? 'idle',
    currentThought: a.current_thought  ?? a.currentThought,
    toolsInUse:     a.tools_in_use     ?? a.toolsInUse     ?? [],
    score:          normalizeScore(a.score),
    turnCount:      a.turn_count       ?? a.turnCount      ?? 0,
  }
}

function normalizeAgents(raw: any): Record<AgentRole, AgentState> {
  if (!raw) return {} as any
  const out: any = {}
  for (const [k, v] of Object.entries(raw)) {
    out[k] = normalizeAgentState(v)
  }
  return out
}

export function normalizeTurn(t: any): DebateTurn {
  return {
    id:          t.id          ?? '',
    debateId:    t.debateId    ?? t.debate_id   ?? '',
    round:       t.round       ?? 0,
    agentRole:   t.agentRole   ?? t.agent_role  ?? '',
    agentName:   t.agentName   ?? t.agent_name  ?? '',
    content:     t.content     ?? '',
    timestamp:   t.timestamp   ?? t.createdAt   ?? t.created_at ?? '',
    toolCalls:   t.toolCalls   ?? t.tool_calls  ?? [],
    score:       normalizeScore(t.score),
    isInterrupt: t.isInterrupt ?? t.is_interrupt ?? false,
  }
}

export function normalizeDebate(p: any): Debate {
  const cfg = p.config ?? {}
  return {
    id:             p.id ?? '',
    config: {
      topic:                cfg.topic                 ?? '',
      maxRounds:            cfg.max_rounds            ?? cfg.maxRounds            ?? 5,
      agents:               cfg.agents                ?? [],
      enableWebSearch:      cfg.enable_web_search     ?? cfg.enableWebSearch     ?? false,
      enablePythonRepl:     cfg.enable_python_repl    ?? cfg.enablePythonRepl    ?? false,
      enableHumanInterrupt: cfg.enable_human_interrupt ?? cfg.enableHumanInterrupt ?? false,
      consensusThreshold:   cfg.consensus_threshold   ?? cfg.consensusThreshold  ?? 0.85,
      debateMode:           cfg.debate_mode           ?? cfg.debateMode          ?? 'adversarial',
    },
    status:         p.status          ?? 'initializing',
    createdAt:      p.created_at      ?? p.createdAt      ?? '',
    updatedAt:      p.updated_at      ?? p.updatedAt      ?? '',
    currentRound:   p.current_round   ?? p.currentRound   ?? 0,
    agents:         normalizeAgents(p.agents),
    transcript:     (p.transcript ?? []).map(normalizeTurn),
    consensusScore: p.consensus_score ?? p.consensusScore ?? 0,
    winnerRole:     p.winner_role     ?? p.winnerRole,
    summary:        p.summary,
    tags:           p.tags            ?? [],
  } as Debate
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDebate(
  debateId:      string | null,
  token?:        string | null,
  initialDebate?: Debate | null,   // ← NEW: seed from REST so state is never null
) {
  // ── CRITICAL FIX ────────────────────────────────────────────────────────
  // Previously: debate started as null, WS connected, debate_started event
  // was never received (backend doesn't re-send it), so every turn_complete
  // ran with prev===null and was silently dropped.
  // Fix: seed with initialDebate from REST API — state is populated before
  // the first WS event arrives.
  const [debate,    setDebate]    = useState<Debate | null>(initialDebate ?? null)
  const [streaming, setStreaming] = useState<StreamingState>(EMPTY)
  const [connState, setConnState] = useState<'connecting'|'open'|'closed'|'error'>('closed')

  const speechBuf = useRef('')
  const wsRef     = useRef<WebSocket | null>(null)
  const alive     = useRef(true)
  const retryRef  = useRef<ReturnType<typeof setTimeout>>()

  // When initialDebate arrives (REST resolves), seed state if still null
  useEffect(() => {
    if (initialDebate) {
      setDebate(prev => prev ?? initialDebate)
    }
  }, [initialDebate])

  const connect = useCallback(() => {
    if (!debateId || !alive.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/^http/, 'ws')
    const ws   = new WebSocket(`${base}/ws/debates/${debateId}`)
    wsRef.current = ws
    setConnState('connecting')

    ws.onopen  = () => alive.current && setConnState('open')
    ws.onerror = () => alive.current && setConnState('error')
    ws.onclose = () => {
      if (!alive.current) return
      setConnState('closed')
      retryRef.current = setTimeout(connect, 2500)
    }

    ws.onmessage = ({ data }: MessageEvent) => {
      if (!alive.current) return
      let evt: { type: string; payload: any }
      try { evt = JSON.parse(data) } catch { return }
      const p = evt.payload ?? {}

      switch (evt.type) {

        case 'debate_started':
          // Only use if we don't already have a debate seeded from REST
          setDebate(prev => prev ?? normalizeDebate(p))
          break

        case 'round_started':
          setDebate(prev => prev
            ? { ...prev, currentRound: p.round ?? p.current_round ?? prev.currentRound }
            : prev
          )
          break

        case 'agent_thinking':
          setStreaming(prev => ({
            ...prev,
            agentRole:  p.agentRole  ?? p.agent_role,
            thought:    (p.isStreaming ?? p.is_streaming)
              ? prev.thought + (p.thought ?? '')
              : (p.thought ?? ''),
            isThinking: true,
            isSpeaking: false,
          }))
          break

        case 'agent_speaking': {
          const role    = p.agentRole ?? p.agent_role
          const chunk   = p.content   ?? ''
          const isChunk = p.isStreaming ?? p.is_streaming ?? true
          if (isChunk) {
            speechBuf.current += chunk
          } else {
            speechBuf.current = chunk
          }
          setStreaming({
            agentRole:  role,
            speech:     speechBuf.current,
            thought:    '',
            isThinking: false,
            isSpeaking: true,
          })
          break
        }

        case 'turn_complete': {
          const turn = normalizeTurn(p)

          setDebate(prev => {
            if (!prev) {
              // Still null somehow — build a minimal shell so we can add the turn
              console.warn('[useDebate] turn_complete received before debate state was seeded — this should not happen now')
              return prev
            }

            const existing = Array.isArray(prev.transcript) ? prev.transcript : []
            const turnKey  = turn.id || `${turn.agentRole}-r${turn.round}`
            const isDupe   = existing.some(t => (t.id || `${t.agentRole}-r${t.round}`) === turnKey)

            // Always update agent score
            const agents = { ...prev.agents }
            const role   = turn.agentRole as AgentRole
            if (agents[role]) {
              agents[role] = {
                ...agents[role],
                score:     turn.score,
                turnCount: (agents[role].turnCount ?? 0) + (isDupe ? 0 : 1),
                status:    'done',
              }
            }

            if (isDupe) return { ...prev, agents }

            return { ...prev, agents, transcript: [...existing, turn] }
          })

          // Clear streaming bubble 80ms after state update queued
          // so React has time to render the completed bubble first
          setTimeout(() => {
            speechBuf.current = ''
            setStreaming(EMPTY)
          }, 80)
          break
        }

        case 'round_complete':
          setDebate(prev => prev
            ? { ...prev, currentRound: p.round ?? (prev.currentRound + 1) }
            : prev
          )
          speechBuf.current = ''
          setStreaming(EMPTY)
          break

        case 'consensus_update':
          setDebate(prev => prev
            ? { ...prev, consensusScore: p.score ?? p.consensus_score ?? prev.consensusScore }
            : prev
          )
          break

        case 'agent_tool_call': {
          const role = (p.agentRole ?? p.agent_role) as AgentRole
          setDebate(prev => {
            if (!prev?.agents?.[role]) return prev
            const agent = prev.agents[role]
            const tools = agent.toolsInUse ?? []
            return {
              ...prev,
              agents: {
                ...prev.agents,
                [role]: {
                  ...agent,
                  toolsInUse: p.status === 'calling'
                    ? [...tools, p.tool]
                    : tools.filter((t: string) => t !== p.tool),
                },
              },
            }
          })
          break
        }

        case 'debate_paused':
          setDebate(prev => prev ? { ...prev, status: 'paused' } : prev)
          speechBuf.current = ''
          setStreaming(EMPTY)
          break

        case 'debate_interrupted':
          setDebate(prev => prev ? { ...prev, status: 'running' } : prev)
          break

        case 'verdict_ready':
        case 'debate_complete':
          speechBuf.current = ''
          setStreaming(EMPTY)
          setDebate(prev => {
            if (!prev) return normalizeDebate(p)
            return {
              ...prev,
              status:         p.status          ?? 'consensus_reached',
              currentRound:   p.current_round   ?? p.currentRound   ?? prev.currentRound,
              consensusScore: p.consensus_score ?? p.consensusScore ?? prev.consensusScore,
              winnerRole:     p.winner_role     ?? p.winnerRole     ?? prev.winnerRole,
            }
          })
          break
      }
    }
  }, [debateId])

  useEffect(() => {
    alive.current = true
    if (debateId) connect()
    return () => {
      alive.current = false
      clearTimeout(retryRef.current)
      wsRef.current?.close()
    }
  }, [debateId, connect])

  const pauseDebate = useCallback(async () => {
    if (!debateId) return
    try {
      await api.debates.pause(debateId, token ?? undefined)
      setDebate(prev => prev ? { ...prev, status: 'paused' } : prev)
    } catch (e) { console.error('pause failed', e) }
  }, [debateId, token])

  const resumeDebate = useCallback(async () => {
    if (!debateId) return
    try {
      await api.debates.resume(debateId, token ?? undefined)
      setDebate(prev => prev ? { ...prev, status: 'running' } : prev)
    } catch (e) { console.error('resume failed', e) }
  }, [debateId, token])

  const interruptDebate = useCallback(async (
    message:      string,
    redirectType: 'evidence' | 'clarification' | 'challenge' | 'redirect',
  ) => {
    if (!debateId) return
    await api.debates.interrupt(debateId, message, redirectType, token ?? undefined)
  }, [debateId, token])

  return { debate, streaming, connectionState: connState, pauseDebate, resumeDebate, interruptDebate }
}