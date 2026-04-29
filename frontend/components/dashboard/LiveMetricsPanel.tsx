'use client'
// LOCATION: frontend/components/dashboard/LiveMetricsPanel.tsx
// Drop-in replacement for the right panel content in DebateArenaPage

import { useEffect, useRef, useState } from 'react'
import type { AgentState, AgentRole } from '@/lib/types'

const ROLE_CFG: Record<string, { color: string; icon: string; label: string; short: string }> = {
  proponent:    { color: '#00ff88', icon: '▲', label: 'Proponent',    short: 'PRO' },
  opponent:     { color: '#ff3c3c', icon: '▼', label: 'Opponent',     short: 'OPP' },
  fact_checker: { color: '#f5a623', icon: '◆', label: 'Fact-Checker', short: 'FCK' },
  moderator:    { color: '#1e90ff', icon: '◉', label: 'Moderator',    short: 'MOD' },
}

interface Props {
  agents:       Record<string, AgentState>
  curRound:     number
  maxRounds:    number
  consensus:    number
  threshold:    number
  isDone:       boolean
  winnerRole?:  string
}

export function LiveMetricsPanel({
  agents, curRound, maxRounds, consensus, threshold, isDone, winnerRole
}: Props) {
  const agentList = Object.values(agents) as any[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', height: '100%', overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-dim)', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.18em' }}>LIVE METRICS</span>
      </div>

      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* ── Consensus Meter ── */}
        <ConsensusArc score={consensus} threshold={threshold} />

        {/* ── Round Progress ── */}
        <RoundTracker curRound={curRound} maxRounds={maxRounds} />

        {/* ── Head-to-Head Battle Bar (Pro vs Opp) ── */}
        <BattleBar agents={agents} />

        {/* ── Per-Agent Score Cards ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
            AGENT SCORECARDS
          </div>
          {agentList
            .sort((a: any, b: any) => (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0))
            .map((agent: any) => (
              <AgentScoreCard key={agent.config?.role} agent={agent} />
            ))}
        </div>

        {/* ── Fallacy Alert ── */}
        {agentList.some((a: any) => (a.score?.fallaciesDetected?.length ?? 0) > 0) && (
          <FallacyAlert agents={agentList} />
        )}

        {/* ── Complete Banner ── */}
        {isDone && <CompleteBanner winnerRole={winnerRole} />}
      </div>
    </div>
  )
}

// ── Consensus Arc ────────────────────────────────────────────────────────────

