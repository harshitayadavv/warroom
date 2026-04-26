// LOCATION: frontend/components/graph/GraphCanvas.tsx
// ReactFlow LangGraph visualizer — shows live active node + animated edges
// Dependency: npm install @xyflow/react

'use client'
import { useEffect, useMemo, useCallback } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, BackgroundVariant,
  type Node, type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { GRAPH_NODES, ROLE_COLORS } from '@/lib/constants'
import type { AgentRole } from '@/lib/types'

// ── Custom Node ───────────────────────────────────────────────
function AgentFlowNode({ data }: { data: Record<string, unknown> }) {
  const role   = data.role as AgentRole | null
  const active = data.isActive as boolean
  const type   = data.nodeType as string

  const color =
    type === 'tool'      ? '#9b59ff' :
    type === 'consensus' ? '#00e5ff' :
    type === 'interrupt' ? '#f5a623' :
    type === 'control'   ? 'rgba(255,255,255,0.5)' :
    role ? ROLE_COLORS[role].primary : '#3d5470'

  return (
    <div style={{
      padding: '8px 14px',
      background: active ? `${color}22` : 'rgba(13,21,32,0.95)',
      border: `1px solid ${active ? color : color + '44'}`,
      borderRadius: '2px',
      minWidth: '110px',
      textAlign: 'center',
      boxShadow: active ? `0 0 20px ${color}44` : 'none',
      transition: 'all 0.4s ease',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {active && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          animation: 'shimmer 1.5s linear infinite' }} />
      )}
      <div style={{ fontFamily: 'monospace', fontSize: '10px', color, letterSpacing: '0.1em',
        textTransform: 'uppercase', fontWeight: active ? 700 : 400 }}>
        {data.label as string}
      </div>
      {active && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '3px' }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: color,
            animation: 'pulse 1s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '7px', color, opacity: 0.8 }}>ACTIVE</span>
        </div>
      )}
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )
}

const NODE_TYPES = { agentNode: AgentFlowNode }

interface GraphCanvasProps {
  activeNodeId?: string | null
}

function makeNodes(activeId?: string | null): Node[] {
  const isActive = (id: string) => id === activeId
  return [
    { id: GRAPH_NODES.START,        type: 'agentNode', position: { x: 200, y: 0 },   data: { label: 'Start',           nodeType: 'control',   isActive: isActive(GRAPH_NODES.START),        role: null } },
    { id: GRAPH_NODES.MODERATOR,    type: 'agentNode', position: { x: 180, y: 90 },  data: { label: 'Moderator',        nodeType: 'agent',     isActive: isActive(GRAPH_NODES.MODERATOR),    role: 'moderator' } },
    { id: GRAPH_NODES.PROPONENT,    type: 'agentNode', position: { x: 20,  y: 210 }, data: { label: 'Proponent',        nodeType: 'agent',     isActive: isActive(GRAPH_NODES.PROPONENT),    role: 'proponent' } },
    { id: GRAPH_NODES.FACT_CHECKER, type: 'agentNode', position: { x: 180, y: 210 }, data: { label: 'Fact-Checker',     nodeType: 'agent',     isActive: isActive(GRAPH_NODES.FACT_CHECKER), role: 'fact_checker' } },
    { id: GRAPH_NODES.OPPONENT,     type: 'agentNode', position: { x: 340, y: 210 }, data: { label: 'Opponent',         nodeType: 'agent',     isActive: isActive(GRAPH_NODES.OPPONENT),     role: 'opponent' } },
    { id: GRAPH_NODES.TOOL_ROUTER,  type: 'agentNode', position: { x: 60,  y: 350 }, data: { label: 'Tool Router',      nodeType: 'tool',      isActive: isActive(GRAPH_NODES.TOOL_ROUTER),  role: null } },
    { id: GRAPH_NODES.WEB_SEARCH,   type: 'agentNode', position: { x: 0,   y: 460 }, data: { label: 'Web Search',       nodeType: 'tool',      isActive: isActive(GRAPH_NODES.WEB_SEARCH),   role: null } },
    { id: GRAPH_NODES.PYTHON_REPL,  type: 'agentNode', position: { x: 140, y: 460 }, data: { label: 'Python REPL',      nodeType: 'tool',      isActive: isActive(GRAPH_NODES.PYTHON_REPL),  role: null } },
    { id: GRAPH_NODES.HUMAN,        type: 'agentNode', position: { x: 360, y: 350 }, data: { label: 'Human Interrupt',  nodeType: 'interrupt', isActive: isActive(GRAPH_NODES.HUMAN),        role: null } },
    { id: GRAPH_NODES.CONSENSUS,    type: 'agentNode', position: { x: 180, y: 570 }, data: { label: 'Consensus Engine', nodeType: 'consensus', isActive: isActive(GRAPH_NODES.CONSENSUS),    role: null } },
    { id: GRAPH_NODES.END,          type: 'agentNode', position: { x: 200, y: 670 }, data: { label: 'End',              nodeType: 'control',   isActive: isActive(GRAPH_NODES.END),          role: null } },
  ]
}

