'use client'
// LOCATION: frontend/app/debate/new/page.tsx

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import type { DebateConfig, AgentConfig, AgentRole } from '@/lib/types'

// ✅ ALL GROQ MODELS — no Claude models here
const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'proponent-1',
    role: 'proponent' as AgentRole,
    name: 'AXIOM',
    model: 'openai/gpt-oss-20b',   // ← GROQ model
    temperature: 0.7,
    expertiseLevel: 4,
    temperament: 'analytical',
  },
  {
    id: 'opponent-1',
    role: 'opponent' as AgentRole,
    name: 'REFUTE',
    model: 'openai/gpt-oss-20b',   // ← GROQ model
    temperature: 0.8,
    expertiseLevel: 4,
    temperament: 'aggressive',
  },
  {
    id: 'fact_checker-1',
    role: 'fact_checker' as AgentRole,
    name: 'VERITAS',
    model: 'openai/gpt-oss-20b',      // ← Fast GROQ model for fact checking
    temperature: 0.2,
    expertiseLevel: 5,
    temperament: 'balanced',
  },
  {
    id: 'moderator-1',
    role: 'moderator' as AgentRole,
    name: 'ARBITER',
    model: 'openai/gpt-oss-20b',   // ← GROQ model
    temperature: 0.3,
    expertiseLevel: 5,
    temperament: 'diplomatic',
  },
]

const GROQ_MODELS = [
  { value: 'openai/gpt-oss-20b', label: 'Llama 3.3 70B',     speed: 'fast',  quality: 'best' },
  { value: 'openai/gpt-oss-20b',   label: 'Llama 3.1 SpecDec', speed: 'fast',  quality: 'high' },
  { value: 'openai/gpt-oss-20b',      label: 'Mixtral 8x7B',      speed: 'med',   quality: 'high' },
  { value: 'openai/gpt-oss-20b',    label: 'Llama 3.1 8B',      speed: 'ultra', quality: 'med'  },
  { value: 'openai/gpt-oss-20b',            label: 'Gemma 2 9B',        speed: 'fast',  quality: 'med'  },
]

const EXAMPLE_TOPICS = [
  { icon: '🐕', text: 'Should I buy a dog?',                          tag: 'Life' },
  { icon: '💼', text: 'Should I quit my job and start freelancing?',  tag: 'Career' },
  { icon: '🏠', text: 'Should I rent or buy a house right now?',      tag: 'Finance' },
  { icon: '🤖', text: 'AI development should be paused immediately',  tag: 'Tech' },
  { icon: '⚡', text: 'Nuclear energy is essential for net-zero',     tag: 'Climate' },
  { icon: '📱', text: 'Social media does more harm than good',        tag: 'Society' },
]

const ROLE_META: Record<string, { color: string; label: string; icon: string; desc: string }> = {
  proponent:    { color: '#00ff88', icon: '▲', label: 'Proponent',    desc: 'Argues FOR the topic' },
  opponent:     { color: '#ff3c3c', icon: '▼', label: 'Opponent',     desc: 'Argues AGAINST' },
  fact_checker: { color: '#f5a623', icon: '◆', label: 'Fact-Checker', desc: 'Audits all claims' },
  moderator:    { color: '#1e90ff', icon: '◉', label: 'Judge',        desc: 'Scores & delivers verdict' },
}

