'use client'
// LOCATION: frontend/app/debate/[id]/page.tsx

import { useEffect, useState } from 'react'
import { useDebate } from '@/hooks/useDebate'
import { DebateFeed } from '@/components/debate/DebateFeed'
import { AgentCard } from '@/components/agents/AgentCard'
import { ConsensusGauge } from '@/components/dashboard/ConsensusGauge'
import { InterruptModal } from '@/components/debate/InterruptModal'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Debate } from '@/lib/types'

// ✅ Next.js 14 — params is a plain object, NOT a Promise
// Do NOT use `use(params)` — that's Next.js 15+ only
interface PageProps {
  params: { id: string }
}

export default function DebateArenaPage({ params }: PageProps) {
  const id = params.id   // ✅ direct access, no `use()` needed
  const { accessToken }  = useAuth()

  const {
    debate,
    streaming,
    connectionState,
    pauseDebate,
    resumeDebate,
    interruptDebate,
  } = useDebate(id)

  const [initialDebate, setInitialDebate]   = useState<Debate | null>(null)
  const [interruptOpen, setInterruptOpen]   = useState(false)
  const [selectedTurnId, setSelectedTurnId] = useState<string | undefined>()

  // Fetch initial debate state on mount
  useEffect(() => {
    if (!id) return
    api.debates.get(id, accessToken ?? undefined)
      .then(r => setInitialDebate(r.data))
      .catch(() => {})
  }, [id, accessToken])

  const activeDebate = debate ?? initialDebate

  const isRunning = activeDebate?.status === 'running'
  const isPaused  = activeDebate?.status === 'paused'
  const isDone    = ['consensus_reached', 'max_rounds_reached', 'error'].includes(activeDebate?.status ?? '')

  const handleInterrupt = async (
    message: string,
    type: 'evidence' | 'clarification' | 'challenge' | 'redirect'
  ) => {
    await interruptDebate(message, type)
    setInterruptOpen(false)
  }

  if (!activeDebate) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--amber)', animation: 'pulse-dot 1.5s ease-in-out infinite' }}>⚔</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>
          INITIALIZING DEBATE...
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
          WS: {connectionState.toUpperCase()}
        </div>
      </div>
    )
  }

  const agentList = Object.values(activeDebate.agents ?? {})

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto auto 1fr', background: 'var(--bg-void)', overflow: 'hidden' }}>

      {/* Top info bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '10px 20px',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
      }}>
        {/* Topic */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--amber)', letterSpacing: '0.2em', marginBottom: '2px' }}>
            {activeDebate.personal_context_detected ? '👤 PERSONAL DECISION' : '🌍 PROPOSITION'}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.3 }}>
            {activeDebate.config.topic}
          </div>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '2px' }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: isRunning ? 'var(--green-lock)' : isPaused ? 'var(--amber)' : isDone ? 'var(--blue-data)' : 'var(--text-muted)',
            boxShadow: isRunning ? '0 0 6px var(--green-lock)' : 'none',
            animation: isRunning ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {activeDebate.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Round */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          R{activeDebate.current_round}/{activeDebate.config.maxRounds}
        </div>

        {/* WS indicator */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: connectionState === 'open' ? 'var(--green-lock)' : 'var(--red-hot)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          WS
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isRunning && (
            <CtrlBtn label="⏸ Pause" color="var(--text-secondary)" onClick={pauseDebate} />
          )}
          {isPaused && (
            <CtrlBtn label="▶ Resume" color="var(--green-lock)" onClick={resumeDebate} />
          )}
          {(isRunning || isPaused) && activeDebate.config.enableHumanInterrupt && (
            <CtrlBtn label="⚡ Interrupt" color="var(--amber)" onClick={() => setInterruptOpen(true)} />
          )}
        </div>
      </div>

      {/* Main 3-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 200px', height: 'calc(100vh - 52px - 56px)', overflow: 'hidden' }}>

        {/* ── LEFT: Agents ── */}
        <div style={{ borderRight: '1px solid var(--border-subtle)', overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '4px' }}>AGENTS</div>
          {agentList.map(agent => (
            <AgentCard
              key={agent.config.id}
              agent={agent}
              isActive={streaming.agentRole === agent.config.role && (streaming.isThinking || streaming.isSpeaking)}
              currentThought={streaming.agentRole === agent.config.role ? streaming.thought : undefined}
            />
          ))}
        </div>

        {/* ── CENTER: Feed ── */}
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>TRANSCRIPT</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>{(activeDebate?.transcript ?? []).length} TURNS</span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <DebateFeed
              turns={activeDebate.transcript}
              streaming={streaming}
              selectedTurnId={selectedTurnId}
              onSelectTurn={setSelectedTurnId}
            />
          </div>
        </div>

        {/* ── RIGHT: Metrics ── */}
        <div style={{ borderLeft: '1px solid var(--border-subtle)', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.2em', width: '100%' }}>METRICS</div>

          <ConsensusGauge
            score={activeDebate.consensusScore}
            threshold={activeDebate.config.consensusThreshold}
            round={activeDebate.current_round}
            maxRounds={activeDebate.config.maxRounds}
          />

          {/* Leaderboard */}
          <div style={{ width: '100%' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: '8px' }}>SCORES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {agentList
                .sort((a, b) => b.score.totalScore - a.score.totalScore)
                .map((agent, idx) => {
                  const colors: Record<string, string> = { proponent: '#00ff88', opponent: '#ff3c3c', fact_checker: '#f5a623', moderator: '#1e90ff' }
                  const icons: Record<string, string>  = { proponent: '▲', opponent: '▼', fact_checker: '◆', moderator: '◉' }
                  const color = colors[agent.config.role] ?? 'var(--text-muted)'
                  return (
                    <div key={agent.config.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: 'var(--bg-elevated)', borderRadius: '2px', border: '1px solid var(--border-dim)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', width: '10px' }}>#{idx+1}</span>
                      <span style={{ color, fontSize: '10px' }}>{icons[agent.config.role]}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.config.name}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, color }}>{Math.round(agent.score.totalScore)}</span>
                    </div>
                  )
              })}
            </div>
          </div>

          {/* Mode */}
          <div style={{ width: '100%', padding: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '2px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '2px' }}>MODE</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--amber)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {activeDebate.config.debateMode}
            </div>
          </div>
        </div>
      </div>

      {/* Interrupt modal */}
      <InterruptModal
        isOpen={interruptOpen}
        onClose={() => setInterruptOpen(false)}
        onSubmit={handleInterrupt}
      />
    </div>
  )
}

function CtrlBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        background: 'transparent',
        border: `1px solid ${color}55`,
        borderRadius: '2px', color,
        fontFamily: 'var(--font-display)',
        fontSize: '10px', letterSpacing: '0.12em',
        textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}11`; e.currentTarget.style.borderColor = color }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `${color}55` }}
    >
      {label}
    </button>
  )
}