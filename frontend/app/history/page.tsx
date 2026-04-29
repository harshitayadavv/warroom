'use client'
// LOCATION: frontend/app/history/page.tsx

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import type { DebateSummary } from '@/lib/types'

const STATUS_META: Record<string, { color: string; label: string; dot: boolean }> = {
  running:            { color: '#00ff88', label: 'Live',      dot: true },
  paused:             { color: '#f5a623', label: 'Paused',    dot: false },
  consensus_reached:  { color: '#00ff88', label: 'Resolved',  dot: false },
  max_rounds_reached: { color: '#1e90ff', label: 'Concluded', dot: false },
  error:              { color: '#ff3c3c', label: 'Error',     dot: false },
  initializing:       { color: '#9b59ff', label: 'Starting',  dot: true },
  interrupted:        { color: '#f5a623', label: 'Paused',    dot: false },
}

export default function HistoryPage() {
  const router             = useRouter()
  const { isAuthenticated, loading: authLoading, accessToken, user } = useAuth()
  const [debates, setDebates] = useState<DebateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    api.debates.list(1, 50, accessToken)
      .then(r => setDebates(r.data as DebateSummary[]))
      .catch(() => setDebates([]))
      .finally(() => setLoading(false))
  }, [accessToken])

  const filtered = debates.filter(d =>
    d.topic.toLowerCase().includes(search.toLowerCase()) ||
    d.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const name = user?.user_metadata?.full_name || 'there'

  if (authLoading) return <LoadingScreen />

  return (
    <div style={{ minHeight: '100vh', maxWidth: '900px', margin: '0 auto', padding: '72px 24px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', letterSpacing: '0.25em', marginBottom: '6px' }}>// YOUR DEBATES</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, color: 'var(--text-primary)' }}>
            Hey, {name} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontFamily: 'var(--font-ui)', fontSize: '15px' }}>
            {debates.length > 0
              ? `You have ${debates.length} debate${debates.length === 1 ? '' : 's'} on record.`
              : "You haven't started any debates yet."}
          </p>
        </div>
        <Link href="/debate/new">
          <button style={{
            padding: '12px 28px',
            background: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))',
            border: '1px solid var(--amber)', borderRadius: '2px',
            color: 'var(--amber)', fontFamily: 'var(--font-display)',
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,166,35,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))'}
          >
            + NEW DEBATE
          </button>
        </Link>
      </div>

      {/* Search */}
      {debates.length > 0 && (
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px' }}>⌕</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search your debates..."
            style={{ width: '100%', padding: '11px 14px 11px 38px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--amber)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ height: '88px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '2px', opacity: 1 - i * 0.25, animation: 'pulse-dot 2s ease-in-out infinite' }} />
          ))}
        </div>
      ) : filtered.length === 0 && debates.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.15em' }}>No debates match "{search}"</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(d => <DebateCard key={d.id} debate={d} />)}
        </div>
      )}
    </div>
  )
}

function DebateCard({ debate }: { debate: DebateSummary }) {
  const meta = STATUS_META[debate.status] ?? { color: 'var(--text-muted)', label: debate.status, dot: false }
  const pct = Math.round((debate.consensusScore ?? (debate as any).consensus_score ?? 0) * 100)
  const isPersonal = (debate as any).personal_context_detected

  return (
    <Link href={`/debate/${debate.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        padding: '18px 22px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '2px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '16px',
        transition: 'all 0.2s',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.background = 'var(--bg-elevated)'; el.style.borderColor = 'rgba(245,166,35,0.25)'; el.style.transform = 'translateX(3px)' }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.background = 'var(--bg-surface)'; el.style.borderColor = 'var(--border-subtle)'; el.style.transform = 'translateX(0)' }}
      >
        {/* Left accent */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: meta.color, opacity: 0.7 }} />

        {/* Left */}
        <div style={{ paddingLeft: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '7px', flexWrap: 'wrap' }}>
            {/* Type badge */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', padding: '2px 7px', borderRadius: '2px', background: isPersonal ? 'rgba(155,89,255,0.1)' : 'rgba(30,144,255,0.08)', border: `1px solid ${isPersonal ? 'rgba(155,89,255,0.3)' : 'rgba(30,144,255,0.25)'}`, color: isPersonal ? 'var(--purple-ai)' : 'var(--blue-data)', letterSpacing: '0.08em' }}>
              {isPersonal ? '👤 PERSONAL' : '🌍 FACTUAL'}
            </span>
            {/* Status */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {meta.dot && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: meta.color, animation: 'pulse-dot 1.5s ease-in-out infinite', boxShadow: `0 0 5px ${meta.color}` }} />}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: meta.color, letterSpacing: '0.1em' }}>{meta.label.toUpperCase()}</span>
            </span>
            {/* Time */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
              {formatRelTime(debate.created_at as unknown as string)}
            </span>
          </div>

          {/* Topic */}
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, margin: 0 }}>
            {debate.topic}
          </p>

          {/* Tags */}
          {debate.tags?.length > 0 && (
            <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
              {debate.tags.map(t => (
                <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', padding: '1px 6px', borderRadius: '2px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-dim)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right - score */}
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 800, color: pct >= 85 ? '#00ff88' : pct > 60 ? '#f5a623' : '#1e90ff', lineHeight: 1 }}>
            {pct}%
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>CONSENSUS</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>R{debate.rounds}</div>
        </div>
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center', border: '1px dashed var(--border-subtle)', borderRadius: '2px' }}>
      <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.3 }}>⚔</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--text-primary)', marginBottom: '10px', fontWeight: 600 }}>
        No debates yet
      </h3>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '380px', margin: '0 auto 28px' }}>
        Ask anything — "Should I switch careers?", "Is remote work better?", or any topic you want a fresh perspective on.
      </p>
      <Link href="/debate/new">
        <button style={{
          padding: '12px 32px',
          background: 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))',
          border: '1px solid var(--amber)', borderRadius: '2px',
          color: 'var(--amber)', fontFamily: 'var(--font-display)',
          fontSize: '12px', fontWeight: 700, letterSpacing: '0.2em',
          cursor: 'pointer',
        }}>
          START YOUR FIRST DEBATE
        </button>
      </Link>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>LOADING...</div>
    </div>
  )
}

function formatRelTime(iso: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}