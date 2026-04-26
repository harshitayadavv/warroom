'use client'
// LOCATION: frontend/app/page.tsx

import { useEffect, useState } from 'react'
import Link from 'next/link'

const EXAMPLE_TOPICS = [
  { icon: '🐕', label: 'Should I buy a dog?',                  tag: 'Life Decision',  color: '#f5a623' },
  { icon: '💼', label: 'Should I quit my job and freelance?',   tag: 'Career',         color: '#9b59ff' },
  { icon: '🏠', label: 'Should I rent or buy a house in 2025?', tag: 'Finance',        color: '#00ff88' },
  { icon: '🤖', label: 'AI development should be paused now',   tag: 'Tech Policy',    color: '#1e90ff' },
  { icon: '⚡', label: 'Nuclear energy is key to net-zero',     tag: 'Climate',        color: '#00e5ff' },
  { icon: '💊', label: 'Should I try intermittent fasting?',    tag: 'Health',         color: '#ff3c3c' },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'You state a topic',
    desc: 'Anything — a life decision, a policy question, a personal dilemma. "Should I move to a new city?" works just as well as "Is democracy the best system?"',
    icon: '✏',
    color: '#f5a623',
  },
  {
    step: '02',
    title: 'Three AI agents debate it live',
    desc: 'The Proponent argues FOR. The Opponent argues AGAINST. The Fact-Checker audits every claim in real time. You watch it all stream live.',
    icon: '⚔',
    color: '#ff3c3c',
  },
  {
    step: '03',
    title: 'You can step in anytime',
    desc: 'Pause the debate, inject new evidence, challenge a point, or redirect the conversation. You are in control.',
    icon: '⚡',
    color: '#9b59ff',
  },
  {
    step: '04',
    title: 'The Judge delivers a verdict',
    desc: 'When consensus is reached (or rounds run out), a Judge reviews everything and gives you a clear recommendation — especially useful for personal decisions.',
    icon: '⚖',
    color: '#00ff88',
  },
]

const AGENTS = [
  {
    icon: '▲',
    name: 'Proponent',
    codename: 'AXIOM',
    color: '#00ff88',
    glow: 'rgba(0,255,136,0.1)',
    border: 'rgba(0,255,136,0.25)',
    role: 'Argues FOR the proposition',
    desc: 'Builds the strongest possible case in favour of your topic. Uses evidence, logic, and research to make the proposition sound as compelling as possible.',
    traits: ['Cites sources', 'Structured arguments', 'Responds to counter-attacks'],
  },
  {
    icon: '▼',
    name: 'Opponent',
    codename: 'REFUTE',
    color: '#ff3c3c',
    glow: 'rgba(255,60,60,0.1)',
    border: 'rgba(255,60,60,0.25)',
    role: 'Argues AGAINST the proposition',
    desc: 'Finds every weakness in the Proponent\'s case. Challenges assumptions, provides counter-evidence, and offers alternative perspectives.',
    traits: ['Finds edge cases', 'Provides alternatives', 'Challenges assumptions'],
  },
  {
    icon: '◆',
    name: 'Fact-Checker',
    codename: 'VERITAS',
    color: '#f5a623',
    glow: 'rgba(245,166,35,0.1)',
    border: 'rgba(245,166,35,0.25)',
    role: 'Neutral auditor of all claims',
    desc: 'Completely neutral. Searches the web in real time to verify or debunk statistics and claims. Detects logical fallacies and penalises fabricated data.',
    traits: ['Live web search', 'Fallacy detection', 'No bias — pure facts'],
  },
  {
    icon: '⚖',
    name: 'Judge',
    codename: 'ARBITER',
    color: '#1e90ff',
    glow: 'rgba(30,144,255,0.1)',
    border: 'rgba(30,144,255,0.25)',
    role: 'Scores rounds and delivers verdict',
    desc: 'Tracks argument quality, scores each turn on logic and evidence, and at the end delivers a final verdict with a clear recommendation for you.',
    traits: ['Scores every turn', 'Tracks consensus', 'Final recommendation'],
  },
]

