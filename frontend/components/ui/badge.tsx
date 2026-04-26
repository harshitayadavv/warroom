// LOCATION: frontend/components/ui/Badge.tsx

'use client'
import { ReactNode } from 'react'

type BadgeVariant = 'amber' | 'red' | 'green' | 'blue' | 'purple' | 'gray'

const BADGE_META: Record<BadgeVariant, { bg: string; border: string; color: string }> = {
  amber:  { bg: 'rgba(245,166,35,0.1)',   border: 'rgba(245,166,35,0.35)',  color: 'var(--amber)' },
  red:    { bg: 'rgba(255,60,60,0.1)',    border: 'rgba(255,60,60,0.35)',   color: 'var(--red-hot)' },
  green:  { bg: 'rgba(0,255,136,0.08)',   border: 'rgba(0,255,136,0.35)',   color: 'var(--green-lock)' },
  blue:   { bg: 'rgba(30,144,255,0.1)',   border: 'rgba(30,144,255,0.35)',  color: 'var(--blue-data)' },
  purple: { bg: 'rgba(155,89,255,0.1)',   border: 'rgba(155,89,255,0.35)', color: 'var(--purple-ai)' },
  gray:   { bg: 'rgba(255,255,255,0.05)', border: 'var(--border-subtle)',   color: 'var(--text-secondary)' },
}

interface BadgeProps {
  variant?: BadgeVariant
  dot?: boolean
  children: ReactNode
}

export function Badge({ variant = 'gray', dot = false, children }: BadgeProps) {
  const m = BADGE_META[variant]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '2px 8px',
      background: m.bg,
      border: `1px solid ${m.border}`,
      borderRadius: '2px',
      fontFamily: 'var(--font-mono)',
      fontSize: '9px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: m.color,
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{
          width: '5px', height: '5px',
          borderRadius: '50%',
          background: m.color,
          flexShrink: 0,
          boxShadow: `0 0 5px ${m.color}`,
          animation: 'pulse-dot 2s ease-in-out infinite',
        }} />
      )}
      {children}
    </span>
  )
}