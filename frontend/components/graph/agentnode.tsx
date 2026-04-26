// LOCATION: frontend/components/graph/AgentNode.tsx
// Custom React Flow node for each agent in the LangGraph visualization
// Usage: pass as nodeTypes={{ agentNode: AgentNode }} to ReactFlow

'use client'
// When reactflow is installed:
// import { Handle, Position, NodeProps } from 'reactflow'
import type { AgentRole } from '@/lib/types'

const ROLE_META: Record<string, { color: string; icon: string; label: string }> = {
  proponent:    { color: '#00ff88', icon: '▲', label: 'PROPONENT' },
  opponent:     { color: '#ff3c3c', icon: '▼', label: 'OPPONENT' },
  fact_checker: { color: '#f5a623', icon: '◆', label: 'FACT-CHECK' },
  moderator:    { color: '#1e90ff', icon: '◉', label: 'MODERATOR' },
  tool:         { color: '#9b59ff', icon: '⚡', label: 'TOOLS' },
  consensus:    { color: '#00e5ff', icon: '◎', label: 'CONSENSUS' },
  interrupt:    { color: '#f5a623', icon: '⚡', label: 'INTERRUPT' },
  start:        { color: '#ffffff', icon: '●', label: 'START' },
  end:          { color: '#ffffff', icon: '◉', label: 'END' },
}

// Props shape matches ReactFlow NodeProps when installed
interface AgentNodeProps {
  data: {
    label: string
    type: string
    agentRole?: AgentRole
    status: 'idle' | 'active' | 'complete' | 'error'
    toolsInUse?: string[]
    score?: number
  }
}

export function AgentNode({ data }: AgentNodeProps) {
  const meta = ROLE_META[data.agentRole ?? data.type] ?? ROLE_META.tool
  const isActive  = data.status === 'active'
  const isError   = data.status === 'error'
  const isDone    = data.status === 'complete'

  const borderColor = isError ? '#ff3c3c' : isActive ? meta.color : isDone ? `${meta.color}88` : `${meta.color}33`
  const bgColor     = isActive ? `${meta.color}11` : 'rgba(8,13,20,0.9)'

  return (
    <div style={{
      padding: '8px 12px',
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '2px',
      minWidth: '90px',
      position: 'relative',
      transition: 'all 0.3s ease',
      boxShadow: isActive ? `0 0 20px ${meta.color}33, 0 0 40px ${meta.color}11` : 'none',
      opacity: data.status === 'idle' ? 0.5 : 1,
    }}>
      {/* Top accent bar — only when active */}
      {isActive && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: '2px',
          background: meta.color,
          boxShadow: `0 0 8px ${meta.color}`,
        }} />
      )}

      {/* Handle top (input) — comment back in when reactflow installed */}
      {/* <Handle type="target" position={Position.Top} style={{ background: meta.color, border: 'none', width: 6, height: 6 }} /> */}

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: isActive ? '5px' : 0 }}>
        <span style={{
          fontSize: '12px',
          color: meta.color,
          animation: isActive ? 'pulse-glow 1.5s ease-in-out infinite' : 'none',
        }}>
          {meta.icon}
        </span>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: meta.color, letterSpacing: '0.1em' }}>
            {meta.label}
          </div>
          {data.score !== undefined && isDone && (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--text-primary)', fontWeight: 700 }}>
              {data.score}
            </div>
          )}
        </div>
      </div>

      {/* Active status + tools */}
      {isActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: '4px', height: '4px', borderRadius: '50%',
            background: meta.color,
            animation: 'pulse-dot 1s ease-in-out infinite',
            flexShrink: 0,
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--text-muted)' }}>
            {data.toolsInUse?.length ? data.toolsInUse[0].toUpperCase() : 'PROCESSING'}
          </span>
        </div>
      )}

      {/* Handle bottom (output) — comment back in when reactflow installed */}
      {/* <Handle type="source" position={Position.Bottom} style={{ background: meta.color, border: 'none', width: 6, height: 6 }} /> */}

      <style>{`
        @keyframes pulse-glow {
          0%,100% { text-shadow: 0 0 4px ${meta.color}; }
          50%      { text-shadow: 0 0 12px ${meta.color}, 0 0 20px ${meta.color}66; }
        }
      `}</style>
    </div>
  )
}