'use client'
// LOCATION: frontend/app/auth/signup/page.tsx

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [done,     setDone]     = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } },
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Start debating anything in 2 minutes"
    >
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>✉</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--green-lock)', marginBottom: '8px' }}>Check your email</h3>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
            Click it to activate your account.
          </p>
          <Link href="/auth/login">
            <button style={btnStyle('ghost')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
              BACK TO LOGIN
            </button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label="YOUR NAME" type="text" value={name} onChange={setName} placeholder="e.g. Harshita" />
          <Field label="EMAIL"     type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <Field label="PASSWORD"  type="password" value={password} onChange={setPassword} placeholder="Min 8 characters" />

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--red-glow)', border: '1px solid var(--border-red)', borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red-hot)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={btnStyle('primary')}>
            {loading ? '⟳ CREATING ACCOUNT...' : 'CREATE FREE ACCOUNT'}
          </button>

          <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: 'var(--amber)', textDecoration: 'none' }}>Sign in →</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}

// ── Helpers shared across auth pages ──────────────────────────

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg-void)',
    }}>
      {/* Glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 40% at 50% 40%, rgba(245,166,35,0.04), transparent)' }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 900, letterSpacing: '0.2em', color: 'var(--amber)' }}>⚔ WARROOM</span>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '2px',
          padding: '36px 32px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, var(--amber), transparent)', borderRadius: '2px 2px 0 0' }} />

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '0.05em' }}>{title}</h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '28px' }}>{subtitle}</p>

          {children}
        </div>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder }: { label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '6px' }}>{label}</div>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} required
        style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: '14px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
        onFocus={e => e.currentTarget.style.borderColor = 'var(--amber)'}
        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
      />
    </div>
  )
}

function btnStyle(variant: 'primary' | 'ghost'): React.CSSProperties {
  if (variant === 'primary') return {
    width: '100%', padding: '12px',
    background: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))',
    border: '1px solid var(--amber)', borderRadius: '2px',
    color: 'var(--amber)', fontFamily: 'var(--font-display)',
    fontSize: '12px', fontWeight: 700, letterSpacing: '0.2em',
    cursor: 'pointer', transition: 'all 0.2s', marginTop: '4px',
  }
  return {
    width: '100%', padding: '12px', marginTop: '16px',
    background: 'transparent', border: '1px solid var(--border-subtle)',
    borderRadius: '2px', color: 'var(--text-secondary)',
    fontFamily: 'var(--font-display)', fontSize: '12px',
    letterSpacing: '0.15em', cursor: 'pointer', transition: 'all 0.2s',
  }
}

const hoverIn  = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }
const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }