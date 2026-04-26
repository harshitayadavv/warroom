// LOCATION: frontend/components/timeline/DebateTimeline.tsx
// Shows all saved checkpoints for a debate — click to restore, button to fork

'use client'
import { useState } from 'react'
import type { Tables } from '@/lib/supabase'

type Checkpoint = Tables['checkpoints']

interface DebateTimelineProps {
  checkpoints: Checkpoint[]
  currentRound: number
  onRestore: (checkpointId: string) => void
  onFork: (checkpointId: string) => void
}

export function DebateTimeline({ checkpoints, currentRound, onRestore, onFork }: DebateTimelineProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (checkpoints.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.15em' }}>
        NO CHECKPOINTS YET
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '0' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '14px' }}>
        TIME-TRAVEL — {checkpoints.length} CHECKPOINTS
      </div>

      <div style={{ position: 'relative' }}>
        {/* Vertical timeline line */}
        <div style={{
          position: 'absolute',
          left: '10px',
          top: '8px',
          bottom: '8px',
          width: '1px',
          background: 'linear-gradient(180deg, var(--amber) 0%, var(--border-subtle) 100%)',
        }} />

        {checkpoints.map((cp, idx) => {
          const isCurrent = cp.round === currentRound
          const isHovered = hoveredId === cp.id
          const isConfirm = confirmId === cp.id

          return (
            <div
              key={cp.id}
              style={{ position: 'relative', paddingLeft: '28px', paddingBottom: '16px' }}
              onMouseEnter={() => setHoveredId(cp.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Timeline dot */}
              <div style={{
                position: 'absolute',
                left: '5px',
                top: '6px',
                width: '11px',
                height: '11px',
                borderRadius: '50%',
                background: isCurrent ? 'var(--amber)' : isHovered ? 'var(--text-secondary)' : 'var(--bg-elevated)',
                border: `1px solid ${isCurrent ? 'var(--amber)' : 'var(--border-subtle)'}`,
                boxShadow: isCurrent ? '0 0 8px var(--amber)' : 'none',
                transition: 'all 0.2s',
                zIndex: 1,
              }} />

              {/* Card */}
              <div style={{
                padding: '8px 10px',
                background: isCurrent ? 'var(--amber-glow)' : isHovered ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                border: `1px solid ${isCurrent ? 'var(--border-amber)' : isHovered ? 'var(--border-subtle)' : 'var(--border-dim)'}`,
                borderRadius: '2px',
                transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: isCurrent ? 'var(--amber)' : 'var(--text-primary)', fontWeight: 600 }}>
                      R{cp.round}
                    </span>
                    {isCurrent && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--amber)', padding: '1px 5px', border: '1px solid var(--border-amber)', borderRadius: '2px' }}>
                        NOW
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>
                    {new Date(cp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {cp.label && (
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 6px', lineHeight: 1.4 }}>
                    {cp.label}
                  </p>
                )}

                {/* Action buttons — show on hover, hide on current */}
                {isHovered && !isCurrent && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    {isConfirm ? (
                      <>
                        <button
                          onClick={() => { onRestore(cp.id); setConfirmId(null) }}
                          style={{ flex: 1, padding: '4px 8px', background: 'var(--amber-glow)', border: '1px solid var(--amber)', borderRadius: '2px', color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontSize: '9px', cursor: 'pointer', letterSpacing: '0.08em' }}
                        >
                          CONFIRM RESTORE
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '9px', cursor: 'pointer' }}
                        >
                          CANCEL
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmId(cp.id)}
                          style={{ flex: 1, padding: '4px 8px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '9px', cursor: 'pointer', letterSpacing: '0.08em', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                        >
                          ↩ RESTORE
                        </button>
                        <button
                          onClick={() => onFork(cp.id)}
                          style={{ flex: 1, padding: '4px 8px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '9px', cursor: 'pointer', letterSpacing: '0.08em', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--purple-ai)'; e.currentTarget.style.color = 'var(--purple-ai)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                        >
                          ⑂ FORK
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}