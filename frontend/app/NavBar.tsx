'use client'
// LOCATION: frontend/app/NavBar.tsx

import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export function NavBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, signOut, isAuthenticated, loading } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  // Hide navbar on auth pages
  if (pathname.startsWith('/auth')) return null

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: '52px',
      background: 'rgba(8,13,20,0.95)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(245,166,35,0.15)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: '32px',
    }}>
      {/* Logo */}
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <polygon points="10,1 19,7 19,13 10,19 1,13 1,7" stroke="#f5a623" strokeWidth="1.5" fill="none"/>
          <circle cx="10" cy="10" r="2" fill="#f5a623"/>
        </svg>
        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '13px', fontWeight: 700, letterSpacing: '0.2em', color: '#f5a623' }}>
          WARROOM
        </span>
      </a>

      {/* Nav links — only if logged in */}
      {isAuthenticated && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <NavLink href="/debate/new" label="New Debate" active={pathname.startsWith('/debate/new')} />
          <NavLink href="/history"    label="History"    active={pathname === '/history'} />
        </div>
      )}

      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>

        {/* Status pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 10px', border: '1px solid rgba(0,255,136,0.25)', borderRadius: '2px', background: 'rgba(0,255,136,0.04)' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '9px', color: '#00ff88', letterSpacing: '0.1em' }}>ONLINE</span>
        </div>

        {!loading && (
          isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* User name */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'USER'}
              </div>
              {/* Sign out */}
              <button
                onClick={handleSignOut}
                style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red-hot)'; e.currentTarget.style.color = 'var(--red-hot)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                SIGN OUT
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href="/auth/login">
                <button style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.12em', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-secondary)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
                >
                  SIGN IN
                </button>
              </a>
              <a href="/auth/signup">
                <button style={{ padding: '6px 14px', background: 'linear-gradient(135deg, rgba(245,166,35,0.15), rgba(245,166,35,0.05))', border: '1px solid var(--amber)', borderRadius: '2px', color: 'var(--amber)', fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.12em', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,166,35,0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,166,35,0.15), rgba(245,166,35,0.05))'}
                >
                  GET STARTED
                </button>
              </a>
            </div>
          )
        )}
      </div>
    </nav>
  )
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a href={href} style={{
      fontFamily: 'Rajdhani, sans-serif', fontSize: '13px', fontWeight: 600,
      letterSpacing: '0.12em', textTransform: 'uppercase' as const,
      color: active ? '#f5a623' : 'rgba(255,255,255,0.5)',
      textDecoration: 'none', transition: 'color 0.2s',
      borderBottom: active ? '1px solid #f5a623' : '1px solid transparent',
      paddingBottom: '2px',
    }}
    onMouseEnter={e => (e.currentTarget.style.color = '#f5a623')}
    onMouseLeave={e => (e.currentTarget.style.color = active ? '#f5a623' : 'rgba(255,255,255,0.5)')}
    >
      {label}
    </a>
  )
}