const STATIC_EDGES: Edge[] = [
  { id: 'e1',  source: GRAPH_NODES.START,        target: GRAPH_NODES.MODERATOR,    animated: false, style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 } },
  { id: 'e2',  source: GRAPH_NODES.MODERATOR,    target: GRAPH_NODES.PROPONENT,    animated: false, style: { stroke: '#00ff8866', strokeWidth: 1 } },
  { id: 'e3',  source: GRAPH_NODES.MODERATOR,    target: GRAPH_NODES.FACT_CHECKER, animated: false, style: { stroke: '#f5a62366', strokeWidth: 1 } },
  { id: 'e4',  source: GRAPH_NODES.MODERATOR,    target: GRAPH_NODES.OPPONENT,     animated: false, style: { stroke: '#ff3c3c66', strokeWidth: 1 } },
  { id: 'e5',  source: GRAPH_NODES.PROPONENT,    target: GRAPH_NODES.TOOL_ROUTER,  animated: false, style: { stroke: '#9b59ff66', strokeWidth: 1 }, label: 'tools' },
  { id: 'e6',  source: GRAPH_NODES.OPPONENT,     target: GRAPH_NODES.TOOL_ROUTER,  animated: false, style: { stroke: '#9b59ff66', strokeWidth: 1 } },
  { id: 'e7',  source: GRAPH_NODES.FACT_CHECKER, target: GRAPH_NODES.TOOL_ROUTER,  animated: false, style: { stroke: '#9b59ff66', strokeWidth: 1 } },
  { id: 'e8',  source: GRAPH_NODES.TOOL_ROUTER,  target: GRAPH_NODES.WEB_SEARCH,   animated: false, style: { stroke: '#9b59ff44', strokeWidth: 1 } },
  { id: 'e9',  source: GRAPH_NODES.TOOL_ROUTER,  target: GRAPH_NODES.PYTHON_REPL,  animated: false, style: { stroke: '#9b59ff44', strokeWidth: 1 } },
  { id: 'e10', source: GRAPH_NODES.MODERATOR,    target: GRAPH_NODES.HUMAN,        animated: false, style: { stroke: '#f5a62344', strokeWidth: 1, strokeDasharray: '4 3' }, label: 'breakpoint' },
  { id: 'e11', source: GRAPH_NODES.MODERATOR,    target: GRAPH_NODES.CONSENSUS,    animated: false, style: { stroke: '#00e5ff44', strokeWidth: 1 } },
  { id: 'e12', source: GRAPH_NODES.CONSENSUS,    target: GRAPH_NODES.END,          animated: false, style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 } },
]

export function GraphCanvas({ activeNodeId }: GraphCanvasProps) {
  const initialNodes = useMemo(() => makeNodes(activeNodeId), [activeNodeId])
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange]         = useEdgesState(STATIC_EDGES)

  // Update active node without re-mounting
  useEffect(() => {
    setNodes(makeNodes(activeNodeId))
  }, [activeNodeId, setNodes])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={0.8} color="rgba(245,166,35,0.06)" />
        <Controls style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }} showInteractive={false} />
        <MiniMap nodeColor={(n) => {
          if (n.data?.isActive) return '#f5a623'
          const role = n.data?.role as AgentRole | null
          return role ? ROLE_COLORS[role].primary : '#1d2d3d'
        }} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} maskColor="rgba(3,5,8,0.8)" />
      </ReactFlow>
    </div>
  )
}