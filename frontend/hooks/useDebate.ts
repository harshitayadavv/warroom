'use client'
import { useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { useDebateSocket } from './useWebSocket'
import type {
  Debate,
  DebateConfig,
  AgentRole,
  ThinkingEvent,
  SpeakingEvent,
  ToolCallEvent,
  ConsensusUpdateEvent,
  DebateTurn,
} from '@/lib/types'

export interface StreamingState {
  agentRole?: AgentRole
  thought: string
  speech: string
  isThinking: boolean
  isSpeaking: boolean
}

export function useDebate(debateId: string | null) {
  const [debate, setDebate] = useState<Debate | null>(null)
  const [streaming, setStreaming] = useState<StreamingState>({ thought: '', speech: '', isThinking: false, isSpeaking: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accumulatedSpeech = useRef('')

  const { connectionState, send, disconnect } = useDebateSocket(
    debateId,
    {
      debate_started: (payload) => {
        setDebate(payload as Debate)
      },

      round_started: (payload) => {
        const { round } = payload as { round: number }
        setDebate(prev => prev ? { ...prev, currentRound: round } : prev)
      },

      agent_thinking: (payload) => {
        const { agentRole, thought, isStreaming } = payload as ThinkingEvent
        setStreaming(prev => ({
          ...prev,
          agentRole,
          thought: isStreaming ? prev.thought + thought : thought,
          isThinking: true,
          isSpeaking: false,
        }))
      },

      agent_speaking: (payload) => {
        const { agentRole, content, isStreaming } = payload as SpeakingEvent
        if (isStreaming) {
          accumulatedSpeech.current += content
        } else {
          accumulatedSpeech.current = content
        }
        setStreaming(prev => ({
          ...prev,
          agentRole,
          speech: accumulatedSpeech.current,
          isThinking: false,
          isSpeaking: true,
        }))
      },

      agent_tool_call: (payload) => {
        const { agentRole, tool, status } = payload as ToolCallEvent
        setDebate(prev => {
          if (!prev) return prev
          const agents = { ...prev.agents }
          const agent = { ...agents[agentRole] }
          agent.toolsInUse = status === 'calling'
            ? [...agent.toolsInUse, tool]
            : agent.toolsInUse.filter(t => t !== tool)
          agents[agentRole] = agent
          return { ...prev, agents }
        })
      },

      turn_complete: (payload) => {
        const turn = payload as DebateTurn
        accumulatedSpeech.current = ''
        setStreaming({ thought: '', speech: '', isThinking: false, isSpeaking: false })
        setDebate(prev => prev ? {
          ...prev,
          transcript: [...prev.transcript, turn],
        } : prev)
      },

      consensus_update: (payload) => {
        const { score } = payload as ConsensusUpdateEvent
        setDebate(prev => prev ? { ...prev, consensusScore: score } : prev)
      },

      debate_paused: () => {
        setDebate(prev => prev ? { ...prev, status: 'paused' } : prev)
      },

      debate_complete: (payload) => {
        const data = payload as Partial<Debate>
        setDebate(prev => prev ? { ...prev, ...data, status: data.status ?? 'consensus_reached' } : prev)
      },

      error: (payload) => {
        const { message } = payload as { message: string }
        setError(message)
      },
    },
    { autoReconnect: debateId !== null }
  )

  const createDebate = useCallback(async (config: DebateConfig) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.debates.create(config)
      setDebate(res.data)
      return res.data
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const pauseDebate = useCallback(async () => {
    if (!debateId) return
    await api.debates.pause(debateId)
  }, [debateId])

  const resumeDebate = useCallback(async () => {
    if (!debateId) return
    await api.debates.resume(debateId)
  }, [debateId])

  const interruptDebate = useCallback(async (message: string, redirectType: 'evidence' | 'clarification' | 'challenge' | 'redirect') => {
    if (!debateId) return
    await api.debates.interrupt({ debateId, message, redirectType })
  }, [debateId])

  const sendMessage = useCallback((data: unknown) => {
    send(data)
  }, [send])

  return {
    debate,
    streaming,
    loading,
    error,
    connectionState,
    createDebate,
    pauseDebate,
    resumeDebate,
    interruptDebate,
    sendMessage,
    disconnect,
  }
}