function ConsensusArc({ score, threshold }: { score: number; threshold: number }) {
  const pct     = Math.min(score, 1)
  const radius  = 44
  const circ    = 2 * Math.PI * radius
  // Arc goes 270 degrees (from 135° to 405°), so stroke covers 75% of circumference
  const arcLen  = circ * 0.75
  const filled  = arcLen * pct
  const gap     = arcLen - filled
  // threshold marker angle
  const threshAngle = 135 + threshold * 270 // degrees

  const scoreColor = pct >= threshold ? '#00ff88' : pct > 0.5 ? '#f5a623' : '#1e90ff'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
        CONSENSUS SCORE
      </div>
      <div style={{ position: 'relative', width: '110px', height: '80px' }}>
        <svg viewBox="0 0 110 90" style={{ width: '110px', height: '80px', overflow: 'visible' }}>
          {/* Background arc */}
          <circle
            cx="55" cy="58" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="8"
            strokeDasharray={`${arcLen} ${circ - arcLen}`}
            strokeDashoffset={circ * 0.375}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <circle
            cx="55" cy="58" r={radius}
            fill="none"
            stroke={scoreColor}
            strokeWidth="8"
            strokeDasharray={`${filled} ${gap + (circ - arcLen)}`}
            strokeDashoffset={circ * 0.375}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${scoreColor}88)`, transition: 'stroke-dasharray 0.8s ease, stroke 0.5s ease' }}
          />
          {/* Threshold tick */}
          <line
            x1="55" y1="58"
            x2={55 + (radius + 6) * Math.cos((threshAngle - 90) * Math.PI / 180)}
            y2={58 + (radius + 6) * Math.sin((threshAngle - 90) * Math.PI / 180)}
            stroke="#ffffff33"
            strokeWidth="1"
          />
        </svg>

        {/* Center value */}
        <div style={{
          position: 'absolute', top: '28px', left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'Orbitron, monospace', fontSize: '20px', fontWeight: 900,
            color: scoreColor,
            textShadow: `0 0 12px ${scoreColor}66`,
            lineHeight: 1,
            transition: 'color 0.5s ease',
          }}>
            {Math.round(pct * 100)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--text-muted)', marginTop: '2px' }}>
            / {Math.round(threshold * 100)}
          </div>
        </div>
      </div>

      {/* Status label */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '8px',
        color: pct >= threshold ? '#00ff88' : 'var(--text-muted)',
        letterSpacing: '0.1em',
        transition: 'color 0.5s ease',
      }}>
        {pct >= threshold ? '✓ CONSENSUS' : `${Math.round((threshold - pct) * 100)}% TO CONSENSUS`}
      </div>
    </div>
  )
}

// ── Round Tracker ────────────────────────────────────────────────────────────

function RoundTracker({ curRound, maxRounds }: { curRound: number; maxRounds: number }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
          ROUND PROGRESS
        </span>
        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '12px', fontWeight: 800, color: '#f5a623' }}>
          {curRound}<span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>/{maxRounds}</span>
        </span>
      </div>
      {/* Segmented round dots */}
      <div style={{ display: 'flex', gap: '3px' }}>
        {Array.from({ length: maxRounds }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1, height: '6px', borderRadius: '3px',
              background: i < curRound
                ? 'linear-gradient(90deg, #f5a623, #00e5ff)'
                : i === curRound
                  ? 'rgba(245,166,35,0.3)'
                  : 'rgba(255,255,255,0.06)',
              boxShadow: i < curRound ? '0 0 4px #f5a62366' : 'none',
              transition: 'background 0.4s ease, box-shadow 0.4s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Battle Bar ───────────────────────────────────────────────────────────────

function BattleBar({ agents }: { agents: Record<string, AgentState> }) {
  const pro = (agents as any)['proponent']
  const opp = (agents as any)['opponent']
  if (!pro || !opp) return null

  const proScore = pro.score?.totalScore ?? 0
  const oppScore = opp.score?.totalScore ?? 0
  const total    = proScore + oppScore || 1
  const proPct   = Math.round((proScore / total) * 100)
  const oppPct   = 100 - proPct

  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '6px' }}>
        HEAD-TO-HEAD
      </div>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#00ff88', fontWeight: 700 }}>
          PRO {proPct}%
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#ff3c3c', fontWeight: 700 }}>
          {oppPct}% OPP
        </span>
      </div>
      {/* Bar */}
      <div style={{ height: '10px', borderRadius: '5px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex' }}>
        <div style={{
          width: `${proPct}%`, background: 'linear-gradient(90deg, #00ff88, #00cc66)',
          boxShadow: '2px 0 8px #00ff8866',
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          borderRadius: '5px 0 0 5px',
        }} />
        <div style={{
          width: `${oppPct}%`, background: 'linear-gradient(90deg, #cc2222, #ff3c3c)',
          boxShadow: '-2px 0 8px #ff3c3c66',
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          borderRadius: '0 5px 5px 0',
        }} />
      </div>
      {/* Score numbers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '11px', fontWeight: 800, color: '#00ff88' }}>
          {Math.round(proScore)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--text-muted)', alignSelf: 'center' }}>VS</span>
        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '11px', fontWeight: 800, color: '#ff3c3c' }}>
          {Math.round(oppScore)}
        </span>
      </div>
    </div>
  )
}

// ── Agent Score Card ──────────────────────────────────────────────────────────

function AgentScoreCard({ agent }: { agent: any }) {
  const role   = agent.config?.role ?? ''
  const cfg    = ROLE_CFG[role] ?? { color: '#7a95b8', icon: '●', label: role, short: '???' }
  const score  = agent.score?.totalScore    ?? 0
  const logic  = agent.score?.logicScore    ?? 0
  const evid   = agent.score?.evidenceScore ?? 0
  const turns  = agent.turnCount            ?? 0
  const hasData = score > 0 || logic > 0 || evid > 0

  return (
    <div style={{
      padding: '8px',
      background: 'var(--bg-elevated)',
      border: `1px solid ${cfg.color}22`,
      borderLeft: `3px solid ${cfg.color}`,
      borderRadius: '4px',
      transition: 'border-color 0.3s ease',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: hasData ? '6px' : '0' }}>
        <span style={{ color: cfg.color, fontSize: '10px' }}>{cfg.icon}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-secondary)', flex: 1 }}>
          {agent.config?.name ?? cfg.label}
        </span>
        {turns > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--text-muted)' }}>
            ×{turns}
          </span>
        )}
        <span style={{
          fontFamily: 'Orbitron, monospace', fontSize: '16px', fontWeight: 900,
          color: hasData ? cfg.color : 'var(--text-muted)',
          textShadow: hasData ? `0 0 8px ${cfg.color}55` : 'none',
          transition: 'color 0.5s ease, text-shadow 0.5s ease',
          minWidth: '28px', textAlign: 'right' as const,
        }}>
          {hasData ? Math.round(score) : '—'}
        </span>
      </div>

      {/* Stat bars */}
      {hasData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <StatBar label="LOGIC" val={logic} col={cfg.color} />
          <StatBar label="EVID"  val={evid}  col={cfg.color} />
        </div>
      )}

      {/* Fallacy badges */}
      {(agent.score?.fallaciesDetected?.length ?? 0) > 0 && (
        <div style={{ marginTop: '4px', display: 'flex', gap: '3px', flexWrap: 'wrap' as const }}>
          {agent.score.fallaciesDetected.slice(0, 3).map((f: any, i: number) => (
            <span key={i} style={{
              fontFamily: 'var(--font-mono)', fontSize: '6px',
              color: '#ff3c3c', background: 'rgba(255,60,60,0.1)',
              border: '1px solid rgba(255,60,60,0.25)',
              borderRadius: '2px', padding: '1px 3px',
            }}>
              {(f.type ?? '').replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function StatBar({ label, val, col }: { label: string; val: number; col: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '6px', color: 'var(--text-muted)', width: '28px', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.min(val, 100)}%`,
          background: `linear-gradient(90deg, ${col}88, ${col})`,
          borderRadius: '2px',
          boxShadow: `0 0 4px ${col}44`,
          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '8px', color: col, width: '22px', textAlign: 'right' as const, fontWeight: 700 }}>
        {Math.round(val)}
      </span>
    </div>
  )
}

