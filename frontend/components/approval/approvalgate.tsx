// LOCATION: frontend/components/approval/ApprovalGate.tsx
// Shown when an agent requests a high-stakes tool call (deep search, Python REPL exec)
// Human must Approve or Reject before the agent can proceed

'use client'
import { useState } from 'react'

type ToolName = 'web_search' | 'python_repl' | 'vector_similarity' | 'fact_check'

const TOOL_META: Record<ToolName, { icon: string; label: string; desc: string; risk: 'low' | 'medium' | 'high' }> = {
  web_search:        { icon: '⊕', label: 'Web Search',        desc: 'Search the live internet for information', risk: 'low' },
  python_repl:       { icon: '⌬', label: 'Python REPL',       desc: 'Execute Python code in a sandboxed environment', risk: 'medium' },
  vector_similarity: { icon: '◈', label: 'Vector Similarity',  desc: 'Compute embedding similarity between arguments', risk: 'low' },
  fact_check:        { icon: '◆', label: 'Fact Verification',  desc: 'Cross-reference claim against multiple sources', risk: 'medium' },
}

const RISK_META = {
  low:    { color: 'var(--green-lock)', bg: 'rgba(0,255,136,0.06)',   border: 'rgba(0,255,136,0.25)',  label: 'LOW RISK' },
  medium: { color: 'var(--amber)',       bg: 'rgba(245,166,35,0.08)',  border: 'rgba(245,166,35,0.3)',  label: 'REVIEW REQUIRED' },
  high:   { color: 'var(--red-hot)',    bg: 'rgba(255,60,60,0.08)',   border: 'rgba(255,60,60,0.35)',  label: 'HIGH RISK' },
}

interface ApprovalRequest {
  id: string
  tool: ToolName
  agentRole: string
  agentName: string
  input: Record<string, unknown>
  timestamp: string
}

interface ApprovalGateProps {
  request: ApprovalRequest
  onApprove: (id: string) => void
  onReject: (id: string, reason?: string) => void
}

export function ApprovalGate({ request, onApprove, onReject }: ApprovalGateProps) {
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [decided, setDecided] = useState<'approved' | 'rejected' | null>(null)

  const toolMeta = TOOL_META[request.tool] ?? { icon: '?', label: request.tool, desc: 'Tool call', risk: 'medium' as const }
  const riskMeta = RISK_META[toolMeta.risk]

  const handleApprove = () => {
    setDecided('approved')
    setTimeout(() => onApprove(request.id), 400)
  }

  const handleReject = () => {
    setDecided('rejected')
    setTimeout(() => onReject(request.id, rejectReason), 400)
  }

  return (
    <div style={{
      padding: '0',
      background: decided === 'approved' ? 'rgba(0,255,136,0.06)' : decided === 'rejected' ? 'rgba(255,60,60,0.06)' : riskMeta.bg,
      border: `1px solid ${decided === 'approved' ? 'rgba(0,255,136,0.3)' : decided === 'rejected' ? 'rgba(255,60,60,0.3)' : riskMeta.border}`,
      borderRadius: '2px',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      opacity: decided ? 0.6 : 1,
    }}>
      {/* Top bar */}
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${riskMeta.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ color: riskMeta.color, fontSize: '14px' }}>{toolMeta.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: riskMeta.color, letterSpacing: '0.12em', fontWeight: 700 }}>
            {riskMeta.label} · APPROVAL REQUIRED
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)' }}>
          {new Date(request.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '2px' }}>
              {toolMeta.label}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {toolMeta.desc}
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', textAlign: 'right' }}>
            <div>{request.agentName}</div>
            <div style={{ color: 'var(--text-muted)' }}>{request.agentRole}</div>
          </div>
        </div>

        {/* Input preview */}
        <div style={{
          padding: '6px 8px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-dim)',
          borderRadius: '2px',
          marginBottom: '10px',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--text-secondary)',
          maxHeight: '80px',
          overflowY: 'auto',
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '8px', marginBottom: '3px', letterSpacing: '0.1em' }}>INPUT</div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(request.input, null, 2)}
          </pre>
        </div>

        {/* Reject reason input */}
        {rejectMode && (
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Optional: reason for rejection (sent back to agent)"
            rows={2}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-red)',
              borderRadius: '2px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              resize: 'none',
              outline: 'none',
              marginBottom: '8px',
              boxSizing: 'border-box',
            }}
          />
        )}

        {/* Action buttons */}
        {!decided && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {!rejectMode ? (
              <>
                <button
                  onClick={handleApprove}
                  style={{
                    flex: 1, padding: '7px',
                    background: 'rgba(0,255,136,0.1)',
                    border: '1px solid rgba(0,255,136,0.4)',
                    borderRadius: '2px',
                    color: 'var(--green-lock)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '10px',
                    letterSpacing: '0.15em',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,136,0.18)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,255,136,0.1)'}
                >
                  ✓ APPROVE
                </button>
                <button
                  onClick={() => setRejectMode(true)}
                  style={{
                    flex: 1, padding: '7px',
                    background: 'rgba(255,60,60,0.08)',
                    border: '1px solid rgba(255,60,60,0.35)',
                    borderRadius: '2px',
                    color: 'var(--red-hot)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '10px',
                    letterSpacing: '0.15em',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,60,60,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,60,60,0.08)'}
                >
                  ✗ REJECT
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleReject}
                  style={{ flex: 1, padding: '7px', background: 'rgba(255,60,60,0.12)', border: '1px solid var(--red-hot)', borderRadius: '2px', color: 'var(--red-hot)', fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.15em', cursor: 'pointer' }}
                >
                  CONFIRM REJECT
                </button>
                <button
                  onClick={() => setRejectMode(false)}
                  style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: '2px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: '10px', cursor: 'pointer' }}
                >
                  BACK
                </button>
              </>
            )}
          </div>
        )}

        {decided && (
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', color: decided === 'approved' ? 'var(--green-lock)' : 'var(--red-hot)', letterSpacing: '0.15em' }}>
            {decided === 'approved' ? '✓ APPROVED — EXECUTING' : '✗ REJECTED — AGENT NOTIFIED'}
          </div>
        )}
      </div>
    </div>
  )
}

// Stack of pending approvals
interface ApprovalQueueProps {
  requests: ApprovalRequest[]
  onApprove: (id: string) => void
  onReject: (id: string, reason?: string) => void
}

export function ApprovalQueue({ requests, onApprove, onReject }: ApprovalQueueProps) {
  if (requests.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--amber)', letterSpacing: '0.2em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--amber)', animation: 'pulse-dot 1s ease-in-out infinite' }} />
        PENDING APPROVALS ({requests.length})
      </div>
      {requests.map(r => (
        <ApprovalGate key={r.id} request={r} onApprove={onApprove} onReject={onReject} />
      ))}
    </div>
  )
}