'use client'
import { AgentState, AgentRole } from '@/lib/types'

const ROLE_META: Record<AgentRole, { color: string; glow: string; border: string; icon: string; label: string }> = {
  proponent: {
    color: 'var(--green-lock)',
    glow: 'rgba(0,255,136,0.08)',
    border: 'rgba(0,255,136,0.25)',
    icon: '▲',
    label: 'PROPONENT',
  },
  opponent: {
    color: 'var(--red-hot)',
    glow: 'rgba(255,60,60,0.08)',
    border: 'rgba(255,60,60,0.25)',
    icon: '▼',
    label: 'OPPONENT',
  },
  fact_checker: {
    color: 'var(--amber)',
    glow: 'rgba(245,166,35,0.08)',
    border: 'rgba(245,166,35,0.25)',
    icon: '◆',
    label: 'FACT-CHECKER',
  },
  moderator: {
    color: 'var(--blue-data)',
    glow: 'rgba(30,144,255,0.08)',
    border: 'rgba(30,144,255,0.25)',
    icon: '◉',
    label: 'MODERATOR',
  },
}

const STATUS_LABELS: Record<string, string> = {
  idle: 'STANDBY',
  thinking: 'PROCESSING',
  speaking: 'TRANSMITTING',
  searching: 'WEB SEARCH',
  computing: 'COMPUTING',
  done: 'COMPLETE',
}

interface AgentCardProps {
  agent: AgentState
  isActive?: boolean
  currentThought?: string
  compact?: boolean
}

export function AgentCard({ agent, isActive, currentThought, compact = false }: AgentCardProps) {
  const meta = ROLE_META[agent.config.role]
  const { status, score, config, toolsInUse } = agent

  return (
    <div style={{
      padding: compact ? '12px 16px' : '20px',
      background: isActive ? `linear-gradient(135deg, ${meta.glow} 0%, var(--bg-surface) 100%)` : 'var(--bg-surface)',
      border: `1px solid ${isActive ? meta.border : 'var(--border-subtle)'}`,
      borderRadius: '2px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      {/* Active indicator bar */}
      {isActive && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`,
          animation: 'shimmer 2s linear infinite',
        }} />
      )}

      {/* Scanning beam for active state */}
      {isActive && status === 'thinking' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, transparent 40%, ${meta.glow} 50%, transparent 60%)`,
          animation: 'scan-beam 2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes scan-beam {
          0%, 100% { transform: translateY(-100%); }
          50% { transform: translateY(100%); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: compact ? '8px' : '16px' }}>
        {/* Icon */}
        <div style={{
          width: compact ? '28px' : '36px',
          height: compact ? '28px' : '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${meta.glow}`,
          border: `1px solid ${meta.border}`,
          borderRadius: '2px',
          color: meta.color,
          fontSize: compact ? '12px' : '16px',
          flexShrink: 0,
        }}>
          {meta.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: meta.color, letterSpacing: '0.15em' }}>
            {meta.label}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {config.name}
          </div>
        </div>

        {/* Status badge */}
        <StatusBadge status={status} color={meta.color} isActive={isActive} />
      </div>

      {/* Tool indicators */}
      {toolsInUse.length > 0 && !compact && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {toolsInUse.map(tool => (
            <span key={tool} className="tag tag-amber" style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }}>
              <span>⚡</span> {tool.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Thinking display */}
      {isActive && currentThought && !compact && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-dim)',
          borderRadius: '2px',
          marginBottom: '12px',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          maxHeight: '80px',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: '6px', left: '8px', fontFamily: 'var(--font-mono)', fontSize: '8px', color: meta.color, opacity: 0.7 }}>// THOUGHT</div>
          <div style={{ marginTop: '14px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {currentThought}
          </div>
        </div>
      )}

      {/* Scores */}
      {!compact && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <ScoreBar label="Logic" value={score.logicScore} color={meta.color} />
          <ScoreBar label="Evidence" value={score.evidenceScore} color={meta.color} />
        </div>
      )}

      {/* Compact score */}
      {compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>SCORE</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: meta.color }}>
            {score.totalScore}
          </span>
        </div>
      )}

      {/* Fallacy warnings */}
      {score.fallaciesDetected.length > 0 && !compact && (
        <div style={{ marginTop: '8px', padding: '6px 8px', background: 'var(--red-glow)', border: '1px solid var(--border-red)', borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px' }}>⚠</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red-hot)' }}>
            {score.fallaciesDetected.length} fallac{score.fallaciesDetected.length === 1 ? 'y' : 'ies'} detected
          </span>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, color, isActive }: { status: string; color: string; isActive?: boolean }) {
  const isLive = isActive && ['thinking', 'speaking', 'searching', 'computing'].includes(status)
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      background: isLive ? `${color}11` : 'transparent',
      border: `1px solid ${isLive ? color + '44' : 'var(--border-dim)'}`,
      borderRadius: '2px',
      flexShrink: 0,
    }}>
      <span className="status-dot" style={{
        background: isLive ? color : 'var(--text-muted)',
        boxShadow: isLive ? `0 0 6px ${color}` : 'none',
        animation: isLive ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
      }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', color: isLive ? color : 'var(--text-muted)' }}>
        {STATUS_LABELS[status] ?? status.toUpperCase()}
      </span>
    </div>
  )
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{label.toUpperCase()}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color }}>{value}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 6px ${color}` }} />
      </div>
    </div>
  )
}