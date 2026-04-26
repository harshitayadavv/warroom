// LOCATION: frontend/components/dashboard/LiveMetrics.tsx
// Compact metrics bar at the top of the arena — shows latency, token usage, tool calls

'use client'

interface LiveMetricsProps {
  totalTokens: number
  avgLatencyMs: number
  toolCallCount: number
  interruptCount: number
  elapsedSeconds: number
}

export function LiveMetrics({
  totalTokens,
  avgLatencyMs,
  toolCallCount,
  interruptCount,
  elapsedSeconds,
}: LiveMetricsProps) {
  const elapsed = formatDuration(elapsedSeconds)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0',
      height: '28px',
      background: 'var(--bg-base)',
      borderBottom: '1px solid var(--border-dim)',
      overflowX: 'auto',
    }}>
      {[
        { label: 'ELAPSED',    value: elapsed,                        color: 'var(--text-secondary)' },
        { label: 'TOKENS',     value: formatNum(totalTokens),         color: 'var(--blue-data)' },
        { label: 'AVG LATENCY',value: `${avgLatencyMs}ms`,            color: avgLatencyMs > 2000 ? 'var(--red-hot)' : avgLatencyMs > 1000 ? 'var(--amber)' : 'var(--green-lock)' },
        { label: 'TOOL CALLS', value: String(toolCallCount),          color: 'var(--purple-ai)' },
        { label: 'INTERRUPTS', value: String(interruptCount),         color: interruptCount > 0 ? 'var(--amber)' : 'var(--text-muted)' },
      ].map(({ label, value, color }, i) => (
        <div key={label} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 14px',
          height: '100%',
          borderRight: '1px solid var(--border-dim)',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
            {label}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color, fontWeight: i === 0 ? 400 : 600 }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}