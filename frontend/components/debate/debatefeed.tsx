'use client'
// LOCATION: frontend/components/debate/DebateFeed.tsx
// WhatsApp-style: all messages permanent, newest at bottom, auto-scroll

import { useEffect, useRef, useCallback } from 'react'
import type { DebateTurn, AgentRole } from '@/lib/types'

export interface StreamingState {
  agentRole?: AgentRole
  thought:    string
  speech:     string
  isThinking: boolean
  isSpeaking: boolean
}

const ROLE_META: Record<string, { color: string; icon: string; label: string; right: boolean }> = {
  proponent:    { color: '#00ff88', icon: '▲', label: 'Proponent',    right: false },
  opponent:     { color: '#ff3c3c', icon: '▼', label: 'Opponent',     right: true  },
  fact_checker: { color: '#f5a623', icon: '◆', label: 'Fact-Checker', right: false },
  moderator:    { color: '#1e90ff', icon: '◉', label: 'Moderator',    right: false },
}

interface Props {
  turns:           DebateTurn[]
  streaming?:      StreamingState
  selectedTurnId?: string
  onSelectTurn?:   (id: string) => void
}

export function DebateFeed({ turns, streaming, selectedTurnId, onSelectTurn }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const bottomRef     = useRef<HTMLDivElement>(null)
  const userScrolled  = useRef(false)
  const prevTurnCount = useRef(0)
  const prevRole      = useRef<string | undefined>(undefined)

  const safe   = Array.isArray(turns) ? turns : []
  const isLive = !!(streaming && (streaming.isSpeaking || streaming.isThinking) && streaming.agentRole)

  // Track manual scroll — stop auto-scroll if user scrolled up
  const onScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    userScrolled.current = distFromBottom > 120
  }, [])

  const scrollToBottom = useCallback((force = false) => {
    if (!force && userScrolled.current) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  // Scroll when a new completed turn is added
  useEffect(() => {
    if (safe.length > prevTurnCount.current) {
      prevTurnCount.current = safe.length
      // Small delay so the DOM has committed the new bubble
      setTimeout(() => scrollToBottom(), 50)
    }
  }, [safe.length, scrollToBottom])

  // Scroll when a new agent starts speaking (role changes)
  useEffect(() => {
    if (isLive && streaming?.agentRole !== prevRole.current) {
      prevRole.current = streaming?.agentRole
      setTimeout(() => scrollToBottom(), 50)
    }
  }, [streaming?.agentRole, isLive, scrollToBottom])

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      style={{
        height:     '100%',
        overflowY:  'auto',
        overflowX:  'hidden',
        // smooth scroll on the container itself too
        scrollBehavior: 'smooth',
      }}
    >
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '0px' }}>

        {safe.length === 0 && !isLive && (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '40px', opacity: 0.15, marginBottom: '12px' }}>⚔</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.2em' }}>
              AGENTS PREPARING...
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', marginTop: '6px', opacity: 0.5 }}>
              First response takes ~15 seconds
            </div>
          </div>
        )}

        {/* ── Completed turns — NEVER removed from DOM ── */}
        {safe.map((turn, i) => {
          const showHeader = i === 0 || safe[i - 1].agentRole !== turn.agentRole
          // Stable key: id is preferred; fall back to role+round+index
          const key = turn.id && turn.id !== ''
            ? turn.id
            : `${turn.agentRole}-r${turn.round}-${i}`
          return (
            <CompletedBubble
              key={key}
              turn={turn}
              showHeader={showHeader}
              selected={turn.id === selectedTurnId}
              onClick={() => turn.id && onSelectTurn?.(turn.id)}
            />
          )
        })}

        {/* ── Live streaming bubble — always BELOW all completed turns ── */}
        {isLive && streaming!.agentRole && (
          <LiveBubble
            key={`live-${streaming!.agentRole}`}
            role={streaming!.agentRole}
            speech={streaming!.speech}
            thought={streaming!.thought}
            thinking={streaming!.isThinking && !streaming!.speech}
          />
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} style={{ height: '16px', flexShrink: 0 }} />
      </div>
    </div>
  )
}

// ─── Completed bubble ──────────────────────────────────────────────────────

