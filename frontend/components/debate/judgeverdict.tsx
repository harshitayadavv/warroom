// LOCATION: frontend/components/debate/JudgeVerdict.tsx
// Shown at the end of a debate — the Judge agent delivers a dramatic verdict
// Covers: winner, key arguments, consensus score, logical fallacy summary, recommendation

'use client'
import { useEffect, useState } from 'react'
import type { Debate, AgentRole } from '@/lib/types'

const WINNER_META: Record<AgentRole, { color: string; icon: string; label: string; glow: string }> = {
  proponent:    { color: '#00ff88', icon: '▲', label: 'PROPONENT',    glow: 'rgba(0,255,136,0.15)' },
  opponent:     { color: '#ff3c3c', icon: '▼', label: 'OPPONENT',     glow: 'rgba(255,60,60,0.15)' },
  fact_checker: { color: '#f5a623', icon: '◆', label: 'FACT-CHECKER', glow: 'rgba(245,166,35,0.15)' },
  moderator:    { color: '#1e90ff', icon: '◉', label: 'MODERATOR',    glow: 'rgba(30,144,255,0.15)' },
}

interface JudgeVerdictProps {
  debate: Debate
  verdict: VerdictData
  onClose: () => void
  onNewDebate: () => void
  onFork: () => void
}

export interface VerdictData {
  winner: AgentRole | 'draw'
  winnerName: string
  summary: string                   // 2-3 sentence overall summary
  keyArguments: string[]            // top 3 arguments that swayed the debate
  consensusReached: boolean
  finalConsensusScore: number       // 0-100
  totalFallacies: Record<AgentRole, number>
  recommendation: string            // actionable conclusion for the user
  confidenceInVerdict: number       // 0-100
  debateDurationSec: number
  totalRounds: number
  personalContextDetected: boolean  // true if topic was personal (like "should I buy a dog")
}

