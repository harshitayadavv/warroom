// LOCATION: frontend/components/debate/TurnDetail.tsx
// Shown on the right when a transcript turn is clicked

'use client'
import type { DebateTurn, AgentRole, FallacyType } from '@/lib/types'

const ROLE_META: Record<AgentRole, { color: string; label: string; icon: string }> = {
  proponent:    { color: 'var(--green-lock)', label: 'Proponent',    icon: '▲' },
  opponent:     { color: 'var(--red-hot)',    label: 'Opponent',     icon: '▼' },
  fact_checker: { color: 'var(--amber)',       label: 'Fact-Checker', icon: '◆' },
  moderator:    { color: 'var(--blue-data)',  label: 'Moderator',    icon: '◉' },
}

const FALLACY_SEVERITY: Record<string, { color: string; bg: string; border: string }> = {
  high:   { color: 'var(--red-hot)',    bg: 'var(--red-glow)',   border: 'var(--border-red)' },
  medium: { color: 'var(--amber)',       bg: 'var(--amber-glow)', border: 'var(--border-amber)' },
  low:    { color: 'var(--text-muted)', bg: 'transparent',       border: 'var(--border-dim)' },
}

interface TurnDetailProps {
  turn: DebateTurn | null
  onClose: () => void
}

export function TurnDetail({ turn, onClose }: TurnDetailProps) {
  if (!turn) return null

  const meta = ROLE_META[turn.agentRole]

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      background: 'var(--bg-base)',
      borderLeft: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '28px', height: '28px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${meta.color}11`,
          border: `1px solid ${meta.color}44`,
          borderRadius: '2px',
          color: meta.color, fontSize: '12px',
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: meta.color, letterSpacing: '0.12em' }}>
            {meta.label} · ROUND {turn.round}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
            {new Date(turn.timestamp).toLocaleTimeString()}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', fontSize: '16px', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
        >✕</button>
      </div>

      {/* Body */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>

        {/* Full content */}
        <Section label="ARGUMENT">
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.8 }}>
            {turn.content}
          </p>
        </Section>

        {/* Scores */}
        <Section label="SCORES">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <ScoreCard label="Logic" value={turn.score.logicScore} color={meta.color} />
            <ScoreCard label="Evidence" value={turn.score.evidenceScore} color={meta.color} />
            <ScoreCard label="Sentiment" value={sentimentDisplay(turn.score.sentimentScore)} color={sentimentColor(turn.score.sentimentScore)} />
            <ScoreCard label="Total" value={turn.score.totalScore} color={meta.color} highlight />
          </div>
        </Section>

        {/* Tool calls */}
        {turn.toolCalls.length > 0 && (
          <Section label={`TOOL CALLS (${turn.toolCalls.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {turn.toolCalls.map(tc => (
                <div key={tc.id} style={{
                  padding: '8px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '2px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: tc.output ? '6px' : 0 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '9px',
                      color: tc.status === 'success' ? 'var(--green-lock)' : tc.status === 'error' ? 'var(--red-hot)' : 'var(--amber)',
                    }}>
                      {tc.status === 'success' ? '✓' : tc.status === 'error' ? '✗' : '⟳'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {tc.tool}
                    </span>
                    {tc.durationMs && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {tc.durationMs}ms
                      </span>
                    )}
                  </div>
                  {tc.output && (
                    <pre style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      overflow: 'auto',
                      maxHeight: '80px',
                      margin: 0,
                      borderTop: '1px solid var(--border-dim)',
                      paddingTop: '6px',
                      marginTop: '4px',
                    }}>
                      {typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Fallacies */}
        {turn.score.fallaciesDetected.length > 0 && (
          <Section label={`FALLACIES DETECTED (${turn.score.fallaciesDetected.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {turn.score.fallaciesDetected.map((f, i) => {
                const sev = FALLACY_SEVERITY[f.severity]
                return (
                  <div key={i} style={{
                    padding: '8px 10px',
                    background: sev.bg,
                    border: `1px solid ${sev.border}`,
                    borderRadius: '2px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: sev.color, fontWeight: 700 }}>
                        {f.type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {f.severity.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      {f.description}
                    </p>
                    {f.quote && (
                      <blockquote style={{
                        margin: '6px 0 0',
                        padding: '4px 8px',
                        borderLeft: `2px solid ${sev.color}`,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                      }}>
                        "{f.quote}"
                      </blockquote>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* Interrupt flag */}
        {turn.isInterrupt && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(245,166,35,0.08)',
            border: '1px solid var(--border-amber)',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ color: 'var(--amber)', fontSize: '14px' }}>⚡</span>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.12em', marginBottom: '2px' }}>
                HUMAN INTERRUPT
              </div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                This turn was triggered by a human injection from the interrupt panel.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border-dim)' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function ScoreCard({ label, value, color, highlight }: { label: string; value: number | string; color: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '8px',
      background: highlight ? `${color}0d` : 'var(--bg-elevated)',
      border: `1px solid ${highlight ? `${color}44` : 'var(--border-dim)'}`,
      borderRadius: '2px',
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '3px' }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    </div>
  )
}

const sentimentDisplay = (s: number) => `${s > 0 ? '+' : ''}${s.toFixed(2)}`
const sentimentColor = (s: number) => s > 0.2 ? 'var(--green-lock)' : s < -0.2 ? 'var(--red-hot)' : 'var(--amber)'