function CompletedBubble({ turn, showHeader, selected, onClick }: {
  turn:       DebateTurn
  showHeader: boolean
  selected:   boolean
  onClick:    () => void
}) {
  const m = ROLE_META[turn.agentRole] ?? ROLE_META.moderator

  return (
    <div
      onClick={onClick}
      style={{
        display:       'flex',
        flexDirection: m.right ? 'row-reverse' : 'row',
        gap:           '10px',
        marginTop:     showHeader ? '20px' : '4px',
        cursor:        'pointer',
      }}
    >
      {/* Avatar */}
      <div style={{ width: '30px', flexShrink: 0, paddingTop: '2px' }}>
        {showHeader && (
          <div style={{
            width: '28px', height: '28px', borderRadius: '4px',
            background: `${m.color}15`, border: `1px solid ${m.color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: m.color, fontSize: '12px', fontWeight: 700,
          }}>
            {m.icon}
          </div>
        )}
      </div>

      {/* Message */}
      <div style={{ flex: 1, maxWidth: 'calc(100% - 40px)' }}>
        {showHeader && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '5px',
            flexDirection: m.right ? 'row-reverse' : 'row',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: m.color, fontWeight: 700 }}>
              {m.label}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
              Round {turn.round}
            </span>
            {(turn.score?.totalScore ?? 0) > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: m.color, opacity: 0.7 }}>
                L:{Math.round(turn.score.logicScore ?? 0)} E:{Math.round(turn.score.evidenceScore ?? 0)}
              </span>
            )}
          </div>
        )}

        <div style={{
          padding:      '12px 16px',
          background:   selected ? `${m.color}18` : `${m.color}0a`,
          border:       `1px solid ${selected ? m.color + '55' : m.color + '22'}`,
          borderLeft:   !m.right ? `3px solid ${m.color}` : undefined,
          borderRight:   m.right ? `3px solid ${m.color}` : undefined,
          borderRadius: '4px',
          transition:   'background 0.15s',
        }}>
          <p style={{
            fontFamily: 'var(--font-ui)', fontSize: '14px',
            color: 'var(--text-primary)', lineHeight: 1.8,
            margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {turn.content}
          </p>
          {(turn.score?.fallaciesDetected?.length ?? 0) > 0 && (
            <div style={{
              marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '8px',
              color: '#ff3c3c', display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <span>⚠</span>
              <span>
                {turn.score.fallaciesDetected.length} fallac
                {turn.score.fallaciesDetected.length === 1 ? 'y' : 'ies'} detected
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Live bubble ───────────────────────────────────────────────────────────

function LiveBubble({ role, speech, thought, thinking }: {
  role:     AgentRole
  speech:   string
  thought:  string
  thinking: boolean
}) {
  const m = ROLE_META[role] ?? ROLE_META.moderator

  return (
    <div style={{
      display:       'flex',
      flexDirection: m.right ? 'row-reverse' : 'row',
      gap:           '10px',
      marginTop:     '20px',
    }}>
      {/* Avatar */}
      <div style={{ width: '30px', flexShrink: 0, paddingTop: '2px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '4px',
          background: `${m.color}20`, border: `1px solid ${m.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: m.color, fontSize: '12px', fontWeight: 700,
          animation: 'liveGlow 1.5s ease-in-out infinite',
        }}>
          {m.icon}
          <style>{`
            @keyframes liveGlow {
              0%,100% { box-shadow: 0 0 8px ${m.color}44 }
              50%      { box-shadow: 0 0 20px ${m.color}88 }
            }
            @keyframes bounce {
              0%,80%,100% { transform: translateY(0) }
              40%          { transform: translateY(-6px) }
            }
            @keyframes blink {
              0%,100% { opacity: 1 }
              50%      { opacity: 0 }
            }
          `}</style>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 'calc(100% - 40px)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '5px',
          flexDirection: m.right ? 'row-reverse' : 'row',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: m.color, fontWeight: 700 }}>
            {m.label}
          </span>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: m.color, boxShadow: `0 0 6px ${m.color}`,
            animation: 'liveGlow 1s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
            {thinking ? 'thinking...' : 'speaking...'}
          </span>
        </div>

        {/* Thinking dots */}
        {thinking && (
          <div style={{
            padding: '14px 16px',
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid var(--border-dim)`,
            borderLeft:  !m.right ? `3px solid ${m.color}66` : undefined,
            borderRight:  m.right ? `3px solid ${m.color}66` : undefined,
            borderRadius: '4px',
            display: 'flex', gap: '6px', alignItems: 'center',
          }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: m.color, opacity: 0.7,
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        )}

        {/* Streaming speech */}
        {speech && (
          <div style={{
            padding:      '12px 16px',
            background:   `${m.color}10`,
            border:       `1px solid ${m.color}44`,
            borderLeft:   !m.right ? `3px solid ${m.color}` : undefined,
            borderRight:   m.right ? `3px solid ${m.color}` : undefined,
            borderRadius: '4px',
            boxShadow:    `0 0 16px ${m.color}15`,
          }}>
            <p style={{
              fontFamily: 'var(--font-ui)', fontSize: '14px',
              color: 'var(--text-primary)', lineHeight: 1.8,
              margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {speech}
              <span style={{
                color: m.color, fontWeight: 700,
                animation: 'blink 1s step-end infinite',
              }}>█</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}