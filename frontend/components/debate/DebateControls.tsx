// LOCATION: frontend/components/debate/DebateControls.tsx

'use client'
import type { DebateStatus } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'

interface DebateControlsProps {
  status: DebateStatus
  enableHumanInterrupt: boolean
  onPause: () => void
  onResume: () => void
  onInterrupt: () => void
  onFork: () => void
  onForceConsensus: () => void
}

export function DebateControls({
  status,
  enableHumanInterrupt,
  onPause,
  onResume,
  onInterrupt,
  onFork,
  onForceConsensus,
}: DebateControlsProps) {
  const isRunning  = status === 'running'
  const isPaused   = status === 'paused'
  const isDone     = ['consensus_reached', 'max_rounds_reached', 'error'].includes(status)

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>

      {/* Live controls */}
      {isRunning && (
        <Tooltip content="Pause debate between turns">
          <Button variant="ghost" size="sm" onClick={onPause} icon={<span>⏸</span>}>
            Pause
          </Button>
        </Tooltip>
      )}

      {isPaused && (
        <Tooltip content="Resume from current state">
          <Button variant="success" size="sm" onClick={onResume} icon={<span>▶</span>}>
            Resume
          </Button>
        </Tooltip>
      )}

      {(isRunning || isPaused) && enableHumanInterrupt && (
        <Tooltip content="Inject evidence or redirect the debate mid-turn">
          <Button variant="primary" size="sm" onClick={onInterrupt} icon={<span>⚡</span>}>
            Interrupt
          </Button>
        </Tooltip>
      )}

      {/* Always available */}
      <Tooltip content="Fork this debate from the current checkpoint">
        <Button variant="ghost" size="sm" onClick={onFork} icon={<span>⑂</span>}>
          Fork
        </Button>
      </Tooltip>

      {(isRunning || isPaused) && (
        <Tooltip content="Force immediate consensus vote">
          <Button variant="ghost" size="sm" onClick={onForceConsensus} icon={<span>⊛</span>}>
            Force End
          </Button>
        </Tooltip>
      )}
    </div>
  )
}