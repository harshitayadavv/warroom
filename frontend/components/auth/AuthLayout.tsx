'use client'
// LOCATION: frontend/components/auth/AuthLayout.tsx
// Shared layout for login + signup pages
// Extracted from signup/page.tsx so Next.js doesn't treat it as a page export

import Link from 'next/link'

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title:    string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      minHeight:       '100vh',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '24px',
      background:      'var(--bg-void)',
    }}>
      {/* Ambient glow */}
      <div style={{
        position:   'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 40% at 50% 40%, rgba(245,166,35,0.04), transparent)',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{
              fontFamily:    'var(--font-display)',
              fontSize:      '22px',
              fontWeight:    900,
              letterSpacing: '0.2em',
              color:         'var(--amber)',
            }}>
              ⚔ WARROOM
            </span>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          position:  'relative',
          background: 'var(--bg-surface)',
          border:     '1px solid var(--border-subtle)',
          borderRadius: '2px',
          padding:    '36px 32px',
          boxShadow:  '0 24px 48px rgba(0,0,0,0.4)',
        }}>
          {/* Top accent line */}
          <div style={{
            position:     'absolute',
            top: 0, left: 0, right: 0,
            height:       '2px',
            background:   'linear-gradient(90deg, transparent, var(--amber), transparent)',
            borderRadius: '2px 2px 0 0',
          }} />

          <h1 style={{
            fontFamily:    'var(--font-display)',
            fontSize:      '22px',
            fontWeight:    700,
            color:         'var(--text-primary)',
            marginBottom:  '6px',
            letterSpacing: '0.05em',
          }}>
            {title}
          </h1>
          <p style={{
            fontFamily:   'var(--font-ui)',
            fontSize:     '14px',
            color:        'var(--text-muted)',
            marginBottom: '28px',
          }}>
            {subtitle}
          </p>

          {children}
        </div>
      </div>
    </div>
  )
}