export function JudgeVerdict({ debate, verdict, onClose, onNewDebate, onFork }: JudgeVerdictProps) {
  const [phase, setPhase] = useState<'entering' | 'gavel' | 'reveal' | 'full'>('entering')
  const [typedSummary, setTypedSummary] = useState('')
  const [typedRec, setTypedRec] = useState('')

  // Dramatic entrance sequence
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('gavel'), 400)
    const t2 = setTimeout(() => setPhase('reveal'), 1200)
    const t3 = setTimeout(() => setPhase('full'), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  // Type out summary
  useEffect(() => {
    if (phase !== 'full') return
    let i = 0
    const t = setInterval(() => {
      setTypedSummary(verdict.summary.slice(0, i + 1))
      i++
      if (i >= verdict.summary.length) clearInterval(t)
    }, 18)
    return () => clearInterval(t)
  }, [phase, verdict.summary])

  // Type out recommendation after summary
  useEffect(() => {
    if (typedSummary.length < verdict.summary.length) return
    let i = 0
    const t = setInterval(() => {
      setTypedRec(verdict.recommendation.slice(0, i + 1))
      i++
      if (i >= verdict.recommendation.length) clearInterval(t)
    }, 20)
    return () => clearInterval(t)
  }, [typedSummary, verdict.summary.length, verdict.recommendation])

  const isDraw   = verdict.winner === 'draw'
  const winMeta  = isDraw ? null : WINNER_META[verdict.winner]
  const duration = formatDuration(verdict.debateDurationSec)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(3,5,8,0.97)',
      backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      opacity: phase === 'entering' ? 0 : 1,
      transition: 'opacity 0.4s ease',
      overflowY: 'auto',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: isDraw
          ? 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(245,166,35,0.06), transparent)'
          : `radial-gradient(ellipse 60% 40% at 50% 50%, ${winMeta?.glow ?? 'transparent'}, transparent)`,
        transition: 'background 1s ease',
      }} />

      <div style={{ width: '100%', maxWidth: '680px', position: 'relative' }}>

        {/* JUDGE header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.3em', marginBottom: '12px' }}>
            THE JUDGE DELIVERS
          </div>

          {/* Gavel animation */}
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            display: 'inline-block',
            animation: phase === 'gavel' ? 'gavel-strike 0.6s cubic-bezier(0.36,0.07,0.19,0.97)' : 'none',
          }}>
            ⚖
            <style>{`
              @keyframes gavel-strike {
                0%   { transform: rotate(-45deg) scale(1.2); }
                40%  { transform: rotate(15deg) scale(0.95); }
                70%  { transform: rotate(-10deg) scale(1.05); }
                100% { transform: rotate(0deg) scale(1); }
              }
            `}</style>
          </div>

          {phase !== 'entering' && phase !== 'gavel' && (
            <div style={{ animation: 'slide-in-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, letterSpacing: '0.3em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                VERDICT
              </div>

              {isDraw ? (
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '40px', fontWeight: 900, color: 'var(--amber)', letterSpacing: '0.05em', textShadow: '0 0 40px rgba(245,166,35,0.4)' }}>
                  NO CONSENSUS
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '24px', color: winMeta!.color }}>{winMeta!.icon}</span>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '40px',
                      fontWeight: 900,
                      color: winMeta!.color,
                      letterSpacing: '0.05em',
                      textShadow: `0 0 40px ${winMeta!.glow}`,
                    }}>
                      {verdict.winnerName}
                    </div>
                    <span style={{ fontSize: '24px', color: winMeta!.color }}>{winMeta!.icon}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: winMeta!.color, letterSpacing: '0.2em', opacity: 0.8 }}>
                    {winMeta!.label} PREVAILS
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {phase === 'full' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fade-in 0.5s ease' }}>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { label: 'CONSENSUS', value: `${Math.round(verdict.finalConsensusScore)}%`, color: verdict.consensusReached ? 'var(--green-lock)' : 'var(--amber)' },
                { label: 'ROUNDS', value: String(verdict.totalRounds), color: 'var(--blue-data)' },
                { label: 'DURATION', value: duration, color: 'var(--text-secondary)' },
                { label: 'CONFIDENCE', value: `${verdict.confidenceInVerdict}%`, color: 'var(--purple-ai)' },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '2px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '2px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.2em', marginBottom: '10px' }}>
                // JUDGE'S ANALYSIS
              </div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.8, margin: 0 }}>
                {typedSummary}
                {typedSummary.length < verdict.summary.length && <span className="blink" style={{ color: 'var(--amber)' }}>█</span>}
              </p>
            </div>

            {/* Key arguments */}
            {verdict.keyArguments.length > 0 && (
              <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '2px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.2em', marginBottom: '10px' }}>
                  // DECISIVE ARGUMENTS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {verdict.keyArguments.map((arg, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: winMeta?.color ?? 'var(--amber)', fontWeight: 800, flexShrink: 0, marginTop: '2px' }}>
                        {i + 1}.
                      </span>
                      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        {arg}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fallacy summary */}
            {Object.values(verdict.totalFallacies).some(v => v > 0) && (
              <div style={{ padding: '14px 16px', background: 'var(--red-glow)', border: '1px solid var(--border-red)', borderRadius: '2px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--red-hot)', letterSpacing: '0.2em', marginBottom: '8px' }}>
                  // LOGICAL FALLACIES COMMITTED
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {Object.entries(verdict.totalFallacies).filter(([, v]) => v > 0).map(([role, count]) => {
                    const m = WINNER_META[role as AgentRole]
                    return (
                      <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: m.color, fontSize: '10px' }}>{m.icon}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {m.label}: <span style={{ color: 'var(--red-hot)', fontWeight: 700 }}>{count}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Personal context note */}
            {verdict.personalContextDetected && (
              <div style={{ padding: '12px 16px', background: 'rgba(155,89,255,0.06)', border: '1px solid rgba(155,89,255,0.25)', borderRadius: '2px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--purple-ai)', letterSpacing: '0.15em', marginBottom: '4px' }}>
                  PERSONAL DECISION CONTEXT
                </div>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  This debate involved a personal decision. The agents' arguments were structured around your specific context. The recommendation below factors in practicality, not just logic.
                </p>
              </div>
            )}

            {/* Recommendation */}
            {typedRec && (
              <div style={{
                padding: '16px',
                background: `${winMeta?.glow ?? 'rgba(245,166,35,0.06)'}`,
                border: `1px solid ${winMeta?.color ?? 'var(--amber)'}33`,
                borderRadius: '2px',
                borderLeft: `3px solid ${winMeta?.color ?? 'var(--amber)'}`,
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: winMeta?.color ?? 'var(--amber)', letterSpacing: '0.2em', marginBottom: '10px' }}>
                  // THE JUDGE RECOMMENDS
                </div>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.8, margin: 0, fontWeight: 500 }}>
                  {typedRec}
                  {typedRec.length < verdict.recommendation.length && <span className="blink" style={{ color: winMeta?.color ?? 'var(--amber)' }}>█</span>}
                </p>
              </div>
            )}

            {/* Action buttons */}
            {typedRec.length >= verdict.recommendation.length && (
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', paddingTop: '8px', animation: 'slide-in-up 0.4s ease' }}>
                <button
                  onClick={onFork}
                  style={{ padding: '11px 24px', background: 'rgba(155,89,255,0.1)', border: '1px solid rgba(155,89,255,0.4)', borderRadius: '2px', color: 'var(--purple-ai)', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(155,89,255,0.18)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(155,89,255,0.1)'}
                >
                  ⑂ FORK & CONTINUE
                </button>
                <button
                  onClick={onNewDebate}
                  style={{ padding: '11px 32px', background: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))', border: '1px solid var(--amber)', borderRadius: '2px', color: 'var(--amber)', fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,166,35,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))'}
                >
                  ⚡ NEW DEBATE
                </button>
                <button
                  onClick={onClose}
                  style={{ padding: '11px 20px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.15em', cursor: 'pointer' }}
                >
                  VIEW TRANSCRIPT
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec}s`
}