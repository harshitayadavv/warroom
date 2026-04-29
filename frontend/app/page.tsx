'use client'
// LOCATION: frontend/app/page.tsx
// If user is already logged in → redirect to /debate/new immediately

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

const TOPICS = [
  'Should I buy a dog?',
  'Should I quit my job and freelance?',
  'Should I move to a new city?',
  'Nuclear energy is essential for net-zero',
  'AI development should be paused now',
  'Social media does more harm than good',
]

const AGENTS = [
  { icon: '▲', name: 'Proponent',    color: '#00ff88', desc: 'Argues FOR your topic with evidence and logic' },
  { icon: '▼', name: 'Opponent',     color: '#ff3c3c', desc: 'Argues AGAINST and finds every weakness' },
  { icon: '◆', name: 'Fact-Checker', color: '#f5a623', desc: 'Neutral auditor — verifies every claim in real time' },
  { icon: '⚖', name: 'Judge',        color: '#1e90ff', desc: 'Scores each turn and delivers a final verdict' },
]

export default function HomePage() {
  const router        = useRouter()
  const { isAuthenticated, loading } = useAuth()
  const [topicIdx, setTopicIdx] = useState(0)
  const [typed,    setTyped]    = useState('')

  // If logged in, go straight to debate creation
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/debate/new')
    }
  }, [loading, isAuthenticated, router])

  // Typing animation
  useEffect(() => {
    const target = TOPICS[topicIdx]
    let i = 0
    setTyped('')
    const t = setInterval(() => {
      setTyped(target.slice(0, ++i))
      if (i >= target.length) {
        clearInterval(t)
        setTimeout(() => setTopicIdx(x => (x + 1) % TOPICS.length), 2500)
      }
    }, 40)
    return () => clearInterval(t)
  }, [topicIdx])

  // Show nothing while checking auth (prevents flash)
  if (loading || isAuthenticated) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>
        {isAuthenticated ? 'REDIRECTING...' : 'LOADING...'}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', overflow: 'hidden' }}>

      {/* Ambient glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '20%', left: '20%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.05), transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,144,255,0.04), transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 60px', textAlign: 'center', position: 'relative' }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.3em', color: 'var(--amber)', marginBottom: '24px', opacity: 0.8 }}>
          ── MULTI-AGENT DEBATE ARENA ──
        </div>

        <h1 style={{ fontFamily: 'Orbitron, monospace', fontSize: 'clamp(56px,12vw,120px)', fontWeight: 900, lineHeight: 0.9, marginBottom: '28px', letterSpacing: '-0.02em' }}>
          <span style={{ display: 'block', color: '#fff' }}>WAR</span>
          <span style={{ display: 'block', WebkitTextStroke: '1px rgba(245,166,35,0.8)', color: 'transparent' }}>ROOM</span>
        </h1>

        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 'clamp(16px,2.5vw,20px)', color: 'var(--text-secondary)', maxWidth: '560px', lineHeight: 1.7, marginBottom: '36px' }}>
          Ask anything — a life decision or a world debate. Three AI agents argue it out and a Judge gives you a clear verdict.
        </p>

        {/* Animated topic */}
        <div style={{ padding: '14px 24px', background: 'var(--bg-surface)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: '4px', marginBottom: '36px', maxWidth: '600px', width: '100%', minHeight: '52px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', letterSpacing: '0.15em', flexShrink: 0 }}>TOPIC</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', color: 'var(--text-primary)', textAlign: 'left' }}>
            {typed}<span style={{ animation: 'blink 1s step-end infinite', color: 'var(--amber)' }}>█</span>
          </span>
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '60px' }}>
          <Link href="/auth/signup">
            <button style={{
              padding: '14px 44px',
              background: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))',
              border: '1px solid var(--amber)',
              borderRadius: '4px',
              color: 'var(--amber)',
              fontFamily: 'Orbitron, monospace',
              fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.15em',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 0 24px rgba(245,166,35,0.15)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,166,35,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))'}
            >
              START FREE
            </button>
          </Link>
          <Link href="/auth/login">
            <button style={{
              padding: '14px 28px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              fontFamily: 'Orbitron, monospace',
              fontSize: '13px',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              SIGN IN
            </button>
          </Link>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '48px', borderTop: '1px solid var(--border-subtle)', paddingTop: '32px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[{ v: 'Any Topic', l: 'Personal or factual' }, { v: '~2 min', l: 'Per round' }, { v: 'Free', l: 'No credit card' }].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '22px', fontWeight: 800, color: 'var(--amber)' }}>{s.v}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', marginTop: '4px', textTransform: 'uppercase' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', letterSpacing: '0.25em', marginBottom: '10px' }}>// HOW IT WORKS</div>
            <h2 style={{ fontFamily: 'Orbitron, monospace', fontSize: 'clamp(24px,4vw,36px)', color: 'var(--text-primary)', fontWeight: 700 }}>Four agents, one verdict</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
            {AGENTS.map((a, i) => (
              <div key={a.name} style={{ padding: '20px', background: 'var(--bg-surface)', border: `1px solid ${a.color}22`, borderRadius: '4px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: a.color, opacity: 0.5, borderRadius: '4px 4px 0 0' }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: a.color, marginBottom: '8px' }}>{a.icon}</div>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '0.05em' }}>{a.name}</div>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Orbitron, monospace', fontSize: 'clamp(28px,5vw,48px)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '16px' }}>
          Stop second-guessing.
        </h2>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '480px', margin: '0 auto 32px', lineHeight: 1.7 }}>
          Get both sides of any decision argued out by AI — then decide with confidence.
        </p>
        <Link href="/auth/signup">
          <button style={{
            padding: '16px 56px',
            background: 'linear-gradient(135deg, rgba(245,166,35,0.22), rgba(245,166,35,0.08))',
            border: '1px solid var(--amber)',
            borderRadius: '4px',
            color: 'var(--amber)',
            fontFamily: 'Orbitron, monospace',
            fontSize: '14px', fontWeight: 700,
            letterSpacing: '0.15em',
            cursor: 'pointer',
            boxShadow: '0 0 32px rgba(245,166,35,0.12)',
          }}>
            CREATE FREE ACCOUNT
          </button>
        </Link>
      </section>
    </div>
  )
}