// LOCATION: frontend/components/dashboard/ScoringPanel.tsx
// Live scoring dashboard — logic scores, sentiment, fallacy heatmap per agent per round

'use client'
import { useMemo } from 'react'
import type { DebateTurn, AgentRole } from '@/lib/types'

const ROLE_META: Record<AgentRole, { color: string; label: string; short: string }> = {
  proponent:    { color: '#00ff88', label: 'Proponent',    short: 'PRO' },
  opponent:     { color: '#ff3c3c', label: 'Opponent',     short: 'OPP' },
  fact_checker: { color: '#f5a623', label: 'Fact-Checker', short: 'FCK' },
  moderator:    { color: '#1e90ff', label: 'Moderator',    short: 'MOD' },
}

interface ScoringPanelProps {
  turns: DebateTurn[]
  currentRound: number
}

export function ScoringPanel({ turns, currentRound }: ScoringPanelProps) {
  // Aggregate scores per agent
  const agentStats = useMemo(() => {
    const stats: Record<string, { logic: number[]; evidence: number[]; sentiment: number[]; fallacies: number; turns: number }> = {}

    for (const turn of turns) {
      const r = turn.agentRole
      if (!stats[r]) stats[r] = { logic: [], evidence: [], sentiment: [], fallacies: 0, turns: 0 }
      stats[r].logic.push(turn.score.logicScore)
      stats[r].evidence.push(turn.score.evidenceScore)
      stats[r].sentiment.push(turn.score.sentimentScore)
      stats[r].fallacies += turn.score.fallaciesDetected.length
      stats[r].turns++
    }

    return Object.entries(stats).map(([role, s]) => ({
      role: role as AgentRole,
      avgLogic: avg(s.logic),
      avgEvidence: avg(s.evidence),
      avgSentiment: avg(s.sentiment),
      totalFallacies: s.fallacies,
      turns: s.turns,
      trend: s.logic.length >= 2
        ? s.logic[s.logic.length - 1] - s.logic[0]
        : 0,
    })).sort((a, b) => (b.avgLogic + b.avgEvidence) - (a.avgLogic + a.avgEvidence))
  }, [turns])

  // Per-round scores for sparklines
  const roundData = useMemo(() => {
    const rounds: Record<number, Record<AgentRole, number>> = {}
    for (const turn of turns) {
      if (!rounds[turn.round]) rounds[turn.round] = {} as Record<AgentRole, number>
      rounds[turn.round][turn.agentRole] = turn.score.logicScore
    }
    return Object.entries(rounds).map(([r, scores]) => ({ round: Number(r), ...scores }))
  }, [turns])

  if (turns.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.15em' }}>
        NO SCORING DATA YET
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>
        LIVE SCORING — ROUND {currentRound}
      </div>

      {/* Agent score cards */}
      {agentStats.map((agent, rank) => {
        const meta = ROLE_META[agent.role]
        return (
          <div key={agent.role} style={{
            padding: '12px',
            background: 'var(--bg-elevated)',
            border: `1px solid ${meta.color}22`,
            borderRadius: '2px',
            position: 'relative',
          }}>
            {/* Rank badge */}
            <div style={{
              position: 'absolute', top: '-8px', left: '10px',
              padding: '1px 6px',
              background: rank === 0 ? meta.color : 'var(--bg-base)',
              border: `1px solid ${meta.color}44`,
              borderRadius: '2px',
              fontFamily: 'var(--font-mono)', fontSize: '8px',
              color: rank === 0 ? 'var(--bg-void)' : meta.color,
              fontWeight: rank === 0 ? 700 : 400,
            }}>
              #{rank + 1}
            </div>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: meta.color, fontWeight: 700 }}>
                  {meta.short}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>
                  {agent.turns} turns
                </span>
              </div>
              <TrendIndicator value={agent.trend} />
            </div>

            {/* Score bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <MiniBar label="Logic" value={agent.avgLogic} color={meta.color} />
              <MiniBar label="Evidence" value={agent.avgEvidence} color={meta.color} />
            </div>

            {/* Sentiment + fallacies */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <div style={{
                flex: 1, padding: '4px 8px',
                background: sentimentBg(agent.avgSentiment),
                border: `1px solid ${sentimentBorder(agent.avgSentiment)}`,
                borderRadius: '2px',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginBottom: '2px' }}>SENTIMENT</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: sentimentColor(agent.avgSentiment), fontWeight: 700 }}>
                  {agent.avgSentiment > 0 ? '+' : ''}{agent.avgSentiment.toFixed(2)}
                </div>
              </div>
              {agent.totalFallacies > 0 && (
                <div style={{
                  flex: 1, padding: '4px 8px',
                  background: 'var(--red-glow)',
                  border: '1px solid var(--border-red)',
                  borderRadius: '2px',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginBottom: '2px' }}>FALLACIES</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--red-hot)', fontWeight: 700 }}>
                    {agent.totalFallacies} ⚠
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Round sparkline */}
      {roundData.length >= 2 && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: '8px' }}>
            LOGIC SCORE BY ROUND
          </div>
          <Sparkline data={roundData} />
        </div>
      )}
    </div>
  )
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{label.toUpperCase()}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color }}>{Math.round(value)}</span>
      </div>
      <div style={{ height: '3px', background: 'var(--bg-base)', borderRadius: '1px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: '1px', transition: 'width 0.5s ease', boxShadow: `0 0 4px ${color}88` }} />
      </div>
    </div>
  )
}

function TrendIndicator({ value }: { value: number }) {
  if (Math.abs(value) < 2) return <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>→</span>
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: value > 0 ? 'var(--green-lock)' : 'var(--red-hot)' }}>
      {value > 0 ? '↑' : '↓'} {Math.abs(Math.round(value))}
    </span>
  )
}

function Sparkline({ data }: { data: Array<Record<string, unknown>> }) {
  const roles: AgentRole[] = ['proponent', 'opponent', 'fact_checker']
  const colors = { proponent: '#00ff88', opponent: '#ff3c3c', fact_checker: '#f5a623',moderator: '#9C27B0', }
  const W = 180, H = 48, pad = 4
  const rounds = data.map(d => d.round as number)
  const minR = Math.min(...rounds), maxR = Math.max(...rounds)

  const toX = (r: number) => maxR === minR ? W / 2 : pad + ((r - minR) / (maxR - minR)) * (W - pad * 2)
  const toY = (v: number) => H - pad - (v / 100) * (H - pad * 2)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {roles.map(role => {
        const points = data
          .filter(d => d[role] !== undefined)
          .map(d => `${toX(d.round as number)},${toY(d[role] as number)}`)
          .join(' ')
        if (!points) return null
        return (
          <polyline
            key={role}
            points={points}
            fill="none"
            stroke={colors[role]}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />
        )
      })}
      {/* Round labels */}
      {data.map(d => (
        <text key={d.round as number} x={toX(d.round as number)} y={H} textAnchor="middle" style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', fill: 'var(--text-muted)' }}>
          R{d.round as number}
        </text>
      ))}
    </svg>
  )
}

const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

const sentimentColor = (s: number) => s > 0.2 ? 'var(--green-lock)' : s < -0.2 ? 'var(--red-hot)' : 'var(--amber)'
const sentimentBg = (s: number) => s > 0.2 ? 'var(--green-glow)' : s < -0.2 ? 'var(--red-glow)' : 'var(--amber-glow)'
const sentimentBorder = (s: number) => s > 0.2 ? 'var(--border-green)' : s < -0.2 ? 'var(--border-red)' : 'var(--border-amber)'