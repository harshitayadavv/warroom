'use client'
// LOCATION: frontend/components/debate/DebateFeed.tsx
// All completed messages are ALWAYS visible and scrollable.
// Streaming bubble appears BELOW completed messages — never replaces them.
// Think WhatsApp: every message stays. New ones appear at the bottom.

import { useEffect, useRef } from 'react'
import type { DebateTurn, AgentRole } from '@/lib/types'
import type { StreamingState } from '@/hooks/useDebate'

export type { StreamingState }

const META: Record<string, { color: string; glow: string; icon: string; label: string; align: 'left' | 'right' }> = {
  proponent:    { color: '#00ff88', glow: 'rgba(0,255,136,0.08)',  icon: '▲', label: 'Proponent',    align: 'left'  },
  opponent:     { color: '#ff3c3c', glow: 'rgba(255,60,60,0.08)',  icon: '▼', label: 'Opponent',     align: 'right' },
  fact_checker: { color: '#f5a623', glow: 'rgba(245,166,35,0.08)', icon: '◆', label: 'Fact-Checker', align: 'left'  },
  moderator:    { color: '#1e90ff', glow: 'rgba(30,144,255,0.08)', icon: '◉', label: 'Moderator',    align: 'left'  },
}

interface Props {
  turns:          DebateTurn[]
  streaming?:     StreamingState
  selectedTurnId?: string
  onSelectTurn?:  (id: string) => void
}

export function DebateFeed({ turns, streaming, selectedTurnId, onSelectTurn }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const safe      = Array.isArray(turns) ? turns : []

  // Scroll to bottom whenever new content arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [safe.length, streaming?.speech?.length])

  const isStreaming = streaming && (streaming.isSpeaking || streaming.isThinking) && streaming.agentRole

  return (
    <div style={{
      height:    '100%',
      overflowY: 'scroll',
      overflowX: 'hidden',
      display:   'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '0', flexGrow: 1 }}>

        {/* Empty placeholder */}
        {safe.length === 0 && !isStreaming && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '300px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '48px', opacity: 0.15 }}>⚔</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>
              Agents preparing arguments...
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', opacity: 0.6 }}>
              First response usually takes 10–20 seconds
            </div>
          </div>
        )}

        {/* ── COMPLETED TURNS — always visible, never removed ── */}
        {safe.map((turn, i) => {
          const prevRole = i > 0 ? safe[i - 1].agentRole : null
          const showHeader = prevRole !== turn.agentRole
          return (
            <CompletedBubble
              key={turn.id ?? `t${i}`}
              turn={turn}
              showHeader={showHeader}
              isSelected={turn.id === selectedTurnId}
              onClick={() => onSelectTurn?.(turn.id)}
            />
          )
        })}

        {/* ── STREAMING BUBBLE — appears below history, never replaces it ── */}
        {isStreaming && streaming.agentRole && (
          <LiveBubble
            agentRole={streaming.agentRole}
            speech={streaming.speech}
            thought={streaming.thought}
            isThinking={streaming.isThinking}
          />
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} style={{ height: '8px' }} />
      </div>
    </div>
  )
}

// ── Completed message bubble ───────────────────────────────────

function CompletedBubble({
  turn, showHeader, isSelected, onClick,
}: {
  turn: DebateTurn; showHeader: boolean; isSelected: boolean; onClick: () => void
}) {
  const m = META[turn.agentRole] ?? META.moderator
  const isRight = m.align === 'right'

  return (
    <div
      onClick={onClick}
      style={{
        display:       'flex',
        flexDirection: isRight ? 'row-reverse' : 'row',
        alignItems:    'flex-start',
        gap:           '10px',
        marginTop:     showHeader ? '20px' : '3px',
        cursor:        'pointer',
      }}
    >
      {/* Avatar column */}
      <div style={{ width: '32px', flexShrink: 0, paddingTop: '2px' }}>
        {showHeader && (
          <div style={{
            width:          '28px',
            height:         '28px',
            borderRadius:   '4px',
            background:     m.glow,
            border:         `1px solid ${m.color}44`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            color:          m.color,
            fontSize:       '12px',
            fontWeight:     700,
          }}>
            {m.icon}
          </div>
        )}
      </div>

      {/* Content column */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: 'calc(100% - 42px)' }}>

        {/* Header row */}
        {showHeader && (
          <div style={{
            display:       'flex',
            alignItems:    'center',
            gap:           '8px',
            marginBottom:  '5px',
            flexDirection: isRight ? 'row-reverse' : 'row',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: m.color, fontWeight: 700, letterSpacing: '0.08em' }}>
              {m.label}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
              {turn.agentName} · Round {turn.round}
            </span>
            {/* Live score chips */}
            {turn.score?.totalScore > 0 && (
              <div style={{ display: 'flex', gap: '4px', marginLeft: isRight ? 0 : 'auto', marginRight: isRight ? 'auto' : 0 }}>
                <ScoreTag label="L" val={turn.score.logicScore}    color={m.color} />
                <ScoreTag label="E" val={turn.score.evidenceScore}  color={m.color} />
              </div>
            )}
          </div>
        )}

        {/* Message bubble */}
        <div style={{
          padding:      '12px 16px',
          background:   isSelected ? `${m.color}18` : `${m.color}0a`,
          border:       `1px solid ${isSelected ? m.color + '66' : m.color + '25'}`,
          borderLeft:   !isRight ? `3px solid ${m.color}` : `1px solid ${m.color}25`,
          borderRight:  isRight  ? `3px solid ${m.color}` : `1px solid ${m.color}25`,
          borderRadius: '4px',
          transition:   'border-color 0.15s, background 0.15s',
        }}>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize:   '14px',
            color:      'var(--text-primary)',
            lineHeight: 1.8,
            margin:     0,
            whiteSpace: 'pre-wrap',
            wordBreak:  'break-word',
          }}>
            {turn.content}
          </p>

          {/* Tool calls used */}
          {(turn.toolCalls ?? []).some(tc => tc.status === 'success') && (
            <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
              {(turn.toolCalls ?? []).filter(tc => tc.status === 'success').map((tc, i) => (
                <span key={i} style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize:   '8px',
                  padding:    '2px 7px',
                  borderRadius: '2px',
                  background: 'rgba(0,0,0,0.3)',
                  border:     '1px solid rgba(255,255,255,0.08)',
                  color:      m.color,
                }}>
                  ✓ {tc.tool}
                </span>
              ))}
            </div>
          )}

          {/* Fallacy alerts */}
          {(turn.score?.fallaciesDetected ?? []).length > 0 && (
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: '#ff3c3c', fontSize: '10px' }}>⚠</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#ff3c3c' }}>
                {turn.score.fallaciesDetected.length} logical {turn.score.fallaciesDetected.length === 1 ? 'fallacy' : 'fallacies'} detected
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Live streaming bubble ──────────────────────────────────────