// ── Fallacy Alert ─────────────────────────────────────────────────────────────

function FallacyAlert({ agents }: { agents: any[] }) {
  const withFallacies = agents.filter(a => (a.score?.fallaciesDetected?.length ?? 0) > 0)
  const total = withFallacies.reduce((s, a) => s + (a.score?.fallaciesDetected?.length ?? 0), 0)
  return (
    <div style={{
      padding: '8px',
      background: 'rgba(255,60,60,0.05)',
      border: '1px solid rgba(255,60,60,0.2)',
      borderRadius: '4px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
        <span style={{ color: '#ff3c3c', fontSize: '10px' }}>⚠</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: '#ff3c3c', letterSpacing: '0.1em' }}>
          {total} FALLAC{total === 1 ? 'Y' : 'IES'} DETECTED
        </span>
      </div>
      {withFallacies.map(a => (
        <div key={a.config?.role} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--text-muted)' }}>
            {a.config?.name}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: '#ff3c3c' }}>
            ×{a.score.fallaciesDetected.length}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Complete Banner ───────────────────────────────────────────────────────────

function CompleteBanner({ winnerRole }: { winnerRole?: string }) {
  const cfg = winnerRole ? (ROLE_CFG[winnerRole] ?? null) : null
  return (
    <div style={{
      padding: '12px',
      background: `linear-gradient(135deg, rgba(0,255,136,0.08), rgba(0,255,136,0.03))`,
      border: '1px solid rgba(0,255,136,0.3)',
      borderRadius: '4px',
      textAlign: 'center' as const,
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#00ff88', letterSpacing: '0.15em', marginBottom: '6px' }}>
        ✓ DEBATE COMPLETE
      </div>
      {cfg && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            WINNER
          </div>
          <div style={{
            fontFamily: 'Orbitron, monospace', fontSize: '14px', fontWeight: 900,
            color: cfg.color, textShadow: `0 0 12px ${cfg.color}66`,
          }}>
            {cfg.icon} {cfg.label.toUpperCase()}
          </div>
        </>
      )}
      {!cfg && (
        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '12px', color: 'var(--text-muted)' }}>DRAW</div>
      )}
    </div>
  )
}