export default function NewDebatePage() {
  const router              = useRouter()
  const { accessToken }     = useAuth()
  const [isPending, startTransition] = useTransition()

  const [step, setStep]             = useState<1 | 2>(1)
  const [topic, setTopic]           = useState('')
  const [context, setContext]       = useState('')
  const [maxRounds, setMaxRounds]   = useState(5)
  const [threshold, setThreshold]   = useState(0.85)
  const [mode, setMode]             = useState<'adversarial' | 'collaborative' | 'socratic'>('adversarial')
  const [webSearch, setWebSearch]   = useState(true)
  const [pythonRepl, setPythonRepl] = useState(false)
  const [humanInterrupt, setHumanInterrupt] = useState(true)
  const [agents, setAgents]         = useState<AgentConfig[]>(DEFAULT_AGENTS)
  const [activeAgent, setActiveAgent] = useState('proponent')
  const [error, setError]           = useState('')

  const updateAgent = (role: string, patch: Partial<AgentConfig>) =>
    setAgents(prev => prev.map(a => a.role === role ? { ...a, ...patch } : a))

  const handleSubmit = async () => {
    if (!topic.trim()) return
    const config: DebateConfig = {
      topic: topic.trim(),
      maxRounds,
      agents,
      enableWebSearch: webSearch,
      enablePythonRepl: pythonRepl,
      enableHumanInterrupt: humanInterrupt,
      consensusThreshold: threshold,
      debateMode: mode,
      context: context.trim() || undefined,
    }
    startTransition(async () => {
      try {
        const res = await api.debates.create(config, accessToken ?? undefined)
        router.push(`/debate/${res.data.id}`)
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  return (
    <div style={{ minHeight: '100vh', maxWidth: '820px', margin: '0 auto', padding: '72px 24px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--amber)', letterSpacing: '0.25em', marginBottom: '8px' }}>
          // NEW DEBATE
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, color: 'var(--text-primary)' }}>
          What do you want to debate?
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontFamily: 'var(--font-ui)', fontSize: '15px', lineHeight: 1.6 }}>
          Any topic works — a personal decision, a world issue, or anything you want a fresh perspective on.
        </p>
      </div>

      {/* Step tabs */}
      <div style={{ display: 'flex', marginBottom: '32px', border: '1px solid var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
        {[{ n: 1 as const, label: 'Your Topic' }, { n: 2 as const, label: 'Agent Setup' }].map(({ n, label }) => (
          <button key={n} onClick={() => setStep(n)} style={{
            flex: 1, padding: '12px',
            background: step === n ? 'var(--bg-elevated)' : 'var(--bg-surface)',
            border: 'none',
            borderRight: n === 1 ? '1px solid var(--border-subtle)' : 'none',
            color: step === n ? 'var(--amber)' : 'var(--text-muted)',
            fontFamily: 'var(--font-display)', fontSize: '11px',
            letterSpacing: '0.15em', textTransform: 'uppercase' as const,
            cursor: 'pointer', transition: 'all 0.2s', position: 'relative' as const,
          }}>
            {step === n && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--amber)' }} />}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', marginRight: '6px', opacity: 0.5 }}>0{n}</span>
            {label}
          </button>
        ))}
      </div>

      {/* ── STEP 1: Topic ─────────────────────────────────────── */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Topic input */}
          <div>
            <FieldLabel>YOUR TOPIC OR QUESTION *</FieldLabel>
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Should I buy a dog? / Nuclear energy is essential for net-zero / Should I quit my job?"
              rows={3}
              style={{ width: '100%', padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: '16px', lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(245,166,35,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          {/* Example topics */}
          <div>
            <FieldLabel>QUICK START — CLICK ANY TOPIC</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
              {EXAMPLE_TOPICS.map(t => (
                <button
                  key={t.text}
                  onClick={() => setTopic(t.text)}
                  style={{
                    padding: '10px 14px', background: topic === t.text ? 'rgba(245,166,35,0.1)' : 'var(--bg-surface)',
                    border: `1px solid ${topic === t.text ? 'var(--amber)' : 'var(--border-subtle)'}`,
                    borderRadius: '2px', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}
                  onMouseEnter={e => { if (topic !== t.text) { e.currentTarget.style.borderColor = 'rgba(245,166,35,0.4)' } }}
                  onMouseLeave={e => { if (topic !== t.text) { e.currentTarget.style.borderColor = 'var(--border-subtle)' } }}
                >
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.3 }}>{t.text}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--amber)', letterSpacing: '0.1em', marginTop: '2px' }}>{t.tag}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Extra context */}
          <div>
            <FieldLabel>EXTRA CONTEXT (optional)</FieldLabel>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.5 }}>
              For personal topics, add details so agents can give you more relevant advice. e.g. "I live in a small flat, work 10 hours a day, and have a budget of ₹5000/month."
            </p>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Add any personal context that would help agents give better advice..."
              rows={2}
              style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: '14px', lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor = 'var(--amber)'}
              onBlur={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
            />
          </div>

          {/* Settings grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            {/* Mode */}
            <div>
              <FieldLabel>DEBATE MODE</FieldLabel>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['adversarial', 'collaborative', 'socratic'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    flex: 1, padding: '8px 4px',
                    background: mode === m ? 'rgba(245,166,35,0.1)' : 'var(--bg-elevated)',
                    border: `1px solid ${mode === m ? 'var(--amber)' : 'var(--border-subtle)'}`,
                    borderRadius: '2px', cursor: 'pointer',
                    color: mode === m ? 'var(--amber)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', fontSize: '9px',
                    letterSpacing: '0.08em', textTransform: 'uppercase' as const, transition: 'all 0.2s',
                  }}>{m}</button>
                ))}
              </div>
            </div>

            {/* Rounds */}
            <div>
              <FieldLabel>MAX ROUNDS: {maxRounds}</FieldLabel>
              <input type="range" min={2} max={10} value={maxRounds}
                onChange={e => setMaxRounds(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--amber)', cursor: 'pointer', marginTop: '8px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginTop: '2px' }}>
                <span>2 Quick</span><span>10 Deep</span>
              </div>
            </div>

            {/* Consensus threshold */}
            <div>
              <FieldLabel>CONSENSUS TARGET: {Math.round(threshold * 100)}%</FieldLabel>
              <input type="range" min={60} max={95} value={Math.round(threshold * 100)}
                onChange={e => setThreshold(Number(e.target.value) / 100)}
                style={{ width: '100%', accentColor: '#00ff88', cursor: 'pointer', marginTop: '8px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginTop: '2px' }}>
                <span>60% Lenient</span><span>95% Strict</span>
              </div>
            </div>

            {/* Toggles */}
            <div>
              <FieldLabel>FEATURES</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {[
                  { label: 'Live web search', val: webSearch, set: setWebSearch },
                  { label: 'Human interrupt', val: humanInterrupt, set: setHumanInterrupt },
                  { label: 'Python REPL',     val: pythonRepl,  set: setPythonRepl },
                ].map(({ label, val, set }) => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <div onClick={() => set(!val)} style={{ width: '32px', height: '16px', background: val ? 'var(--green-lock)' : 'var(--bg-elevated)', border: `1px solid ${val ? 'var(--green-lock)' : 'var(--border-subtle)'}`, borderRadius: '8px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: '2px', left: val ? '16px' : '2px', width: '10px', height: '10px', borderRadius: '50%', background: val ? 'var(--bg-void)' : 'var(--text-muted)', transition: 'left 0.3s' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: val ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button
              onClick={() => setStep(2)}
              disabled={!topic.trim()}
              style={{
                padding: '12px 32px',
                background: topic.trim() ? 'linear-gradient(135deg, rgba(245,166,35,0.2), rgba(245,166,35,0.08))' : 'var(--bg-elevated)',
                border: `1px solid ${topic.trim() ? 'var(--amber)' : 'var(--border-subtle)'}`,
                borderRadius: '2px', cursor: topic.trim() ? 'pointer' : 'not-allowed',
                color: topic.trim() ? 'var(--amber)' : 'var(--text-muted)',
                fontFamily: 'var(--font-display)', fontSize: '11px',
                fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' as const,
                opacity: topic.trim() ? 1 : 0.5, transition: 'all 0.2s',
              }}
            >
              CONFIGURE AGENTS →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Agent Config ───────────────────────────────── */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Agent tabs */}
          <div style={{ display: 'flex', gap: '0', border: '1px solid var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
            {agents.map(a => {
              const m = ROLE_META[a.role]
              const isActive = a.role === activeAgent
              return (
                <button key={a.role} onClick={() => setActiveAgent(a.role)} style={{
                  flex: 1, padding: '10px 4px',
                  background: isActive ? `${m.color}0d` : 'var(--bg-surface)',
                  border: 'none',
                  borderRight: a.role !== 'moderator' ? '1px solid var(--border-subtle)' : 'none',
                  borderBottom: isActive ? `2px solid ${m.color}` : '2px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: '14px', color: m.color }}>{m.icon}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: isActive ? m.color : 'var(--text-muted)', letterSpacing: '0.08em', marginTop: '2px' }}>
                    {m.label.toUpperCase().slice(0, 6)}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Active agent config */}
          {agents.filter(a => a.role === activeAgent).map(agent => {
            const m = ROLE_META[agent.role]
            return (
              <div key={agent.role} style={{ padding: '24px', background: 'var(--bg-surface)', border: `1px solid ${m.color}22`, borderRadius: '2px' }}>
                <div style={{ position: 'relative', marginBottom: '20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: m.color, letterSpacing: '0.15em', marginBottom: '4px' }}>{m.label.toUpperCase()} · {m.desc}</div>
                  <input
                    value={agent.name}
                    onChange={e => updateAgent(agent.role, { name: e.target.value })}
                    style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none', padding: 0, width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>

                  {/* Model */}
                  <div>
                    <FieldLabel>GROQ MODEL</FieldLabel>
                    <select value={agent.model} onChange={e => updateAgent(agent.role, { model: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: '13px', outline: 'none' }}>
                      {GROQ_MODELS.map(gm => (
                        <option key={gm.value} value={gm.value}>{gm.label} ({gm.speed})</option>
                      ))}
                    </select>
                  </div>

                  {/* Temperament */}
                  <div>
                    <FieldLabel>TEMPERAMENT</FieldLabel>
                    <select value={agent.temperament} onChange={e => updateAgent(agent.role, { temperament: e.target.value as AgentConfig['temperament'] })}
                      style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: '13px', outline: 'none' }}>
                      {['aggressive', 'analytical', 'balanced', 'diplomatic'].map(t => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Temperature */}
                  <div>
                    <FieldLabel>TEMPERATURE: {agent.temperature.toFixed(2)}</FieldLabel>
                    <input type="range" min={0} max={1} step={0.05} value={agent.temperature}
                      onChange={e => updateAgent(agent.role, { temperature: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: m.color, cursor: 'pointer', marginTop: '8px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>Precise</span><span>Creative</span>
                    </div>
                  </div>

                  {/* Expertise */}
                  <div>
                    <FieldLabel>EXPERTISE: {agent.expertiseLevel}/5</FieldLabel>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => updateAgent(agent.role, { expertiseLevel: n as AgentConfig['expertiseLevel'] })}
                          style={{ flex: 1, height: '28px', background: n <= agent.expertiseLevel ? `${m.color}22` : 'var(--bg-elevated)', border: `1px solid ${n <= agent.expertiseLevel ? `${m.color}66` : 'var(--border-dim)'}`, borderRadius: '2px', cursor: 'pointer', color: n <= agent.expertiseLevel ? m.color : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '9px', transition: 'all 0.15s' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Topic summary */}
          <div style={{ padding: '12px 16px', background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: '2px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.1em' }}>TOPIC: </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)' }}>{topic}</span>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: 'var(--red-glow)', border: '1px solid var(--border-red)', borderRadius: '2px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red-hot)' }}>
              ✗ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(1)} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: '11px', letterSpacing: '0.15em', cursor: 'pointer' }}>
              ← BACK
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              style={{
                padding: '12px 48px',
                background: 'linear-gradient(135deg, rgba(245,166,35,0.25), rgba(245,166,35,0.1))',
                border: '1px solid var(--amber)', borderRadius: '2px',
                cursor: isPending ? 'wait' : 'pointer',
                color: 'var(--amber)', fontFamily: 'var(--font-display)',
                fontSize: '13px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' as const,
                boxShadow: '0 0 20px rgba(245,166,35,0.1)', transition: 'all 0.2s',
              }}
            >
              {isPending ? '⟳ LAUNCHING...' : '⚡ LAUNCH DEBATE'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '8px' }}>
      {children}
    </div>
  )
}