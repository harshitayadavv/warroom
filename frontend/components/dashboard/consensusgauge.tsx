'use client'
import { useEffect, useState } from 'react'

interface ConsensusGaugeProps {
  score: number      // 0–1
  threshold: number  // e.g. 0.85
  round: number
  maxRounds: number
  compact?: boolean
}

export function ConsensusGauge({ score, threshold, round, maxRounds, compact = false }: ConsensusGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0)
  const pct = Math.round(score * 100)
  const thresholdPct = Math.round(threshold * 100)

  // Animate score counter
  useEffect(() => {
    const target = pct
    const diff = target - displayScore
    if (Math.abs(diff) < 1) { setDisplayScore(target); return }
    const step = diff / 20
    const t = setInterval(() => {
      setDisplayScore(prev => {
        const next = prev + step
        if (Math.abs(next - target) < 1) { clearInterval(t); return target }
        return next
      })
    }, 16)
    return () => clearInterval(t)
  }, [pct])

  const isConverging = pct >= thresholdPct
  const color = isConverging ? 'var(--green-lock)' : pct > 60 ? 'var(--amber)' : 'var(--blue-data)'
  const glowColor = isConverging ? 'rgba(0,255,136,0.3)' : pct > 60 ? 'rgba(245,166,35,0.3)' : 'rgba(30,144,255,0.3)'

  // SVG ring
  const size = compact ? 80 : 120
  const stroke = compact ? 6 : 8
  const r = (size / 2) - (stroke / 2) - 2
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference - (circumference * pct / 100)
  const thresholdAngle = (thresholdPct / 100) * 360 - 90

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? '8px' : '16px' }}>
      {/* Ring gauge */}
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="var(--bg-elevated)"
            strokeWidth={stroke}
          />
          {/* Progress */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
            style={{
              transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1), stroke 0.4s ease',
              filter: `drop-shadow(0 0 4px ${color})`,
            }}
          />
          {/* Threshold marker */}
          <line
            x1={size / 2}
            y1={stroke / 2 + 2}
            x2={size / 2}
            y2={stroke + stroke / 2 + 2}
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ transform: `rotate(${thresholdAngle}deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}
          />
        </svg>

        {/* Center content */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
        }}>
          {isConverging && (
            <div style={{ fontSize: compact ? '8px' : '10px', fontFamily: 'var(--font-mono)', color: 'var(--green-lock)', letterSpacing: '0.1em', marginBottom: '2px' }}>
              ✓ CONV
            </div>
          )}
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: compact ? '22px' : '32px',
            fontWeight: 800,
            color,
            lineHeight: 1,
            textShadow: `0 0 12px ${glowColor}`,
          }}>
            {Math.round(displayScore)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: compact ? '8px' : '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            %
          </div>
        </div>
      </div>

      {/* Labels */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: compact ? '9px' : '10px', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: '4px' }}>
          CONSENSUS SCORE
        </div>
        {!compact && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
            Target: <span style={{ color: 'white' }}>{thresholdPct}%</span>
          </div>
        )}
      </div>

      {/* Round progress */}
      {!compact && (
        <div style={{ width: '100%', maxWidth: size + 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>ROUND</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-primary)' }}>{round}/{maxRounds}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(round / maxRounds) * 100}%`, background: 'linear-gradient(90deg, var(--blue-dim), var(--blue-data))' }} />
          </div>
        </div>
      )}

      {/* Convergence label */}
      {isConverging && !compact && (
        <div style={{
          padding: '6px 16px',
          background: 'var(--green-glow)',
          border: '1px solid var(--border-green)',
          borderRadius: '2px',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--green-lock)',
          letterSpacing: '0.15em',
          animation: 'pulse-dot 2s ease-in-out infinite',
          textAlign: 'center',
        }}>
          CONVERGENCE DETECTED
        </div>
      )}
    </div>
  )
}