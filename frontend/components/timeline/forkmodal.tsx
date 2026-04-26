// LOCATION: frontend/components/timeline/ForkModal.tsx
// Confirms debate fork from a checkpoint — lets user optionally change topic or agent config

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tables } from '@/lib/supabase'

type Checkpoint = Tables['checkpoints']

interface ForkModalProps {
  checkpoint: Checkpoint
  currentTopic: string
  isOpen: boolean
  onClose: () => void
  onConfirm: (checkpointId: string, newTopic?: string) => Promise<{ newDebateId: string } | null>
}

export function ForkModal({ checkpoint, currentTopic, isOpen, onClose, onConfirm }: ForkModalProps) {
  const router = useRouter()
  const [newTopic, setNewTopic] = useState(currentTopic)
  const [changeTopic, setChangeTopic] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setLoading(true)
    const result = await onConfirm(checkpoint.id, changeTopic ? newTopic : undefined)
    if (result?.newDebateId) {
      setDone(true)
      setTimeout(() => router.push(`/debate/${result.newDebateId}`), 1200)
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(3,5,8,0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'fade-in 0.2s ease',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: '100%', maxWidth: '480px',
        background: 'var(--bg-surface)',
        border: '1px solid rgba(155,89,255,0.35)',
        borderRadius: '2px',
        overflow: 'hidden',
        animation: 'slide-in-up 0.3s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: '0 0 60px rgba(155,89,255,0.08), 0 24px 48px rgba(0,0,0,0.5)',
      }}>
        {/* Top accent */}
        <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #9b59ff, transparent)' }} />

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--purple-ai)', letterSpacing: '0.2em', marginBottom: '4px' }}>
            ⑂ FORK DEBATE
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '0.05em', margin: 0 }}>
            BRANCH FROM ROUND {checkpoint.round}
          </h2>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* What forking does */}
          <div style={{ padding: '12px', background: 'rgba(155,89,255,0.06)', border: '1px solid rgba(155,89,255,0.2)', borderRadius: '2px', marginBottom: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--purple-ai)', letterSpacing: '0.12em', marginBottom: '6px' }}>WHAT HAPPENS</div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              A new debate is created using the exact agent state, scores, and argument context from Round {checkpoint.round}. The original debate is unaffected. You can optionally change the topic to explore a different angle.
            </p>
          </div>

          {/* Checkpoint info */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <InfoChip label="FORK POINT" value={`Round ${checkpoint.round}`} />
            <InfoChip label="CREATED" value={new Date(checkpoint.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
            {checkpoint.label && <InfoChip label="LABEL" value={checkpoint.label} />}
          </div>

          {/* Optionally change topic */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}>
              <div
                onClick={() => setChangeTopic(c => !c)}
                style={{
                  width: '32px', height: '16px',
                  background: changeTopic ? 'var(--purple-ai)' : 'var(--bg-elevated)',
                  border: `1px solid ${changeTopic ? 'var(--purple-ai)' : 'var(--border-subtle)'}`,
                  borderRadius: '8px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px',
                  left: changeTopic ? '16px' : '2px',
                  width: '10px', height: '10px',
                  borderRadius: '50%',
                  background: changeTopic ? 'white' : 'var(--text-muted)',
                  transition: 'left 0.3s',
                }} />
              </div>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Change topic on fork
              </span>
            </label>

            {changeTopic && (
              <textarea
                value={newTopic}
                onChange={e => setNewTopic(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid rgba(155,89,255,0.35)',
                  borderRadius: '2px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                  animation: 'slide-in-up 0.2s ease',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--purple-ai)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(155,89,255,0.35)'}
              />
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.15em', cursor: 'pointer' }}
            >
              CANCEL
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || done}
              style={{
                flex: 2, padding: '11px',
                background: done ? 'rgba(0,255,136,0.1)' : 'rgba(155,89,255,0.12)',
                border: `1px solid ${done ? 'var(--green-lock)' : 'var(--purple-ai)'}`,
                borderRadius: '2px',
                color: done ? 'var(--green-lock)' : 'var(--purple-ai)',
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.15em',
                cursor: loading || done ? 'wait' : 'pointer',
                transition: 'all 0.3s',
              }}
            >
              {done ? '✓ FORKED — REDIRECTING' : loading ? '⟳ FORKING...' : '⑂ CONFIRM FORK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-dim)', borderRadius: '2px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--purple-ai)', fontWeight: 600 }}>{value}</div>
    </div>
  )
}