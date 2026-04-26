'use client'
import { useEffect, useRef } from 'react'
import type { DebateTurn, AgentRole, StreamingState } from '@/lib/types'

// Re-export StreamingState from types for consumers
export type { StreamingState }

const ROLE_META: Record<AgentRole, { color: string; icon: string; label: string }> = {
  proponent:    { color: 'var(--green-lock)', icon: '▲', label: 'PROPONENT' },
  opponent:     { color: 'var(--red-hot)',    icon: '▼', label: 'OPPONENT' },
  fact_checker: { color: 'var(--amber)',       icon: '◆', label: 'FACT-CHECKER' },
  moderator:    { color: 'var(--blue-data)',  icon: '◉', label: 'MODERATOR' },
}

interface DebateFeedProps {
  turns: DebateTurn[]
  streaming?: {
    agentRole?: AgentRole
    speech: string
    thought: string
    isSpeaking: boolean
    isThinking: boolean
  }
  selectedTurnId?: string
  onSelectTurn?: (id: string) => void
}

export function DebateFeed({ turns, streaming, selectedTurnId, onSelectTurn }: DebateFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [(turns ?? []).length, streaming?.speech])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%', overflowY: 'auto', padding: '16px' }}>
      {/* Empty state */}
      {(turns ?? []).length === 0 && !streaming?.isSpeaking && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '32px', opacity: 0.3 }}>◈</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Awaiting debate initiation</div>
        </div>
      )}

      {/* Completed turns */}
      {(turns ?? []).map((turn, i) => (
        <TurnBubble
          key={turn.id}
          turn={turn}
          isSelected={turn.id === selectedTurnId}
          isFirst={i === 0 || turns[i - 1].agentRole !== turn.agentRole}
          onClick={() => onSelectTurn?.(turn.id)}
        />
      ))}

      {/* Live streaming turn */}
      {streaming?.isSpeaking && streaming.agentRole && (
        <StreamingBubble
          agentRole={streaming.agentRole}
          speech={streaming.speech}
          thought={streaming.thought}
          isThinking={streaming.isThinking}
        />
      )}

      <div ref={bottomRef} />
    </div>
  )
}

function TurnBubble({ turn, isSelected, isFirst, onClick }: { turn: DebateTurn; isSelected: boolean; isFirst: boolean; onClick: () => void }) {
  const meta = ROLE_META[turn.agentRole]
  const isRight = turn.agentRole === 'opponent'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: isRight ? 'row-reverse' : 'row',
        gap: '10px',
        marginBottom: '2px',
        marginTop: isFirst ? '12px' : '2px',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '2px',
        transition: 'background 0.15s',
        background: isSelected ? 'rgba(255,255,255,0.02)' : 'transparent',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.015)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Avatar */}
      {isFirst && (
        <div style={{
          width: '28px',
          height: '28px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${meta.color}11`,
          border: `1px solid ${meta.color}33`,
          borderRadius: '2px',
          fontSize: '12px',
          color: meta.color,
          alignSelf: 'flex-start',
          marginTop: '2px',
        }}>
          {meta.icon}
        </div>
      )}
      {!isFirst && <div style={{ width: '28px', flexShrink: 0 }} />}

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 'calc(100% - 50px)' }}>
        {isFirst && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexDirection: isRight ? 'row-reverse' : 'row' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: meta.color, letterSpacing: '0.12em' }}>{meta.label} · {turn.agentName}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
              {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>R{turn.round}</span>
          </div>
        )}

        <div style={{
          padding: '10px 14px',
          background: `${meta.color}08`,
          border: `1px solid ${meta.color}${isSelected ? '44' : '18'}`,
          borderRadius: '2px',
          borderLeft: isRight ? `1px solid ${meta.color}18` : `2px solid ${meta.color}88`,
          borderRight: isRight ? `2px solid ${meta.color}88` : `1px solid ${meta.color}18`,
        }}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>
            {turn.content}
          </p>

          {/* Tool calls */}
          {turn.toolCalls.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {turn.toolCalls.map(tc => (
                <span key={tc.id} style={{
                  padding: '2px 8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.1em',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '2px',
                  color: tc.status === 'success' ? meta.color : 'var(--text-muted)',
                }}>
                  {tc.status === 'success' ? '✓' : tc.status === 'error' ? '✗' : '⟳'} {tc.tool}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Score row */}
        {turn.score && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px', paddingLeft: '4px', flexDirection: isRight ? 'row-reverse' : 'row' }}>
            <ScoreChip label="L" value={turn.score.logicScore} color={meta.color} />
            <ScoreChip label="E" value={turn.score.evidenceScore} color={meta.color} />
            {turn.score.fallaciesDetected.length > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--red-hot)' }}>
                ⚠ {turn.score.fallaciesDetected.length}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StreamingBubble({ agentRole, speech, thought, isThinking }: { agentRole: AgentRole; speech: string; thought: string; isThinking: boolean }) {
  const meta = ROLE_META[agentRole]
  const isRight = agentRole === 'opponent'

  return (
    <div style={{
      display: 'flex',
      flexDirection: isRight ? 'row-reverse' : 'row',
      gap: '10px',
      marginTop: '12px',
      marginBottom: '4px',
      padding: '4px',
    }}>
      <div style={{
        width: '28px',
        height: '28px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${meta.color}22`,
        border: `1px solid ${meta.color}66`,
        borderRadius: '2px',
        fontSize: '12px',
        color: meta.color,
        alignSelf: 'flex-start',
        marginTop: '2px',
        boxShadow: `0 0 12px ${meta.color}44`,
        animation: 'pulse-glow 1.5s ease-in-out infinite',
      }}>
        {meta.icon}
        <style>{`@keyframes pulse-glow { 0%,100%{box-shadow:0 0 12px ${meta.color}44} 50%{box-shadow:0 0 20px ${meta.color}88} }`}</style>
      </div>

      <div style={{ flex: 1, maxWidth: 'calc(100% - 50px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexDirection: isRight ? 'row-reverse' : 'row' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: meta.color, letterSpacing: '0.12em' }}>
            {meta.label} {isThinking ? '// PROCESSING' : '// TRANSMITTING'}
          </span>
          <span className="status-dot" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}`, animation: 'pulse-dot 1s ease-in-out infinite' }} />
        </div>

        {isThinking && thought && (
          <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-dim)', borderRadius: '2px', marginBottom: '6px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>// CHAIN OF THOUGHT</div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: `${meta.color}88`, lineHeight: 1.6, margin: 0 }}>
              {thought}<span className="blink">█</span>
            </p>
          </div>
        )}

        {speech && (
          <div style={{
            padding: '10px 14px',
            background: `${meta.color}08`,
            border: `1px solid ${meta.color}44`,
            borderLeft: isRight ? `1px solid ${meta.color}44` : `2px solid ${meta.color}`,
            borderRight: isRight ? `2px solid ${meta.color}` : `1px solid ${meta.color}44`,
            borderRadius: '2px',
            boxShadow: `0 0 16px ${meta.color}11`,
          }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>
              {speech}<span className="blink" style={{ color: meta.color }}>█</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ScoreChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: value > 70 ? color : 'var(--text-muted)' }}>
      {label}:{value}
    </span>
  )
}