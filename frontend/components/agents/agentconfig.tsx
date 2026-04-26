// LOCATION: frontend/components/agents/AgentConfig.tsx
// In-arena live agent configuration panel
// Lets user tweak temperature, temperament, expertise mid-debate (before next round)

'use client'
import { useState } from 'react'
import type { AgentConfig, AgentRole } from '@/lib/types'

const ROLE_META: Record<AgentRole, { color: string; icon: string; label: string }> = {
  proponent:    { color: '#00ff88', icon: '▲', label: 'Proponent' },
  opponent:     { color: '#ff3c3c', icon: '▼', label: 'Opponent' },
  fact_checker: { color: '#f5a623', icon: '◆', label: 'Fact-Checker' },
  moderator:    { color: '#1e90ff', icon: '◉', label: 'Moderator' },
}

const MODELS = [
  { value: 'llama-3.3-70b-versatile',  label: 'Llama 3.3 70B',    speed: 'fast',   quality: 'high' },
  { value: 'llama-3.1-70b-specdec',    label: 'Llama 3.1 SpecDec', speed: 'fast',   quality: 'high' },
  { value: 'mixtral-8x7b-32768',       label: 'Mixtral 8x7B',      speed: 'medium', quality: 'high' },
  { value: 'llama-3.1-8b-instant',     label: 'Llama 3.1 8B',      speed: 'ultra',  quality: 'medium' },
  { value: 'gemma2-9b-it',             label: 'Gemma 2 9B',        speed: 'fast',   quality: 'medium' },
]

const TEMPERAMENTS = [
  { value: 'aggressive',  label: 'Aggressive',  desc: 'Attacks weak arguments relentlessly' },
  { value: 'analytical',  label: 'Analytical',  desc: 'Logic chains and formal reasoning' },
  { value: 'diplomatic',  label: 'Diplomatic',  desc: 'Acknowledges, then dismantles' },
  { value: 'balanced',    label: 'Balanced',    desc: 'Adapts style to opponent' },
]

interface AgentConfigPanelProps {
  agents: AgentConfig[]
  onUpdate: (updated: AgentConfig[]) => void
  onClose: () => void
  debateIsLive: boolean
}

