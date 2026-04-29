// LOCATION: frontend/components/ui/Button.tsx

'use client'
import { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'ghost' | 'danger' | 'success' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, { bg: string; border: string; color: string; hoverBg: string; hoverBorder: string; shadow?: string }> = {
  primary: {
    bg: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))',
    border: 'var(--amber)',
    color: 'var(--amber)',
    hoverBg: 'rgba(245,166,35,0.25)',
    hoverBorder: 'var(--amber)',
    shadow: '0 0 20px rgba(245,166,35,0.15)',
  },
  ghost: {
    bg: 'transparent',
    border: 'var(--border-subtle)',
    color: 'var(--text-secondary)',
    hoverBg: 'rgba(255,255,255,0.04)',
    hoverBorder: 'var(--border-subtle)',
  },
  danger: {
    bg: 'rgba(255,60,60,0.08)',
    border: 'rgba(255,60,60,0.4)',
    color: 'var(--red-hot)',
    hoverBg: 'rgba(255,60,60,0.15)',
    hoverBorder: 'var(--red-hot)',
  },
  success: {
    bg: 'rgba(0,255,136,0.08)',
    border: 'rgba(0,255,136,0.4)',
    color: 'var(--green-lock)',
    hoverBg: 'rgba(0,255,136,0.15)',
    hoverBorder: 'var(--green-lock)',
  },
  outline: {
    bg: 'transparent',
    border: 'var(--border-subtle)',
    color: 'var(--text-primary)',
    hoverBg: 'var(--bg-elevated)',
    hoverBorder: 'var(--amber)',
  },
}

const SIZES: Record<Size, { padding: string; fontSize: string; height: string }> = {
  sm: { padding: '0 12px', fontSize: '10px', height: '28px' },
  md: { padding: '0 20px', fontSize: '11px', height: '36px' },
  lg: { padding: '0 32px', fontSize: '13px', height: '44px' },
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  fullWidth?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  style,
  onMouseEnter,
  onMouseLeave,
  ...props
}: ButtonProps) {
  const v = VARIANTS[variant]
  const s = SIZES[size]
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        height: s.height,
        padding: s.padding,
        width: fullWidth ? '100%' : undefined,
        background: v.bg,
        border: `1px solid ${v.border}`,
        borderRadius: '2px',
        color: v.color,
        fontFamily: 'var(--font-display)',
        fontSize: s.fontSize,
        fontWeight: 600,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.45 : 1,
        transition: 'all 0.2s ease',
        boxShadow: v.shadow,
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={e => {
        if (!isDisabled) {
          const el = e.currentTarget
          el.style.background = v.hoverBg
          el.style.borderColor = v.hoverBorder
          el.style.transform = 'translateY(-1px)'
        }
        onMouseEnter?.(e)
      }}
      onMouseLeave={e => {
        if (!isDisabled) {
          const el = e.currentTarget
          el.style.background = v.bg
          el.style.borderColor = v.border
          el.style.transform = 'translateY(0)'
        }
        onMouseLeave?.(e)
      }}
      {...props}
    >
      {loading ? <Spinner color={v.color} /> : icon}
      {children}
    </button>
  )
}

function Spinner({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="6" cy="6" r="4.5" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="14 8" strokeLinecap="round" />
    </svg>
  )
}