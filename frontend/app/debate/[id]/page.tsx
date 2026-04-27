'use client'
// LOCATION: frontend/app/debate/[id]/page.tsx

import { useEffect, useState } from 'react'
import { useAuth }         from '@/hooks/useAuth'
import { useDebate }       from '@/hooks/useDebate'
import { DebateFeed }      from '@/components/debate/DebateFeed'
import { AgentCard }       from '@/components/agents/AgentCard'
import { ConsensusGauge }  from '@/components/dashboard/ConsensusGauge'
import { InterruptModal }  from '@/components/debate/InterruptModal'
import { api }             from '@/lib/api'
import type { Debate }     from '@/lib/types'

interface PageProps { params: { id: string } }

export default function DebateArenaPage({ params }: PageProps) {
  const { id }           = params   // Next.js 14 — plain object, not Promise
  const { accessToken }  = useAuth()

  const { debate, streaming, connectionState, pauseDebate, resumeDebate, interruptDebate }
    = useDebate(id, accessToken)

  const [initial,       setInitial]       = useState<Debate | null>(null)
  const [interruptOpen, setInterruptOpen] = useState(false)
  const [selectedTurn,  setSelectedTurn]  = useState<string>()

  // Fetch initial state from REST so page shows something before WS fires
  useEffect(() => {
    if (!id) return
    api.debates.get(id, accessToken ?? undefined)
      .then(r => r?.data && setInitial(r.data))
      .catch(() => {})
  }, [id, accessToken])

  // Live debate = WS state; fallback = REST fetch
  const d          = debate ?? initial
  const turns      = Array.isArray(d?.transcript) ? d.transcript : []
  const agents     = d?.agents ?? {}
  const agentList  = Object.values(agents) as any[]
  const maxRounds  = d?.config?.maxRounds ?? d?.config?.max_rounds ?? 5
  const curRound   = d?.current_round ?? 0
  const consensus  = d?.consensusScore ?? 0
  const threshold  = d?.config?.consensusThreshold ?? d?.config?.consensus_threshold ?? 0.85
  const isRunning  = d?.status === 'running'
  const isPaused   = d?.status === 'paused'
  const isDone     = ['consensus_reached','max_rounds_reached'].includes(d?.status ?? '')

  // Loading
  if (!d) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'16px' }}>
      <div style={{ fontSize:'48px', animation:'pulse-dot 1.5s ease-in-out infinite' }}>⚔</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--text-muted)', letterSpacing:'0.2em' }}>LOADING DEBATE...</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:'10px', color: connectionState==='open'?'#00ff88':'var(--text-muted)' }}>
        WS: {connectionState.toUpperCase()}
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'var(--bg-void)' }}>

      {/* ── TOP BAR ───────────────────────────────────────────── */}
      <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:'12px', padding:'0 20px', height:'56px', background:'var(--bg-base)', borderBottom:'1px solid var(--border-subtle)', flexWrap:'wrap' }}>

        <div style={{ flex:1, minWidth:'160px' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'8px', color: d.personal_context_detected?'#9b59ff':'#f5a623', letterSpacing:'0.18em', marginBottom:'2px' }}>
            {d.personal_context_detected ? '👤 PERSONAL' : '🌍 DEBATE'}
          </div>
          <div style={{ fontFamily:'var(--font-ui)', fontSize:'14px', fontWeight:600, color:'var(--text-primary)', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {d.config?.topic}
          </div>
        </div>

        {/* Status */}
        <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 12px', background:'var(--bg-elevated)', border:`1px solid ${isRunning?'#00ff8833':isPaused?'#f5a62333':'#1e90ff33'}`, borderRadius:'4px' }}>
          <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:isRunning?'#00ff88':isPaused?'#f5a623':'#1e90ff', boxShadow:isRunning?'0 0 8px #00ff88':'none', animation:isRunning?'pulse-dot 1.5s infinite':'none' }} />
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'10px', color:'var(--text-secondary)', letterSpacing:'0.1em', textTransform:'uppercase' as const }}>
            {d.status?.replace(/_/g,' ')}
          </span>
        </div>

        {/* Round counter — LIVE */}
        <div style={{ padding:'5px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'4px', textAlign:'center' as const }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'8px', color:'var(--text-muted)', letterSpacing:'0.1em', marginBottom:'1px' }}>ROUND</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'16px', fontWeight:800, color: curRound > 0 ? '#f5a623' : 'var(--text-muted)', lineHeight:1 }}>
            {curRound}<span style={{ fontSize:'10px', color:'var(--text-muted)' }}>/{maxRounds}</span>
          </div>
        </div>

        {/* WS status */}
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:connectionState==='open'?'#00ff88':'#ff3c3c', boxShadow:connectionState==='open'?'0 0 6px #00ff88':'none' }} />
          <span style={{ fontFamily:'var(--font-mono)', fontSize:'8px', color:'var(--text-muted)' }}>
            {connectionState==='open'?'LIVE':'OFFLINE'}
          </span>
        </div>

        {/* Controls */}
        <div style={{ display:'flex', gap:'8px' }}>
          {isRunning && <Btn label="⏸ Pause"     col="#7a95b8" onClick={pauseDebate} />}
          {isPaused  && <Btn label="▶ Resume"    col="#00ff88" onClick={resumeDebate} />}
          {(isRunning||isPaused) && d.config?.enableHumanInterrupt && (
            <Btn label="⚡ Interrupt" col="#f5a623" onClick={() => setInterruptOpen(true)} />
          )}
        </div>
      </div>

      {/* ── MAIN 3-COL ────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'240px 1fr 220px', flex:1, overflow:'hidden' }}>

        {/* LEFT — Agent cards */}
        <div style={{ borderRight:'1px solid var(--border-subtle)', overflowY:'auto', display:'flex', flexDirection:'column', gap:'0' }}>
          <div style={{ padding:'10px 12px 6px', borderBottom:'1px solid var(--border-dim)' }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'9px', color:'var(--text-muted)', letterSpacing:'0.18em' }}>AGENTS</span>
          </div>
          <div style={{ padding:'10px', display:'flex', flexDirection:'column', gap:'8px' }}>
            {agentList.length === 0 && (
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'9px', color:'var(--text-muted)', padding:'8px' }}>Initializing...</div>
            )}
            {agentList.map((agent: any) => (
              <AgentCard
                key={agent.config?.id ?? agent.config?.role}
                agent={agent}
                isActive={streaming.agentRole === agent.config?.role && (streaming.isThinking || streaming.isSpeaking)}
                currentThought={streaming.agentRole === agent.config?.role ? streaming.thought : undefined}
              />
            ))}
          </div>
        </div>

        {/* CENTER — Transcript feed (all messages, scrollable) */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flexShrink:0, padding:'8px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'9px', color:'var(--text-muted)', letterSpacing:'0.15em' }}>TRANSCRIPT</span>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:'9px', color:'var(--text-muted)' }}>{turns.length} messages</span>
              {streaming.isSpeaking && (
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                  <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#00ff88', animation:'pulse-dot 1s infinite' }} />
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'9px', color:'#00ff88' }}>LIVE</span>
                </div>
              )}
            </div>
          </div>
          {/* This div is the scrollable container */}
          <div style={{ flex:1, overflow:'hidden' }}>
            <DebateFeed
              turns={turns}
              streaming={streaming}
              selectedTurnId={selectedTurn}
              onSelectTurn={setSelectedTurn}
            />
          </div>
        </div>

        {/* RIGHT — Live metrics */}
        <div style={{ borderLeft:'1px solid var(--border-subtle)', overflowY:'auto', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'10px 12px 6px', borderBottom:'1px solid var(--border-dim)', flexShrink:0 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'9px', color:'var(--text-muted)', letterSpacing:'0.18em' }}>LIVE METRICS</span>
          </div>
          <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:'16px', alignItems:'center' }}>

            {/* Consensus gauge */}
            <ConsensusGauge
              score={consensus}
              threshold={threshold}
              round={curRound}
              maxRounds={maxRounds}
              compact
            />

            {/* Round progress bar */}
            <div style={{ width:'100%' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'8px', color:'var(--text-muted)', letterSpacing:'0.1em' }}>ROUND PROGRESS</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'9px', color:'#f5a623', fontWeight:700 }}>{curRound}/{maxRounds}</span>
              </div>
              <div style={{ height:'6px', background:'var(--bg-elevated)', borderRadius:'3px', overflow:'hidden', border:'1px solid var(--border-dim)' }}>
                <div style={{
                  height:'100%',
                  width:`${maxRounds > 0 ? (curRound/maxRounds)*100 : 0}%`,
                  background:'linear-gradient(90deg, #f5a623, #00e5ff)',
                  borderRadius:'3px',
                  transition:'width 0.6s ease',
                  boxShadow:'0 0 8px #f5a62366',
                }} />
              </div>
            </div>

            {/* Live score leaderboard — updates after every turn */}
            <div style={{ width:'100%' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'8px', color:'var(--text-muted)', letterSpacing:'0.1em', marginBottom:'8px' }}>SCORES (LIVE)</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                {agentList
                  .sort((a:any,b:any) => (b.score?.totalScore??0) - (a.score?.totalScore??0))
                  .map((agent:any, idx:number) => {
                    const role  = agent.config?.role ?? ''
                    const col   = ({proponent:'#00ff88',opponent:'#ff3c3c',fact_checker:'#f5a623',moderator:'#1e90ff'} as any)[role] ?? '#7a95b8'
                    const icon  = ({proponent:'▲',opponent:'▼',fact_checker:'◆',moderator:'◉'} as any)[role] ?? '●'
                    const score = Math.round(agent.score?.totalScore ?? 0)
                    const turns_done = agent.turnCount ?? 0
                    return (
                      <div key={role} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 8px', background:'var(--bg-elevated)', borderRadius:'4px', border:`1px solid ${col}22` }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:'8px', color:'var(--text-muted)', width:'12px' }}>#{idx+1}</span>
                        <span style={{ color:col, fontSize:'10px', width:'12px', textAlign:'center' as const }}>{icon}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:'var(--font-mono)', fontSize:'9px', color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                            {agent.config?.name ?? role}
                          </div>
                          {turns_done > 0 && (
                            <div style={{ fontFamily:'var(--font-mono)', fontSize:'7px', color:'var(--text-muted)' }}>{turns_done} turn{turns_done!==1?'s':''}</div>
                          )}
                        </div>
                        <div style={{ textAlign:'right' as const }}>
                          <div style={{ fontFamily:'var(--font-display)', fontSize:'16px', fontWeight:800, color:score>0?col:'var(--text-muted)', lineHeight:1 }}>
                            {score > 0 ? score : '—'}
                          </div>
                          {/* Logic / Evidence mini bars */}
                          {agent.score?.logicScore > 0 && (
                            <div style={{ display:'flex', gap:'3px', marginTop:'3px' }}>
                              <MiniBar val={agent.score.logicScore}    col={col} label="L" />
                              <MiniBar val={agent.score.evidenceScore}  col={col} label="E" />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Fallacy counter */}
            {agentList.some((a:any) => (a.score?.fallaciesDetected?.length ?? 0) > 0) && (
              <div style={{ width:'100%', padding:'8px 10px', background:'rgba(255,60,60,0.06)', border:'1px solid rgba(255,60,60,0.2)', borderRadius:'4px' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'8px', color:'#ff3c3c', letterSpacing:'0.1em', marginBottom:'5px' }}>⚠ FALLACIES</div>
                {agentList.filter((a:any) => (a.score?.fallaciesDetected?.length??0)>0).map((a:any) => (
                  <div key={a.config?.role} style={{ fontFamily:'var(--font-mono)', fontSize:'8px', color:'var(--text-muted)', display:'flex', justifyContent:'space-between' }}>
                    <span>{a.config?.name}</span>
                    <span style={{ color:'#ff3c3c' }}>{a.score.fallaciesDetected.length}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Done state */}
            {isDone && (
              <div style={{ width:'100%', padding:'12px', background:'rgba(0,255,136,0.06)', border:'1px solid rgba(0,255,136,0.3)', borderRadius:'4px', textAlign:'center' as const }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'9px', color:'#00ff88', letterSpacing:'0.12em', marginBottom:'4px' }}>✓ DEBATE COMPLETE</div>
                {d.winner_role && (
                  <div style={{ fontFamily:'var(--font-display)', fontSize:'14px', fontWeight:800, color:'#00ff88' }}>
                    {d.winner_role.toUpperCase().replace('_',' ')} WINS
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <InterruptModal
        isOpen={interruptOpen}
        onClose={() => setInterruptOpen(false)}
        onSubmit={async (msg, type) => { await interruptDebate(msg, type); setInterruptOpen(false) }}
      />
    </div>
  )
}

function Btn({ label, col, onClick }: { label:string; col:string; onClick:()=>void }) {
  return (
    <button
      onClick={onClick}
      style={{ padding:'6px 14px', background:'transparent', border:`1px solid ${col}55`, borderRadius:'4px', color:col, fontFamily:'var(--font-display)', fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase' as const, cursor:'pointer', transition:'all 0.2s', whiteSpace:'nowrap' as const }}
      onMouseEnter={e => { e.currentTarget.style.background=`${col}15`; e.currentTarget.style.borderColor=col }}
      onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor=`${col}55` }}
    >
      {label}
    </button>
  )
}

function MiniBar({ val, col, label }: { val:number; col:string; label:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'2px' }}>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:'6px', color:'var(--text-muted)' }}>{label}</span>
      <div style={{ width:'24px', height:'3px', background:'var(--bg-base)', borderRadius:'2px', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${val}%`, background:col, borderRadius:'2px', transition:'width 0.4s ease' }} />
      </div>
    </div>
  )
}