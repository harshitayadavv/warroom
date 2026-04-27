'use client'
// LOCATION: frontend/hooks/useDebate.ts
// Complete rewrite — manages WebSocket directly, no intermediate hook.
// FIXES:
// 1. Speech never disappears — completed turns accumulate permanently
// 2. Rounds update live
// 3. Scores update live after each turn
// 4. Pause/resume works with auth token
// 5. Speech chunks accumulate correctly in useRef

import { useState, useCallback, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Debate, AgentRole, DebateTurn, AgentScore } from '@/lib/types'

export interface StreamingState {
  agentRole?: AgentRole
  thought:    string
  speech:     string
  isThinking: boolean
  isSpeaking: boolean
}

const EMPTY_STREAM: StreamingState = {
  thought: '', speech: '', isThinking: false, isSpeaking: false,
}

export function useDebate(debateId: string | null, token?: string | null) {
  const [debate,    setDebate]    = useState<Debate | null>(null)
  const [streaming, setStreaming] = useState<StreamingState>(EMPTY_STREAM)
  const [wsStatus,  setWsStatus]  = useState<'connecting' | 'open' | 'closed' | 'error'>('closed')

  // Speech accumulator — never loses chunks even under React batching
  const speechAccum = useRef<string>('')
  const wsRef       = useRef<WebSocket | null>(null)
  const mounted     = useRef<boolean>(false)

  // ── Connect ──────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!debateId || !mounted.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const wsBase = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/^http/, 'ws')
    const ws     = new WebSocket(`${wsBase}/ws/debates/${debateId}`)
    wsRef.current = ws

    setWsStatus('connecting')

    ws.onopen = () => { if (mounted.current) setWsStatus('open') }

    ws.onerror = () => { if (mounted.current) setWsStatus('error') }

    ws.onclose = () => {
      if (!mounted.current) return
      setWsStatus('closed')
      // Reconnect after 2 seconds
      setTimeout(() => { if (mounted.current) connect() }, 2000)
    }

    ws.onmessage = (evt: MessageEvent) => {
      if (!mounted.current) return
      let msg: { type: string; payload: Record<string, unknown> }
      try { msg = JSON.parse(evt.data) } catch { return }

      const { type, payload: p } = msg

      switch (type) {

        // Full debate object sent when debate starts
        case 'debate_started':
          setDebate(p as unknown as Debate)
          break

        // Round number ticked up
        case 'round_started':
          setDebate(prev =>
            prev ? { ...prev, current_round: p.round as number } : prev
          )
          break

        // Agent is thinking (brief status shown in agent card)
        case 'agent_thinking':
          setStreaming(prev => ({
            ...prev,
            agentRole:  p.agentRole as AgentRole,
            thought:    prev.thought + ((p.thought as string) ?? ''),
            isThinking: true,
            isSpeaking: false,
          }))
          break

        // Streaming text chunk arrives — accumulate in ref THEN snapshot to state
        case 'agent_speaking':
          if (p.isStreaming) {
            speechAccum.current += (p.content as string) ?? ''
          } else {
            speechAccum.current = (p.content as string) ?? ''
          }
          // Take a snapshot so React sees the full string
          const snap = speechAccum.current
          setStreaming(prev => ({
            ...prev,
            agentRole:  p.agentRole as AgentRole,
            speech:     snap,
            isThinking: false,
            isSpeaking: true,
          }))
          break

        // Turn finished — add to transcript permanently, reset stream
        case 'turn_complete': {
          const turn = p as unknown as DebateTurn
          // 1. Add turn to transcript + update that agent's score
          setDebate(prev => {
            if (!prev) return prev
            // Avoid duplicate turns
            const existing  = Array.isArray(prev.transcript) ? prev.transcript : []
            const isDuplicate = existing.some(t => t.id === turn.id)

            // Update agent score in agents map
            const agents = prev.agents ? { ...prev.agents } : {}
            if (turn.agentRole && agents[turn.agentRole]) {
              agents[turn.agentRole] = {
                ...agents[turn.agentRole],
                score:     turn.score,
                turnCount: (agents[turn.agentRole].turnCount ?? 0) + 1,
                status:    'done',
              }
            }

            return {
              ...prev,
              agents,
              transcript: isDuplicate ? existing : [...existing, turn],
            }
          })
          // 2. THEN clear streaming (order matters!)
          speechAccum.current = ''
          setStreaming(EMPTY_STREAM)
          break
        }

        // Moderator scored the round
        case 'round_complete':
          setDebate(prev =>
            prev ? { ...prev, current_round: (p.round as number) ?? (prev.current_round ?? 0) + 1 } : prev
          )
          speechAccum.current = ''
          setStreaming(EMPTY_STREAM)
          break

        // Consensus score updated — right panel live metric
        case 'consensus_update':
          setDebate(prev =>
            prev ? { ...prev, consensusScore: (p.score as number) ?? 0 } : prev
          )
          break

        // Agent called a tool — update toolsInUse for that agent card
        case 'agent_tool_call':
          setDebate(prev => {
            if (!prev?.agents) return prev
            const role  = p.agentRole as string
            const agent = prev.agents[role]
            if (!agent) return prev
            const tools    = Array.isArray(agent.toolsInUse) ? agent.toolsInUse : []
            const newTools = p.status === 'calling'
              ? [...tools, p.tool as string]
              : tools.filter((t: string) => t !== p.tool)
            return {
              ...prev,
              agents: {
                ...prev.agents,
                [role]: { ...agent, toolsInUse: newTools, status: p.status === 'calling' ? 'searching' : 'speaking' },
              },
            }
          })
          break

        // Backend paused between turns
        case 'debate_paused':
          setDebate(prev => prev ? { ...prev, status: 'paused' } : prev)
          break

        // Human interrupt injected
        case 'debate_interrupted':
          setDebate(prev => prev ? { ...prev, status: 'running' } : prev)
          break

        // Verdict from judge
        case 'verdict_ready':
          speechAccum.current = ''
          setStreaming(EMPTY_STREAM)
          setDebate(prev => prev ? { ...prev, ...(p as unknown as Partial<Debate>) } : prev)
          break

        // Debate fully ended
        case 'debate_complete':
          speechAccum.current = ''
          setStreaming(EMPTY_STREAM)
          setDebate(prev => prev
            ? { ...prev, ...(p as unknown as Partial<Debate>), status: (p.status as Debate['status']) ?? 'consensus_reached' }
            : prev
          )
          break
      }
    }
  }, [debateId])

  useEffect(() => {
    mounted.current = true
    if (debateId) connect()
    return () => {
      mounted.current = false
      wsRef.current?.close()
    }
  }, [debateId, connect])

  // ── Actions ──────────────────────────────────────────────────

  const pauseDebate = useCallback(async () => {
    if (!debateId) return
    try {
      await api.debates.pause(debateId, token ?? undefined)
      setDebate(prev => prev ? { ...prev, status: 'paused' } : prev)
    } catch (e) {
      console.error('[useDebate] pause failed:', e)
    }
  }, [debateId, token])

  const resumeDebate = useCallback(async () => {
    if (!debateId) return
    try {
      await api.debates.resume(debateId, token ?? undefined)
      setDebate(prev => prev ? { ...prev, status: 'running' } : prev)
    } catch (e) {
      console.error('[useDebate] resume failed:', e)
    }
  }, [debateId, token])

  const interruptDebate = useCallback(async (
    message:      string,
    redirectType: 'evidence' | 'clarification' | 'challenge' | 'redirect',
  ) => {
    if (!debateId) return
    await api.debates.interrupt(debateId, message, redirectType, token ?? undefined)
  }, [debateId, token])

  return {
    debate,
    streaming,
    connectionState: wsStatus,
    pauseDebate,
    resumeDebate,
    interruptDebate,
  }
}