export function AgentConfigPanel({ agents, onUpdate, onClose, debateIsLive }: AgentConfigPanelProps) {
  const [configs, setConfigs] = useState<AgentConfig[]>(agents)
  const [activeTab, setActiveTab] = useState<string>(agents[0]?.role ?? 'proponent')
  const [saved, setSaved] = useState(false)

  const update = (role: string, patch: Partial<AgentConfig>) => {
    setConfigs(prev => prev.map(a => a.role === role ? { ...a, ...patch } : a))
    setSaved(false)
  }

  const handleSave = () => {
    onUpdate(configs)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const activeConfig = configs.find(a => a.role === activeTab)
  if (!activeConfig) return null
  const meta = ROLE_META[activeConfig.role as AgentRole]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-base)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.2em', marginBottom: '2px' }}>
            AGENT CONFIGURATION
          </div>
          {debateIsLive && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>
              Changes apply at next round start
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}
        >✕</button>
      </div>

      {/* Agent tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        {configs.map(a => {
          const m = ROLE_META[a.role as AgentRole]
          const isActive = a.role === activeTab
          return (
            <button
              key={a.role}
              onClick={() => setActiveTab(a.role)}
              style={{
                flex: 1,
                padding: '8px 4px',
                background: isActive ? `${m.color}0d` : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${m.color}` : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '10px', color: m.color }}>{m.icon}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: isActive ? m.color : 'var(--text-muted)', letterSpacing: '0.08em' }}>
                {m.label.toUpperCase().slice(0, 4)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Config body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Name */}
        <Field label="AGENT NAME">
          <input
            value={activeConfig.name}
            onChange={e => update(activeConfig.role, { name: e.target.value })}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--bg-elevated)',
              border: `1px solid ${meta.color}33`,
              borderRadius: '2px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontSize: '14px',
              fontWeight: 600,
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
            }}
            onFocus={e => e.currentTarget.style.borderColor = meta.color}
            onBlur={e => e.currentTarget.style.borderColor = `${meta.color}33`}
          />
        </Field>

        {/* Model selector */}
        <Field label="GROQ MODEL">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {MODELS.map(m => (
              <button
                key={m.value}
                onClick={() => update(activeConfig.role, { model: m.value })}
                style={{
                  padding: '7px 10px',
                  background: activeConfig.model === m.value ? `${meta.color}0d` : 'var(--bg-elevated)',
                  border: `1px solid ${activeConfig.model === m.value ? `${meta.color}55` : 'var(--border-dim)'}`,
                  borderRadius: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: activeConfig.model === m.value ? meta.color : 'var(--text-primary)' }}>
                  {m.label}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', padding: '1px 5px', borderRadius: '2px', background: speedColor(m.speed) + '22', color: speedColor(m.speed), border: `1px solid ${speedColor(m.speed)}44` }}>
                    {m.speed}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', padding: '1px 5px', borderRadius: '2px', background: 'var(--bg-base)', color: 'var(--text-muted)', border: '1px solid var(--border-dim)' }}>
                    {m.quality}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Field>

        {/* Temperature */}
        <Field label={`TEMPERATURE: ${activeConfig.temperature.toFixed(2)}`}>
          <input
            type="range" min={0} max={1} step={0.05}
            value={activeConfig.temperature}
            onChange={e => update(activeConfig.role, { temperature: Number(e.target.value) })}
            style={{ width: '100%', accentColor: meta.color, cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginTop: '2px' }}>
            <span>0.0 Deterministic</span>
            <span>1.0 Creative</span>
          </div>
        </Field>

        {/* Expertise */}
        <Field label={`EXPERTISE LEVEL: ${activeConfig.expertiseLevel}/5`}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => update(activeConfig.role, { expertiseLevel: n as AgentConfig['expertiseLevel'] })}
                style={{
                  flex: 1, height: '32px',
                  background: n <= activeConfig.expertiseLevel ? `${meta.color}1a` : 'var(--bg-elevated)',
                  border: `1px solid ${n <= activeConfig.expertiseLevel ? `${meta.color}66` : 'var(--border-dim)'}`,
                  borderRadius: '2px',
                  cursor: 'pointer',
                  color: n <= activeConfig.expertiseLevel ? meta.color : 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '12px',
                  fontWeight: n <= activeConfig.expertiseLevel ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {expertiseDesc(activeConfig.expertiseLevel)}
          </div>
        </Field>

        {/* Temperament */}
        <Field label="TEMPERAMENT">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {TEMPERAMENTS.map(t => (
              <button
                key={t.value}
                onClick={() => update(activeConfig.role, { temperament: t.value as AgentConfig['temperament'] })}
                style={{
                  padding: '8px 10px',
                  background: activeConfig.temperament === t.value ? `${meta.color}0d` : 'transparent',
                  border: `1px solid ${activeConfig.temperament === t.value ? `${meta.color}55` : 'var(--border-dim)'}`,
                  borderRadius: '2px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: activeConfig.temperament === t.value ? meta.color : 'var(--text-primary)', marginBottom: '2px', fontWeight: 600 }}>
                  {t.label}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t.desc}
                </div>
              </button>
            ))}
          </div>
        </Field>

        {/* Custom system prompt */}
        <Field label="CUSTOM SYSTEM PROMPT (optional)">
          <textarea
            value={activeConfig.systemPrompt ?? ''}
            onChange={e => update(activeConfig.role, { systemPrompt: e.target.value })}
            placeholder={`Override default ${meta.label} prompt...`}
            rows={4}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '2px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={e => e.currentTarget.style.borderColor = meta.color}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
          />
        </Field>
      </div>

      {/* Footer save */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '10px',
            background: saved ? 'rgba(0,255,136,0.1)' : `${meta.color}11`,
            border: `1px solid ${saved ? 'var(--green-lock)' : meta.color}`,
            borderRadius: '2px',
            color: saved ? 'var(--green-lock)' : meta.color,
            fontFamily: 'var(--font-display)',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            cursor: 'pointer',
            transition: 'all 0.3s',
          }}
        >
          {saved ? '✓ SAVED' : 'APPLY CHANGES'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '8px' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function speedColor(speed: string) {
  return speed === 'ultra' ? '#00ff88' : speed === 'fast' ? '#f5a623' : '#1e90ff'
}

function expertiseDesc(level: number) {
  return [
    '', 'Layperson — simple language, broad strokes',
    'Informed — aware of key debates and concepts',
    'Expert — domain knowledge, cites sources',
    'Authority — cutting-edge research, technical depth',
    'World-class — peer-review level, challenges axioms',
  ][level]
}