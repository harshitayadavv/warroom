'use client'
// LOCATION: frontend/app/auth/login/page.tsx

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/auth/AuthLayout'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/debate/new')
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your WarRoom account">
      <form
        onSubmit={handleLogin}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <Field label="EMAIL"    type="email"    value={email}    onChange={setEmail}    placeholder="you@example.com" />
        <Field label="PASSWORD" type="password" value={password} onChange={setPassword} placeholder="Your password" />

        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--red-glow)',
            border: '1px solid var(--border-red)',
            borderRadius: '2px',
            fontFamily: 'var(--font-mono)', fontSize: '11px',
            color: 'var(--red-hot)',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '12px', marginTop: '4px',
            background: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))',
            border: '1px solid var(--amber)', borderRadius: '2px',
            color: 'var(--amber)', fontFamily: 'var(--font-display)',
            fontSize: '12px', fontWeight: 700, letterSpacing: '0.2em',
            cursor: loading ? 'wait' : 'pointer', transition: 'all 0.2s',
          }}
        >
          {loading ? '⟳ SIGNING IN...' : 'SIGN IN'}
        </button>

        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          color: 'var(--text-muted)', letterSpacing: '0.08em',
        }}>
          <Link href="/auth/signup" style={{ color: 'var(--amber)', textDecoration: 'none' }}>
            Create account →
          </Link>
          <Link href="/auth/reset" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Forgot password?
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({
  label, type, value, onChange, placeholder,
}: {
  label: string; type: string; value: string
  onChange: (v: string) => void; placeholder: string
}) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '9px',
        color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '6px',
      }}>
        {label}
      </div>
      <input
        type={type} value={value} placeholder={placeholder} required
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '2px',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)', fontSize: '14px',
          outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)' }}
        onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
      />
    </div>
  )
}