function LiveBubble({
  agentRole, speech, thought, isThinking,
}: {
  agentRole: AgentRole; speech: string; thought: string; isThinking: boolean
}) {
  const m       = META[agentRole] ?? META.moderator
  const isRight = m.align === 'right'

  return (
    <div style={{
      display:       'flex',
      flexDirection: isRight ? 'row-reverse' : 'row',
      alignItems:    'flex-start',
      gap:           '10px',
      marginTop:     '20px',
    }}>
      {/* Pulsing avatar */}
      <div style={{ width: '32px', flexShrink: 0, paddingTop: '2px' }}>
        <div style={{
          width:          '28px',
          height:         '28px',
          borderRadius:   '4px',
          background:     m.glow,
          border:         `1px solid ${m.color}`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          m.color,
          fontSize:       '12px',
          fontWeight:     700,
          boxShadow:      `0 0 12px ${m.color}55`,
          animation:      'liveGlow 1.5s ease-in-out infinite',
        }}>
          {m.icon}
          <style>{`
            @keyframes liveGlow {
              0%,100% { box-shadow: 0 0 8px ${m.color}44; }
              50%      { box-shadow: 0 0 20px ${m.color}88; }
            }
          `}</style>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, maxWidth: 'calc(100% - 42px)' }}>

        {/* Live header */}
        <div style={{
          display:       'flex',
          alignItems:    'center',
          gap:           '8px',
          marginBottom:  '5px',
          flexDirection: isRight ? 'row-reverse' : 'row',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: m.color, fontWeight: 700, letterSpacing: '0.08em' }}>
            {m.label}
          </span>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.color, flexShrink: 0, boxShadow: `0 0 8px ${m.color}`, animation: 'pulse-dot 1s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
            {isThinking ? 'thinking...' : 'speaking...'}
          </span>
        </div>

        {/* Thinking indicator (before speech starts) */}
        {isThinking && !speech && (
          <div style={{
            padding:      '10px 14px',
            background:   'rgba(0,0,0,0.3)',
            border:       '1px solid rgba(255,255,255,0.06)',
            borderLeft:   !isRight ? `3px solid ${m.color}66` : undefined,
            borderRight:  isRight  ? `3px solid ${m.color}66` : undefined,
            borderRadius: '4px',
          }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width:        '6px',
                  height:       '6px',
                  borderRadius: '50%',
                  background:   m.color,
                  opacity:      0.7,
                  animation:    `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
              <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
            </div>
          </div>
        )}

        {/* Live speech bubble */}
        {speech && (
          <div style={{
            padding:      '12px 16px',
            background:   `${m.color}10`,
            border:       `1px solid ${m.color}55`,
            borderLeft:   !isRight ? `3px solid ${m.color}` : `1px solid ${m.color}55`,
            borderRight:  isRight  ? `3px solid ${m.color}` : `1px solid ${m.color}55`,
            borderRadius: '4px',
            boxShadow:    `0 0 20px ${m.color}15`,
          }}>
            <p style={{
              fontFamily: 'var(--font-ui)',
              fontSize:   '14px',
              color:      'var(--text-primary)',
              lineHeight: 1.8,
              margin:     0,
              whiteSpace: 'pre-wrap',
              wordBreak:  'break-word',
            }}>
              {speech}
              <span style={{ color: m.color, animation: 'blink 1s step-end infinite', fontWeight: 700 }}>█</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ScoreTag({ label, val, color }: { label: string; val: number; color: string }) {
  if (!val) return null
  return (
    <span style={{
      fontFamily:   'var(--font-mono)',
      fontSize:     '8px',
      padding:      '1px 5px',
      borderRadius: '2px',
      background:   `${color}15`,
      border:       `1px solid ${color}33`,
      color:        val > 70 ? color : 'var(--text-muted)',
    }}>
      {label}:{Math.round(val)}
    </span>
  )
}