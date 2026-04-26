// LOCATION: frontend/components/graph/ToolEdge.tsx
// Animated custom edge for React Flow — shows active data flow between nodes
// Usage: pass as edgeTypes={{ toolEdge: ToolEdge }} to ReactFlow

'use client'
// When reactflow is installed:
// import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow'

// Stub types — replace with ReactFlow imports when installed
interface EdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition?: string
  targetPosition?: string
  data?: {
    label?: string
    isActive?: boolean
    animating?: boolean
    color?: string
  }
  markerEnd?: string
  style?: React.CSSProperties
}

// Simple bezier path calculator (ReactFlow provides getBezierPath)
function simplePath(sx: number, sy: number, tx: number, ty: number) {
  const mx = (sx + tx) / 2
  return `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`
}

export function ToolEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  data,
  markerEnd,
}: EdgeProps) {
  const isActive   = data?.isActive ?? false
  const animating  = data?.animating ?? false
  const color      = data?.color ?? (isActive ? '#f5a623' : 'rgba(255,255,255,0.12)')
  const label      = data?.label

  const path = simplePath(sourceX, sourceY, targetX, targetY)
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2

  return (
    <>
      {/* Base edge path */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={isActive ? 1.5 : 0.8}
        strokeOpacity={isActive ? 1 : 0.4}
        markerEnd={markerEnd}
        style={{ transition: 'stroke 0.3s ease, stroke-width 0.3s ease' }}
      />

      {/* Animated flow dot */}
      {animating && (
        <circle r="3" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
          <animateMotion
            dur="1.2s"
            repeatCount="indefinite"
            path={path}
          />
        </circle>
      )}

      {/* Label */}
      {label && (
        <text
          x={midX}
          y={midY - 6}
          textAnchor="middle"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '8px',
            fill: isActive ? color : 'rgba(255,255,255,0.3)',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </text>
      )}
    </>
  )
}