export default function HomePage() {
  const [typed, setTyped] = useState('')
  const [topicIdx, setTopicIdx] = useState(0)
  const topics = EXAMPLE_TOPICS.map(t => t.label)

  useEffect(() => {
    const target = topics[topicIdx]
    let i = 0
    setTyped('')
    const t = setInterval(() => {
      setTyped(target.slice(0, i + 1))
      i++
      if (i >= target.length) {
        clearInterval(t)
        setTimeout(() => setTopicIdx(idx => (idx + 1) % topics.length), 2800)
      }
    }, 40)
    return () => clearInterval(t)
  }, [topicIdx])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)', overflowX: 'hidden' }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px 60px',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* Ambient glows */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '20%', left: '15%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.05), transparent 70%)', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,144,255,0.04), transparent 70%)', filter: 'blur(60px)' }} />
        </div>

        {/* Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px', opacity: 0.7 }}>
          <div style={{ width: '32px', height: '1px', background: 'var(--amber)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.25em', color: 'var(--amber)' }}>
            MULTI-AGENT DEBATE ARENA
          </span>
          <div style={{ width: '32px', height: '1px', background: 'var(--amber)' }} />
        </div>

        {/* Main heading */}
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(52px,11vw,110px)', fontWeight: 900, lineHeight: 0.9, marginBottom: '24px', letterSpacing: '-0.02em' }}>
          <span style={{ display: 'block', color: '#fff' }}>WAR</span>
          <span style={{ display: 'block', WebkitTextStroke: '1px rgba(245,166,35,0.8)', color: 'transparent' }}>ROOM</span>
        </h1>

        {/* Subtitle */}
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 'clamp(16px,2.5vw,22px)', color: 'var(--text-secondary)', maxWidth: '600px', lineHeight: 1.6, marginBottom: '40px' }}>
          Tell us anything — a life decision, a big question, or a controversial topic.
          Three AI agents will debate it, fact-check it, and give you a verdict.
        </p>

        {/* Animated topic */}
        <div style={{
          padding: '16px 28px',
          background: 'var(--bg-surface)',
          border: '1px solid rgba(245,166,35,0.25)',
          borderRadius: '4px',
          marginBottom: '40px',
          minHeight: '58px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '640px',
          width: '100%',
        }}>
          <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontSize: '12px', flexShrink: 0 }}>TOPIC</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', color: 'var(--text-primary)', textAlign: 'left' }}>
            {typed}<span style={{ animation: 'blink 1s step-end infinite', color: 'var(--amber)' }}>█</span>
          </span>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/auth/signup">
            <button style={{
              padding: '14px 40px',
              background: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))',
              border: '1px solid var(--amber)',
              borderRadius: '2px',
              color: 'var(--amber)',
              fontFamily: 'var(--font-display)',
              fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '0 0 24px rgba(245,166,35,0.15)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,166,35,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))'}
            >
              START FOR FREE
            </button>
          </Link>
          <Link href="#how-it-works">
            <button style={{
              padding: '14px 28px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: '2px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-display)',
              fontSize: '13px', fontWeight: 600,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              SEE HOW IT WORKS ↓
            </button>
          </Link>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '40px', marginTop: '72px', flexWrap: 'wrap', justifyContent: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '32px', width: '100%', maxWidth: '600px' }}>
          {[{ v: 'Any Topic', l: 'Personal or factual' }, { v: '< 2 min', l: 'First result' }, { v: 'Free', l: 'To get started' }].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, color: 'var(--amber)' }}>{s.v}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', marginTop: '4px' }}>{s.l.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHAT CAN YOU DEBATE ──────────────────────────────── */}
      <section style={{ padding: '80px 24px', background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', letterSpacing: '0.25em', marginBottom: '12px' }}>// ANY TOPIC WORKS</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,40px)', color: 'var(--text-primary)', fontWeight: 700 }}>
              From life decisions to world debates
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '12px', maxWidth: '560px', margin: '12px auto 0', fontFamily: 'var(--font-ui)', fontSize: '16px', lineHeight: 1.7 }}>
              WarRoom isn't just for academics or policy nerds. It's built for real questions — the ones keeping you up at night.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {EXAMPLE_TOPICS.map(t => (
              <Link key={t.label} href="/auth/signup" style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '16px 20px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '2px',
                  display: 'flex', alignItems: 'center', gap: '14px',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.color + '55'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <span style={{ fontSize: '24px', flexShrink: 0 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>{t.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: t.color, letterSpacing: '0.1em', marginTop: '4px' }}>{t.tag.toUpperCase()}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '14px' }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '80px 24px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', letterSpacing: '0.25em', marginBottom: '12px' }}>// SIMPLE AS 1-2-3-4</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,40px)', color: 'var(--text-primary)', fontWeight: 700 }}>How a debate works</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', padding: '32px 0', borderBottom: i < HOW_IT_WORKS.length - 1 ? '1px solid var(--border-dim)' : 'none' }}>
                {/* Step number */}
                <div style={{ flexShrink: 0, width: '64px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '40px', fontWeight: 900, color: step.color, opacity: 0.3, lineHeight: 1 }}>{step.step}</div>
                  <div style={{ fontSize: '20px', marginTop: '4px' }}>{step.icon}</div>
                </div>
                {/* Content */}
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em', marginBottom: '10px' }}>
                    {step.title}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MEET THE AGENTS ───────────────────────────────────── */}
      <section style={{ padding: '80px 24px', background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', letterSpacing: '0.25em', marginBottom: '12px' }}>// THE COUNCIL OF EXPERTS</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,40px)', color: 'var(--text-primary)', fontWeight: 700 }}>
              Meet your debate panel
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '12px', maxWidth: '560px', margin: '12px auto 0', fontFamily: 'var(--font-ui)', fontSize: '16px', lineHeight: 1.7 }}>
              Four specialised AI agents, each with a distinct role. None of them are trying to please you — they're trying to find the truth.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {AGENTS.map(agent => (
              <div key={agent.name} style={{
                padding: '28px 24px',
                background: agent.glow,
                border: `1px solid ${agent.border}`,
                borderRadius: '2px',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: agent.color, opacity: 0.6 }} />

                {/* Icon + Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${agent.color}1a`, border: `1px solid ${agent.color}44`, borderRadius: '2px', fontSize: '20px', color: agent.color, flexShrink: 0 }}>
                    {agent.icon}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{agent.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: agent.color, letterSpacing: '0.12em' }}>// {agent.codename}</div>
                  </div>
                </div>

                {/* Role tag */}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: agent.color, letterSpacing: '0.1em', marginBottom: '10px', padding: '3px 8px', background: `${agent.color}11`, border: `1px solid ${agent.color}33`, borderRadius: '2px', display: 'inline-block' }}>
                  {agent.role.toUpperCase()}
                </div>

                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
                  {agent.desc}
                </p>

                {/* Traits */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {agent.traits.map(trait => (
                    <div key={trait} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: agent.color, fontSize: '10px', flexShrink: 0 }}>✓</span>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>{trait}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section style={{ padding: '100px 24px', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,166,35,0.04), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', letterSpacing: '0.25em', marginBottom: '20px' }}>// FREE TO START</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,6vw,56px)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '20px', lineHeight: 1.1 }}>
          Stop guessing.<br />Start debating.
        </h2>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 40px', lineHeight: 1.7 }}>
          Create a free account and start your first debate in under 2 minutes. No credit card needed.
        </p>
        <Link href="/auth/signup">
          <button style={{
            padding: '16px 56px',
            background: 'linear-gradient(135deg, rgba(245,166,35,0.25), rgba(245,166,35,0.1))',
            border: '1px solid var(--amber)',
            borderRadius: '2px', cursor: 'pointer',
            color: 'var(--amber)',
            fontFamily: 'var(--font-display)',
            fontSize: '14px', fontWeight: 700,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            boxShadow: '0 0 32px rgba(245,166,35,0.15)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,166,35,0.3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,166,35,0.25), rgba(245,166,35,0.1))'}
          >
            CREATE FREE ACCOUNT
          </button>
        </Link>
        <div style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          Already have an account? <Link href="/auth/login" style={{ color: 'var(--amber)', textDecoration: 'none' }}>Sign in →</Link>
        </div>
      </section>

    </div>
  )
}