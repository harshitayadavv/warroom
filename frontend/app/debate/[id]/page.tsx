'use client'
// LOCATION: frontend/app/debate/[id]/page.tsx

import { useEffect, useState } from 'react'
import { useAuth }                    from '@/hooks/useAuth'
import { useDebate, normalizeDebate } from '@/hooks/useDebate'
import { DebateFeed }                 from '@/components/debate/DebateFeed'
import { AgentCard }                  from '@/components/agents/AgentCard'
import { LiveMetricsPanel }           from '@/components/dashboard/LiveMetricsPanel'
import { InterruptModal }             from '@/components/debate/InterruptModal'
import { api }                        from '@/lib/api'
import type { Debate }                from '@/lib/types'

interface PageProps { params: { id: string } }

export default function DebateArenaPage({ params }: PageProps) {
  const { id }          = params
  const { accessToken } = useAuth()

  // ── Seed state from REST before WS connects ─────────────────────────────
  // The backend emits debate_started only once at the very beginning.
  // By the time the frontend WS connects, that event is already gone.
  // We load via REST first so useDebate's state is never null when
  // turn_complete events arrive.
  const [initialDebate, setInitialDebate] = useState<Debate | null>(null)

  useEffect(() => {
    if (!id) return
    api.debates.get(id, accessToken ?? undefined)
      .then(r => { if (r?.data) setInitialDebate(normalizeDebate(r.data)) })
      .catch(() => {})
  }, [id, accessToken])

  const {
    debate,
    streaming,
    connectionState,
    pauseDebate,
    resumeDebate,
    interruptDebate,
  } = useDebate(id, accessToken, initialDebate)

  const [interruptOpen, setInterruptOpen] = useState(false)
  const [selectedTurn,  setSelectedTurn]  = useState<string | undefined>()

  const d         = debate
  const turns     = Array.isArray(d?.transcript) ? d!.transcript : []
  const agents    = d?.agents    ?? {}
  const agentList = Object.values(agents) as any[]
  const maxRounds = (d?.config as any)?.maxRounds ?? (d?.config as any)?.max_rounds ?? 5
  const curRound  = d?.currentRound ?? 0
  const consensus = d?.consensusScore ?? 0
  const threshold = (d?.config as any)?.consensusThreshold ?? (d?.config as any)?.consensus_threshold ?? 0.85
  const isRunning = d?.status === 'running'
  const isPaused  = d?.status === 'paused'
  const isDone    = ['consensus_reached', 'max_rounds_reached'].includes(d?.status ?? '')

  // ── Loading screen ───────────────────────────────────────────────────────
  if (!d) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '16px',
      background: 'var(--bg-void)',
    }}>
      <div style={{ fontSize: '48px', animation: 'pulse-dot 1.5s ease-in-out infinite' }}>⚔</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>
        LOADING DEBATE...
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', opacity: 0.5 }}>
        WS: {connectionState.toUpperCase()}
      </div>
    </div>
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
      background: 'var(--bg-void)',
    }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: '56px',
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '0 16px',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}>

        {/* Topic */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '8px',
            color: (d as any).personal_context_detected ? '#9b59ff' : '#f5a623',
            letterSpacing: '0.15em', marginBottom: '1px',
          }}>
            {(d as any).personal_context_detected ? '👤 PERSONAL' : '🌍 DEBATE'}
          </div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {(d.config as any)?.topic}
          </div>
        </div>

        {/* Status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px',
          background: 'var(--bg-elevated)',
          border: `1px solid ${isRunning ? '#00ff8833' : isPaused ? '#f5a62333' : '#1e90ff33'}`,
          borderRadius: '4px', flexShrink: 0,
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: isRunning ? '#00ff88' : isPaused ? '#f5a623' : '#1e90ff',
            boxShadow: isRunning ? '0 0 6px #00ff88' : 'none',
            animation: isRunning ? 'pulse-dot 1.5s infinite' : 'none',
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px',
            color: 'var(--text-secondary)', letterSpacing: '0.08em',
            textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
          }}>
            {d.status?.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Round counter */}
        <div style={{
          padding: '4px 10px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '4px', textAlign: 'center' as const, flexShrink: 0,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            ROUND
          </div>
          <div style={{
            fontFamily: 'Orbitron, monospace', fontSize: '15px', fontWeight: 800,
            color: curRound > 0 ? '#f5a623' : 'var(--text-muted)', lineHeight: 1,
          }}>
            {curRound}
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>/{maxRounds}</span>
          </div>
        </div>

        {/* WS indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: connectionState === 'open' ? '#00ff88' : '#ff3c3c',
            boxShadow: connectionState === 'open' ? '0 0 6px #00ff88' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>
            {connectionState === 'open' ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        {/* Control buttons */}
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {isRunning && (
            <ControlBtn label="⏸" title="Pause" col="#7a95b8" onClick={pauseDebate} />
          )}
          {isPaused && (
            <ControlBtn label="▶" title="Resume" col="#00ff88" onClick={resumeDebate} />
          )}
          {(isRunning || isPaused) && (d.config as any)?.enableHumanInterrupt && (
            <ControlBtn label="⚡" title="Interrupt" col="#f5a623" onClick={() => setInterruptOpen(true)} />
          )}
        </div>
      </div>

      {/* ── 3-COLUMN LAYOUT ─────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr 220px',
        flex: 1,
        overflow: 'hidden',
      }}>

        {/* LEFT — Agent cards */}
        <div style={{
          borderRight: '1px solid var(--border-subtle)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-dim)',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.18em' }}>
              AGENTS
            </span>
          </div>
          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {agentList.length === 0 && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', padding: '8px' }}>
                Initializing...
              </div>
            )}
            {agentList.map((agent: any) => (
              <AgentCard
                key={agent.config?.id ?? agent.config?.role}
                agent={agent}
                isActive={
                  streaming.agentRole === agent.config?.role &&
                  (streaming.isThinking || streaming.isSpeaking)
                }
                currentThought={
                  streaming.agentRole === agent.config?.role
                    ? streaming.thought
                    : undefined
                }
              />
            ))}
          </div>
        </div>

        {/* CENTER — Scrollable transcript */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Transcript header */}
          <div style={{
            flexShrink: 0, padding: '6px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
              TRANSCRIPT
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>
                {turns.length} messages
              </span>
              {streaming.isSpeaking && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{
                    width: '5px', height: '5px', borderRadius: '50%',
                    background: '#00ff88', animation: 'pulse-dot 1s infinite',
                  }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#00ff88' }}>
                    LIVE
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Feed */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <DebateFeed
              turns={turns}
              streaming={streaming}
              selectedTurnId={selectedTurn}
              onSelectTurn={setSelectedTurn}
            />
          </div>
        </div>

        {/* RIGHT — Live metrics */}
        <div style={{
          borderLeft: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <LiveMetricsPanel
            agents={agents}
            curRound={curRound}
            maxRounds={maxRounds}
            consensus={consensus}
            threshold={threshold}
            isDone={isDone}
            winnerRole={d.winnerRole}
          />
        </div>
      </div>

      {/* Interrupt modal */}
      <InterruptModal
        isOpen={interruptOpen}
        onClose={() => setInterruptOpen(false)}
        onSubmit={async (msg, type) => {
          await interruptDebate(msg, type)
          setInterruptOpen(false)
        }}
      />
    </div>
  )
}

// ── Small control button ──────────────────────────────────────────────────────

function ControlBtn({
  label, title, col, onClick,
}: {
  label: string; title: string; col: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '5px 10px',
        background: 'transparent',
        border: `1px solid ${col}55`,
        borderRadius: '4px',
        color: col,
        fontFamily: 'var(--font-mono)', fontSize: '11px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap' as const,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background    = `${col}15`
        e.currentTarget.style.borderColor   = col
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background    = 'transparent'
        e.currentTarget.style.borderColor   = `${col}55`
      }}
    >
      {label} {title}
    </button>
  )
}