'use client'
import { useState, useRef, useEffect } from 'react'

type RedirectType = 'evidence' | 'clarification' | 'challenge' | 'redirect'

interface InterruptModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (message: string, type: RedirectType) => void
}

const REDIRECT_TYPES: { value: RedirectType; label: string; desc: string; color: string }[] = [
  { value: 'evidence', label: 'Inject Evidence', desc: 'Add new data or sources to consider', color: 'var(--blue-data)' },
  { value: 'clarification', label: 'Request Clarification', desc: 'Ask agents to elaborate on a point', color: 'var(--amber)' },
  { value: 'challenge', label: 'Challenge Logic', desc: 'Point out a flaw or inconsistency', color: 'var(--red-hot)' },
  { value: 'redirect', label: 'Redirect Focus', desc: 'Steer the debate toward a new angle', color: 'var(--purple-ai)' },
]

export function InterruptModal({ isOpen, onClose, onSubmit }: InterruptModalProps) {
  const [message, setMessage] = useState('')
  const [type, setType] = useState<RedirectType>('evidence')
  const [submitted, setSubmitted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100)
      setMessage('')
      setSubmitted(false)
    }
  }, [isOpen])

  const handleSubmit = () => {
    if (!message.trim()) return
    setSubmitted(true)
    onSubmit(message.trim(), type)
    setTimeout(() => {
      onClose()
      setSubmitted(false)
    }, 800)
  }

  const selectedMeta = REDIRECT_TYPES.find(t => t.value === type)!

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(3,5,8,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'fade-in 0.2s ease',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: '100%',
        maxWidth: '560px',
        background: 'var(--bg-surface)',
        border: '1px solid rgba(245,166,35,0.3)',
        borderRadius: '2px',
        overflow: 'hidden',
        boxShadow: '0 0 60px rgba(245,166,35,0.1), 0 24px 48px rgba(0,0,0,0.5)',
        animation: 'slide-in-up 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Top accent */}
        <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, var(--amber), transparent)' }} />

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', letterSpacing: '0.2em', marginBottom: '4px' }}>
              ⚡ HUMAN INTERRUPT
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '0.05em' }}>
              INJECT DIRECTIVE
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)', fontSize: '18px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-dim)', borderRadius: '2px', background: 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-dim)' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* Type selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.2em', display: 'block', marginBottom: '10px' }}>
              INTERRUPT TYPE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {REDIRECT_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  style={{
                    padding: '10px 12px',
                    background: type === t.value ? `${t.color}11` : 'var(--bg-elevated)',
                    border: `1px solid ${type === t.value ? t.color + '66' : 'var(--border-subtle)'}`,
                    borderRadius: '2px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: type === t.value ? t.color : 'var(--text-secondary)', letterSpacing: '0.08em', marginBottom: '3px', fontWeight: 600 }}>
                    {t.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.2em', display: 'block', marginBottom: '8px' }}>
              YOUR DIRECTIVE
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                height: '1px',
                background: `linear-gradient(90deg, transparent, ${selectedMeta.color}44, transparent)`,
                transition: 'all 0.3s',
              }} />
              <textarea
                ref={textareaRef}
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
                placeholder="e.g., 'According to the latest MIT study on climate models, the sea-level projections from 2019 have been revised upward by 40%...'"
                rows={5}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${selectedMeta.color}22`,
                  borderRadius: '2px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '14px',
                  lineHeight: 1.7,
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = selectedMeta.color + '66' }}
                onBlur={e => { e.currentTarget.style.borderColor = selectedMeta.color + '22' }}
              />
              <div style={{ position: 'absolute', bottom: '8px', right: '8px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
                {message.length} chars · ⌘↵ to send
              </div>
            </div>
          </div>

          {/* Warning */}
          <div style={{ padding: '8px 12px', background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.15)', borderRadius: '2px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--amber)', fontSize: '12px', marginTop: '1px' }}>⚠</span>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              This will pause the current agent mid-turn and inject your directive into the debate state. All agents will receive and react to your input before resuming.
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              ABORT
            </button>
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || submitted}
              style={{
                padding: '10px 28px',
                background: submitted ? 'var(--green-glow)' : `linear-gradient(135deg, ${selectedMeta.color}22, ${selectedMeta.color}11)`,
                border: `1px solid ${submitted ? 'var(--green-lock)' : selectedMeta.color}`,
                borderRadius: '2px',
                color: submitted ? 'var(--green-lock)' : selectedMeta.color,
                fontFamily: 'var(--font-display)',
                fontSize: '11px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                cursor: !message.trim() || submitted ? 'not-allowed' : 'pointer',
                opacity: !message.trim() ? 0.5 : 1,
                transition: 'all 0.3s',
              }}
            >
              {submitted ? '✓ INJECTED' : 'INJECT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}