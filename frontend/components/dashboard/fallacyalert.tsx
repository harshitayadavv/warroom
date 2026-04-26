// LOCATION: frontend/components/dashboard/FallacyAlert.tsx
// Toast-style alert that fires when the Fact-Checker detects a logical fallacy

'use client'
import { useEffect, useState } from 'react'
import type { Fallacy, AgentRole } from '@/lib/types'

interface FallacyAlertProps {
  fallacy: Fallacy
  agentRole: AgentRole
  onDismiss: () => void
}

const SEVERITY_META = {
  high:   { color: 'var(--red-hot)',    bg: 'rgba(255,60,60,0.1)',   border: 'rgba(255,60,60,0.4)',  label: 'HIGH' },
  medium: { color: 'var(--amber)',       bg: 'rgba(245,166,35,0.1)',  border: 'rgba(245,166,35,0.4)', label: 'MED' },
  low:    { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)', border: 'var(--border-subtle)', label: 'LOW' },
}

const ROLE_LABELS: Record<AgentRole, string> = {
  proponent:    'Proponent',
  opponent:     'Opponent',
  fact_checker: 'Fact-Checker',
  moderator:    'Moderator',
}

export function FallacyAlert({ fallacy, agentRole, onDismiss }: FallacyAlertProps) {
  const [visible, setVisible] = useState(false)
  const meta = SEVERITY_META[fallacy.severity]

  useEffect(() => {
    // Animate in
    setTimeout(() => setVisible(true), 10)
    // Auto-dismiss after 8s
    const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300) }, 8000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div style={{
      padding: '12px 14px',
      background: meta.bg,
      border: `1px solid ${meta.border}`,
      borderRadius: '2px',
      position: 'relative',
      overflow: 'hidden',
      transform: visible ? 'translateX(0)' : 'translateX(110%)',
      opacity: visible ? 1 : 0,
      transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
      maxWidth: '320px',
    }}>
      {/* Top accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: meta.color }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{ fontSize: '16px', color: meta.color, flexShrink: 0, marginTop: '1px' }}>⚠</span>
        <div style={{ flex: 1 }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: meta.color, fontWeight: 700, letterSpacing: '0.12em' }}>
              {fallacy.type.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', padding: '1px 5px', border: '1px solid var(--border-dim)', borderRadius: '2px' }}>
              {meta.label}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
              {ROLE_LABELS[agentRole]}
            </span>
          </div>

          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 6px' }}>
            {fallacy.description}
          </p>

          {fallacy.quote && (
            <div style={{
              padding: '4px 8px',
              borderLeft: `2px solid ${meta.color}`,
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}>
              "{fallacy.quote.slice(0, 80)}{fallacy.quote.length > 80 ? '…' : ''}"
            </div>
          )}
        </div>

        <button
          onClick={() => { setVisible(false); setTimeout(onDismiss, 300) }}
          style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', flexShrink: 0, lineHeight: 1, padding: '2px' }}
        >✕</button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.05)' }}>
        <div style={{
          height: '100%',
          background: meta.color,
          animation: 'fallacy-dismiss 8s linear forwards',
        }} />
      </div>
      <style>{`@keyframes fallacy-dismiss { from { width: 100% } to { width: 0% } }`}</style>
    </div>
  )
}

// ── Toast container — renders stack of active fallacy alerts ──

interface FallacyToastStackProps {
  alerts: Array<{ id: string; fallacy: Fallacy; agentRole: AgentRole }>
  onDismiss: (id: string) => void
}

export function FallacyToastStack({ alerts, onDismiss }: FallacyToastStackProps) {
  if (alerts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 500,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {alerts.map(a => (
        <FallacyAlert
          key={a.id}
          fallacy={a.fallacy}
          agentRole={a.agentRole}
          onDismiss={() => onDismiss(a.id)}
        />
      ))}
    </div>
  )
}