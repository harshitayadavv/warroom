// LOCATION: frontend/hooks/useCheckpoints.ts
// Manages time-travel: fetching, forking, and restoring debate checkpoints

'use client'
import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import { useDebateStore } from '@/store/debateStore'
import type { Tables } from '@/lib/supabase'

type Checkpoint = Tables['checkpoints']

export function useCheckpoints(debateId: string | null) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [loading, setLoading]         = useState(false)
  const [forking, setForking]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const addNotification = useDebateStore((s) => s.addNotification)
  const closeForkModal  = useDebateStore((s) => s.closeForkModal)

  // Fetch all checkpoints for this debate
  const fetchCheckpoints = useCallback(async () => {
    if (!debateId) return
    setLoading(true)
    try {
      const res = await api.checkpoints.list(debateId)
      setCheckpoints(res.data ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [debateId])

  useEffect(() => {
    fetchCheckpoints()
  }, [fetchCheckpoints])

  // Fork the debate from a specific checkpoint/round
  const forkFromCheckpoint = useCallback(
    async (checkpointId: string, newTopic?: string) => {
      if (!debateId) return null
      setForking(true)
      setError(null)
      try {
        const res = await api.debates.fork(debateId, checkpointId, newTopic)
        addNotification({
          type: 'success',
          title: 'Fork created',
          message: `New debate branched from Round ${res.data.currentRound}`,
        })
        closeForkModal()
        return res.data
      } catch (e) {
        const msg = (e as Error).message
        setError(msg)
        addNotification({ type: 'error', title: 'Fork failed', message: msg })
        return null
      } finally {
        setForking(false)
      }
    },
    [debateId, addNotification, closeForkModal]
  )

  // Label a checkpoint for easy reference
  const labelCheckpoint = useCallback(
    async (checkpointId: string, label: string) => {
      try {
        await api.checkpoints.label(checkpointId, label)
        setCheckpoints((prev) =>
          prev.map((c) => (c.id === checkpointId ? { ...c, label } : c))
        )
      } catch (e) {
        setError((e as Error).message)
      }
    },
    []
  )

  return {
    checkpoints,
    loading,
    forking,
    error,
    fetchCheckpoints,
    forkFromCheckpoint,
    labelCheckpoint,
  }
}